import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { generateText } from "ai";
import { db } from "@/db";
import {
  simulations,
  tribes,
  agents,
  ruleChanges,
  turnEvents,
  turns,
  deliberationThreads,
  tribeContacts,
  economySnapshots,
  type TribeRule,
  type VoteRecord,
  type EventEffects,
  type AgentResources,
} from "@/db/schema";
import { calculateDrift } from "@/lib/engine/drift";
import { proModel } from "@/lib/ai/models";
import {
  buildWorldHistoryPrompt,
  buildDivergenceReportPrompt,
} from "@/lib/ai/prompts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sim = await db
    .select()
    .from(simulations)
    .where(eq(simulations.id, id))
    .then((r) => r[0]);

  if (!sim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Return cached report if available
  if (sim.cachedReport) {
    return NextResponse.json(sim.cachedReport);
  }

  const allTribes = await db
    .select()
    .from(tribes)
    .where(eq(tribes.simulationId, id));

  // Fetch all turns for this simulation (for joining events with turn numbers)
  const allTurns = await db
    .select()
    .from(turns)
    .where(eq(turns.simulationId, id));

  const turnMap = new Map(allTurns.map((t) => [t.id, t]));

  // Fetch tribe contacts
  const contacts = await db
    .select()
    .from(tribeContacts)
    .where(eq(tribeContacts.simulationId, id));

  const report = await Promise.all(
    allTribes.map(async (tribe) => {
      const [tribeAgents, changes, events, threads, snapshots] = await Promise.all([
        db.select().from(agents).where(eq(agents.tribeId, tribe.id)),
        db.select().from(ruleChanges).where(eq(ruleChanges.tribeId, tribe.id)),
        db.select().from(turnEvents).where(eq(turnEvents.tribeId, tribe.id)),
        db
          .select()
          .from(deliberationThreads)
          .where(eq(deliberationThreads.tribeId, tribe.id)),
        db
          .select()
          .from(economySnapshots)
          .where(eq(economySnapshots.tribeId, tribe.id)),
      ]);

      const drift = calculateDrift(
        tribe.foundingRules as TribeRule[],
        tribe.rules as TribeRule[]
      );

      const living = tribeAgents.filter((a) => a.status === "alive");
      const dead = tribeAgents.filter((a) => a.status === "dead");

      // --- Demographics ---
      const lifespans = dead
        .filter((a) => a.diedTurn != null && a.bornTurn != null)
        .map((a) => a.age);
      const avgLifespan =
        lifespans.length > 0
          ? lifespans.reduce((s, l) => s + l, 0) / lifespans.length
          : 0;

      const causesOfDeath: Record<string, number> = {};
      for (const a of dead) {
        const cause = a.causeOfDeath || "unknown";
        causesOfDeath[cause] = (causesOfDeath[cause] || 0) + 1;
      }

      // Generational breakdown: how many agents born per generation
      const generationBreakdown: Record<
        number,
        { born: number; died: number }
      > = {};
      for (const a of tribeAgents) {
        const turn = turnMap.get(
          allTurns.find((t) => t.turnNumber === a.bornTurn)?.id || ""
        );
        const gen = turn?.generationNumber || 1;
        if (!generationBreakdown[gen])
          generationBreakdown[gen] = { born: 0, died: 0 };
        generationBreakdown[gen].born++;
        if (a.status === "dead") generationBreakdown[gen].died++;
      }

      // --- Notable Agents ---
      // Oldest who ever lived
      const oldestAgent = [...dead, ...living].sort(
        (a, b) => b.age - a.age
      )[0];

      // Most connected (most relationships)
      const mostConnected = [...tribeAgents].sort(
        (a, b) =>
          ((b.relationships as unknown[]) || []).length -
          ((a.relationships as unknown[]) || []).length
      )[0];

      // Most children
      const childCount: Record<string, number> = {};
      for (const a of tribeAgents) {
        if (a.parentAId) childCount[a.parentAId] = (childCount[a.parentAId] || 0) + 1;
        if (a.parentBId) childCount[a.parentBId] = (childCount[a.parentBId] || 0) + 1;
      }
      const mostProlificId = Object.entries(childCount).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0];
      const mostProlific = mostProlificId
        ? tribeAgents.find((a) => a.id === mostProlificId)
        : null;

      // Founders still alive
      const founders = tribeAgents.filter((a) => a.bornTurn === 0);
      const foundersAlive = founders.filter((a) => a.status === "alive");

      // --- Events with turn context ---
      const eventsWithContext = events.map((e) => {
        const turn = turnMap.get(e.turnId);
        return {
          description: e.description,
          category: e.eventCategory,
          severity: e.severity,
          turnNumber: turn?.turnNumber ?? 0,
          generation: turn?.generationNumber ?? 1,
          effects: e.effects as EventEffects,
        };
      }).sort((a, b) => a.turnNumber - b.turnNumber);

      // Event stats
      const eventsByCategory: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      for (const e of events) {
        eventsByCategory[e.eventCategory] =
          (eventsByCategory[e.eventCategory] || 0) + 1;
        eventsBySeverity[e.severity] =
          (eventsBySeverity[e.severity] || 0) + 1;
      }

      // --- Rule Changes with details ---
      const passedChanges = changes.filter((c) => c.passed);
      const rejectedChanges = changes.filter((c) => !c.passed);

      const ruleChangeDetails = passedChanges.map((c) => {
        const turn = turnMap.get(c.turnId);
        const proposer = tribeAgents.find((a) => a.id === c.proposedBy);
        const votes = c.voteResult as VoteRecord[];
        const approvals = votes.filter((v) => v.decision === "approve").length;
        const rejections = votes.filter((v) => v.decision === "reject").length;
        const abstentions = votes.filter((v) => v.decision === "abstain").length;

        return {
          domain: c.domain,
          oldRule: c.oldRule,
          newRule: c.newRule,
          proposedBy: proposer?.name || "Unknown",
          turnNumber: turn?.turnNumber ?? 0,
          generation: turn?.generationNumber ?? 1,
          votes: { approve: approvals, reject: rejections, abstain: abstentions, total: votes.length },
          voteDetails: votes,
        };
      }).sort((a, b) => a.turnNumber - b.turnNumber);

      // --- Deliberation highlights ---
      const deliberationHighlights = threads
        .map((t) => {
          const turn = turnMap.get(t.turnId);
          const msgs = t.messages as { agentId: string; name: string; content: string; round: number }[];
          return {
            turnNumber: turn?.turnNumber ?? 0,
            generation: turn?.generationNumber ?? 1,
            roundCount: t.roundCount,
            speakerCount: new Set(msgs.map((m) => m.agentId)).size,
            excerpt: msgs.slice(0, 3).map((m) => ({
              name: m.name,
              content: m.content,
            })),
          };
        })
        .sort((a, b) => a.turnNumber - b.turnNumber);

      // --- Key Turning Points ---
      // Identify major events + rule changes as turning points
      const turningPoints: { turnNumber: number; generation: number; description: string; type: "event" | "rule_change" }[] = [];

      for (const e of eventsWithContext) {
        if (e.severity === "major" || e.severity === "catastrophic") {
          turningPoints.push({
            turnNumber: e.turnNumber,
            generation: e.generation,
            description: e.description,
            type: "event",
          });
        }
      }
      for (const rc of ruleChangeDetails) {
        turningPoints.push({
          turnNumber: rc.turnNumber,
          generation: rc.generation,
          description: `${rc.proposedBy} changed ${rc.domain} rule: "${rc.newRule}"`,
          type: "rule_change",
        });
      }
      turningPoints.sort((a, b) => a.turnNumber - b.turnNumber);

      // --- Crisis Survival Rate ---
      const crisisEvents = events.filter(
        (e) => e.severity === "major" || e.severity === "catastrophic"
      );
      const crisisWithDeaths = crisisEvents.filter((e) => {
        const effects = e.effects as EventEffects;
        return (
          (effects.populationChange && effects.populationChange < 0) ||
          (effects.agentsKilled && effects.agentsKilled.length > 0)
        );
      });
      const crisisSurvivalRate =
        crisisEvents.length > 0
          ? Math.round(
              ((crisisEvents.length - crisisWithDeaths.length) /
                crisisEvents.length) *
                100
            )
          : 100;

      // --- Economy Snapshot ---
      const livingResources = living.map(
        (a) => (a.personalResources as AgentResources) || { food: 0, wealth: 0 }
      );
      const totalFood = livingResources.reduce((s, r) => s + r.food, 0);
      const totalWealth = livingResources.reduce((s, r) => s + r.wealth, 0);
      const avgFood = living.length > 0 ? totalFood / living.length : 0;
      const avgWealth = living.length > 0 ? totalWealth / living.length : 0;
      const hungryCount = livingResources.filter((r) => r.food < 3).length;
      const starvingCount = livingResources.filter((r) => r.food <= 0).length;

      // Gini coefficient for wealth inequality
      const sortedWealth = livingResources
        .map((r) => r.wealth)
        .sort((a, b) => a - b);
      let gini = 0;
      if (sortedWealth.length > 1) {
        const n = sortedWealth.length;
        const mean = totalWealth / n;
        if (mean > 0) {
          let sumDiff = 0;
          for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
              sumDiff += Math.abs(sortedWealth[i] - sortedWealth[j]);
            }
          }
          gini = sumDiff / (2 * n * n * mean);
        }
      }

      // Starvation deaths count
      const starvationDeaths = dead.filter(
        (a) => a.causeOfDeath === "starvation"
      ).length;

      // Scarcity events count
      const scarcityEvents = events.filter(
        (e) => e.eventCategory === "scarcity"
      ).length;

      const communalPool = (tribe.communalPool as { food: number; wealth: number }) || {
        food: 0,
        wealth: 0,
      };

      return {
        id: tribe.id,
        name: tribe.name,
        governanceModel: tribe.governanceModel,
        votingThreshold: tribe.votingThreshold,
        changeMagnitude: tribe.changeMagnitude,
        techLevel: tribe.techLevel,
        resources: tribe.resources as { food: number; materials: number; capacity: number },
        foundingRules: tribe.foundingRules as TribeRule[],
        currentRules: tribe.rules as TribeRule[],
        drift,
        population: {
          total: tribeAgents.length,
          living: living.length,
          dead: dead.length,
        },
        demographics: {
          avgLifespan: Math.round(avgLifespan * 10) / 10,
          causesOfDeath,
          generationBreakdown,
          foundersTotal: founders.length,
          foundersAlive: foundersAlive.length,
        },
        notableAgents: {
          oldest: oldestAgent
            ? {
                name: oldestAgent.name,
                age: oldestAgent.age,
                status: oldestAgent.status,
                personality: oldestAgent.personality as string[],
                values: oldestAgent.values as string[],
              }
            : null,
          mostConnected: mostConnected
            ? {
                name: mostConnected.name,
                relationshipCount: ((mostConnected.relationships as unknown[]) || []).length,
                status: mostConnected.status,
              }
            : null,
          mostProlific: mostProlific
            ? {
                name: mostProlific.name,
                childCount: childCount[mostProlific.id] || 0,
                status: mostProlific.status,
              }
            : null,
        },
        ruleChanges: {
          passed: passedChanges.length,
          rejected: rejectedChanges.length,
          total: changes.length,
          details: ruleChangeDetails,
        },
        events: {
          total: events.length,
          byCategory: eventsByCategory,
          bySeverity: eventsBySeverity,
          timeline: eventsWithContext,
        },
        deliberations: {
          total: threads.length,
          highlights: deliberationHighlights,
        },
        turningPoints,
        crisisSurvivalRate,
        economy: {
          communalPool,
          avgFood: Math.round(avgFood * 10) / 10,
          avgWealth: Math.round(avgWealth * 10) / 10,
          totalFood: Math.round(totalFood),
          totalWealth: Math.round(totalWealth),
          hungry: hungryCount,
          starving: starvingCount,
          inequality: Math.round(gini * 100),
          starvationDeaths,
          scarcityEvents,
          timeline: snapshots
            .sort((a, b) => a.turnNumber - b.turnNumber)
            .map((s) => ({
              turn: s.turnNumber,
              population: s.population,
              avgFood: Math.round(s.avgFood * 10) / 10,
              avgWealth: Math.round(s.avgWealth * 10) / 10,
              totalFood: Math.round(s.totalFood),
              totalWealth: Math.round(s.totalWealth),
              hungry: s.hungryCount,
              starving: s.starvingCount,
              communalFood: Math.round(s.communalFood),
              communalWealth: Math.round(s.communalWealth),
              inequality: Math.round(s.inequality * 100),
            })),
        },
      };
    })
  );

  // --- Cross-tribe contacts ---
  const tribeNameMap = new Map(allTribes.map((t) => [t.id, t.name]));
  const contactReport = contacts.map((c) => ({
    tribeA: tribeNameMap.get(c.tribeAId) || c.tribeAId,
    tribeB: tribeNameMap.get(c.tribeBId) || c.tribeBId,
    stage: c.stage,
    firstContactTurn: c.firstContactTurn,
    sentiment: c.relationshipSentiment,
  }));

  // --- AI-Generated Narratives ---
  let worldHistory = "";
  let divergenceAnalysis = "";

  try {
    const majorEvents = (tribe: (typeof report)[0]) =>
      tribe.events.timeline
        .filter(
          (e) => e.severity === "major" || e.severity === "catastrophic"
        )
        .map((e) => e.description);

    const [worldHistoryResult, divergenceResult] = await Promise.all([
      generateText({
        model: proModel,
        messages: [
          {
            role: "user",
            content: buildWorldHistoryPrompt(
              report.map((t) => ({
                name: t.name,
                foundingRules: t.foundingRules,
                currentRules: t.currentRules,
                events: majorEvents(t),
                population: t.population.living,
                ruleChanges: t.ruleChanges.passed,
              }))
            ),
          },
        ],
      }),
      generateText({
        model: proModel,
        messages: [
          {
            role: "user",
            content: buildDivergenceReportPrompt(
              report.map((t) => ({
                name: t.name,
                driftPercentage: t.drift.overallDrift,
                domainDrift: t.drift.domainDrift,
                populationHistory: {
                  born: t.population.total,
                  died: t.population.dead,
                  final: t.population.living,
                },
                ruleChanges: t.ruleChanges.passed,
                keyEvents: majorEvents(t),
              }))
            ),
          },
        ],
      }),
    ]);

    worldHistory = worldHistoryResult.text;
    divergenceAnalysis = divergenceResult.text;
  } catch (err) {
    console.error("Failed to generate AI narratives:", err);
    // Gracefully degrade — report still works without narratives
  }

  const reportData = {
    simulation: {
      id: sim.id,
      name: sim.name,
      totalTurns: sim.currentTurn,
      totalGenerations: sim.currentGeneration,
      councilInterval: sim.councilInterval,
      generationLength: sim.generationLength,
    },
    tribes: report,
    contacts: contactReport,
    worldHistory,
    divergenceAnalysis,
  };

  // Cache the report in DB so subsequent loads are instant
  await db
    .update(simulations)
    .set({ cachedReport: reportData })
    .where(eq(simulations.id, id));

  return NextResponse.json(reportData);
}
