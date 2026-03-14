import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  simulations,
  tribes,
  agents,
  turns,
  ruleChanges,
  deliberationThreads,
  type TribeRule,
} from "@/db/schema";
import { processAging, processDeaths, processBirths, processCrisisDeaths } from "./population";
import { processEconomy, processStarvation } from "./economy";
import { rollForEvents } from "./events";
import { runDeliberation } from "../agents/deliberation";
import { runVote } from "./governance";
import { broadcast } from "./sse";

// ── Crisis Magnitude Override ──
// During crises, tribes can make one step bigger changes than normal
function upgradeMagnitude(current: "minor" | "small" | "moderate" | "any"): "minor" | "small" | "moderate" | "any" {
  const ladder: ("minor" | "small" | "moderate" | "any")[] = ["minor", "small", "moderate", "any"];
  const idx = ladder.indexOf(current);
  return ladder[Math.min(idx + 1, ladder.length - 1)];
}

// ── Abort Controllers ──

const abortControllers = new Map<string, AbortController>();

export function pauseSimulation(simulationId: string): void {
  abortControllers.get(simulationId)?.abort();
  abortControllers.delete(simulationId);
}

// ── Process a single tribe's turn ──

async function processTribeTurn(
  simulationId: string,
  tribe: typeof tribes.$inferSelect,
  turnId: string,
  turn: number,
  generation: number,
  turnType: "regular" | "council" | "milestone"
) {
  // 1. Age all agents in this tribe
  const living = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.simulationId, simulationId),
        eq(agents.tribeId, tribe.id),
        eq(agents.status, "alive")
      )
    );

  // Batch age update
  if (living.length > 0) {
    await Promise.all(
      living.map((a) =>
        db.update(agents).set({ age: a.age + 1 }).where(eq(agents.id, a.id))
      )
    );
  }

  // 2. Economy — production, contribution, distribution, consumption
  const economy = await processEconomy(simulationId, tribe.id, turnId, turn);

  // 3. Deaths (natural + starvation) + Births
  const [naturalDeaths, starvationDeaths, births] = await Promise.all([
    processDeaths(simulationId, tribe.id, turn),
    processStarvation(simulationId, tribe.id, turn),
    processBirths(simulationId, tribe.id, turn),
  ]);
  const deaths = [...naturalDeaths, ...starvationDeaths];

  // 4. Roll for events
  const events = await rollForEvents(
    simulationId, turnId, tribe.id, tribe.name,
    tribe.rules as TribeRule[], turnType, turn
  );

  // 4. Apply event effects
  for (const event of events) {
    const effectPromises: Promise<unknown>[] = [];

    if (event.effects.populationChange && event.effects.populationChange < 0) {
      effectPromises.push(
        processCrisisDeaths(simulationId, tribe.id, Math.abs(event.effects.populationChange), event.description, turn)
      );
    }

    if (event.effects.resourceChange) {
      const res = tribe.resources as { food: number; materials: number; capacity: number };
      effectPromises.push(
        db.update(tribes).set({
          resources: {
            food: Math.max(0, res.food + (event.effects.resourceChange.food ?? 0)),
            materials: Math.max(0, res.materials + (event.effects.resourceChange.materials ?? 0)),
            capacity: res.capacity,
          },
        }).where(eq(tribes.id, tribe.id))
      );
    }

    if (event.effects.techLevelChange) {
      effectPromises.push(
        db.update(tribes).set({ techLevel: tribe.techLevel + event.effects.techLevelChange }).where(eq(tribes.id, tribe.id))
      );
    }

    await Promise.all(effectPromises);
  }

  // 5. Council deliberation (only on council/milestone turns)
  if (turnType === "council" || turnType === "milestone") {
    const livingNow = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.simulationId, simulationId),
          eq(agents.tribeId, tribe.id),
          eq(agents.status, "alive")
        )
      );

    // Speaking: age >= 10 (children can observe and share feelings)
    // Voting: age >= 15 (adults only)
    const speakingAgents = livingNow.filter((a) => a.age >= 10);
    const votingAgents = livingNow.filter((a) => a.age >= 15);

    if (speakingAgents.length >= 2) {
      const eventSummaries = events.map((e) => e.description);
      const economyContext = [
        economy.hungry.length > 0 ? `${economy.hungry.length} members are going hungry (${economy.hungry.join(", ")}).` : "Everyone is well-fed.",
        `Average wealth: ${economy.avgWealth.toFixed(1)}. Inequality index: ${(economy.inequality * 100).toFixed(0)}%.`,
        economy.starving.length > 0 ? `WARNING: ${economy.starving.join(", ")} are starving and may die!` : "",
      ].filter(Boolean).join(" ");

      const context = [
        `Turn ${turn}, Generation ${generation}.`,
        deaths.length > 0 ? `The tribe mourns the loss of ${deaths.join(", ")}.` : "",
        births.length > 0 ? `New members have joined: ${births.join(", ")}.` : "",
        ...eventSummaries,
        `Population: ${livingNow.length} members.`,
        `ECONOMY: ${economyContext}`,
      ].filter(Boolean).join(" ");

      const recentHistory = eventSummaries.length > 0
        ? eventSummaries
        : [`Turn ${turn}: The tribe continues its daily life.`];

      const mapAgent = (a: typeof livingNow[number]) => ({
        id: a.id,
        name: a.name,
        age: a.age,
        personality: a.personality as string[],
        values: a.values as string[],
        personalResources: a.personalResources as { food: number; wealth: number } | undefined,
        memories: a.memories as { turn: number; summary: string }[],
        relationships: a.relationships as {
          agentId: string; name: string;
          type: "parent" | "child" | "partner" | "ally" | "rival" | "neutral";
          sentiment: number;
        }[],
      });

      // Run deliberation — all speaking-age agents participate (age >= 10)
      const delib = await runDeliberation(
        simulationId,
        { id: tribe.id, name: tribe.name, rules: tribe.rules as TribeRule[], governanceModel: tribe.governanceModel },
        speakingAgents.map(mapAgent), context, recentHistory
      );

      // Save thread
      await db.insert(deliberationThreads).values({
        id: nanoid(), turnId, tribeId: tribe.id,
        messages: delib.messages, roundCount: delib.roundCount,
      });

      // Process all proposals — only adults (age >= 15) can vote
      const passedProposals: string[] = [];
      for (const proposal of delib.proposals) {
        broadcast(simulationId, "happening", {
          type: "proposal", tribeId: tribe.id, tribeName: tribe.name,
          agentName: proposal.agentName, ruleText: proposal.ruleText,
          domain: proposal.domain, turn,
        });

        // During crises, loosen magnitude constraints — desperate times call for bold measures
        const inCrisis = economy.hungry.length > 0 || economy.starving.length > 0 || events.length > 0;
        const effectiveMagnitude = inCrisis
          ? upgradeMagnitude(tribe.changeMagnitude as "minor" | "small" | "moderate" | "any")
          : tribe.changeMagnitude;

        const voteResult = await runVote(
          {
            name: tribe.name, rules: tribe.rules as TribeRule[],
            governanceModel: tribe.governanceModel,
            votingThreshold: tribe.votingThreshold, changeMagnitude: effectiveMagnitude,
          },
          votingAgents.map(mapAgent), proposal
        );

        await db.insert(ruleChanges).values({
          id: nanoid(), turnId, tribeId: tribe.id,
          proposedBy: proposal.agentId,
          oldRule: proposal.replacesRule ?? null,
          newRule: proposal.ruleText,
          domain: proposal.domain as "governance" | "economy" | "social" | "cultural" | "external",
          voteResult: voteResult.votes, passed: voteResult.passed,
        });

        if (voteResult.passed) {
          passedProposals.push(proposal.action === "remove" ? `REMOVED: "${proposal.ruleText}"` : proposal.ruleText);
          const currentRules = tribe.rules as TribeRule[];
          let newRules: TribeRule[];

          if (proposal.action === "remove") {
            // Remove the rule (fuzzy match — find closest)
            const target = proposal.ruleText.toLowerCase();
            newRules = currentRules.filter((r) => !r.text.toLowerCase().includes(target) && target !== r.text.toLowerCase());
            if (newRules.length === currentRules.length) {
              // Fuzzy: remove first rule containing key words
              const words = target.split(/\s+/).filter((w) => w.length > 4);
              newRules = currentRules.filter((r) => !words.some((w) => r.text.toLowerCase().includes(w)));
            }
          } else if (proposal.action === "replace" && proposal.replacesRule) {
            const target = proposal.replacesRule.toLowerCase();
            newRules = currentRules.map((r) =>
              r.text.toLowerCase().includes(target) || target.includes(r.text.toLowerCase())
                ? { domain: proposal.domain as TribeRule["domain"], text: proposal.ruleText }
                : r
            );
          } else {
            // Add
            newRules = [...currentRules, { domain: proposal.domain as TribeRule["domain"], text: proposal.ruleText }];
          }

          await db.update(tribes).set({ rules: newRules }).where(eq(tribes.id, tribe.id));

          broadcast(simulationId, "happening", {
            type: "rule_change", tribeId: tribe.id, tribeName: tribe.name,
            newRule: proposal.action === "remove" ? `REMOVED: ${proposal.ruleText}` : proposal.ruleText,
            domain: proposal.domain, passed: true, turn,
            action: proposal.action,
          });
        }
      }

      // Batch memory update — richer memories of what actually happened
      const proposalSummaries = delib.proposals.map((p) => {
        const passed = passedProposals.includes(p.ruleText);
        return `${p.agentName} proposed "${p.ruleText}" — ${passed ? "PASSED" : "REJECTED"}`;
      });
      const councilSummary = [
        `Council convened (Turn ${turn}).`,
        events.length > 0 ? events.map((e) => e.description).join(". ") : null,
        deaths.length > 0 ? `Lost: ${deaths.join(", ")}.` : null,
        births.length > 0 ? `Born: ${births.join(", ")}.` : null,
        proposalSummaries.length > 0 ? proposalSummaries.join(". ") : "No proposals made.",
        `Population: ${livingNow.length}.`,
      ].filter(Boolean).join(" ");
      await Promise.all(
        speakingAgents.map((agent) => {
          const mem = (agent.memories as { turn: number; summary: string }[]) ?? [];
          return db.update(agents).set({
            memories: [...mem, { turn, summary: councilSummary }],
          }).where(eq(agents.id, agent.id));
        })
      );
    }
  }
}

// ── Main Loop ──

export async function startSimulationLoop(simulationId: string): Promise<void> {
  if (abortControllers.has(simulationId)) return;

  const controller = new AbortController();
  abortControllers.set(simulationId, controller);

  try {
    await db.update(simulations).set({ status: "running" }).where(eq(simulations.id, simulationId));

    const sim = await db.select().from(simulations).where(eq(simulations.id, simulationId)).then((r) => r[0]);
    if (!sim) throw new Error("Simulation not found");

    const maxTurns = (sim.config.generationLimit ?? 5) * (sim.generationLength ?? 25);

    for (let turn = sim.currentTurn + 1; turn <= maxTurns; turn++) {
      if (controller.signal.aborted) break;

      const isGenerationMilestone = turn > 0 && turn % sim.generationLength === 0;
      const isCouncilTurn = turn > 0 && turn % sim.councilInterval === 0;
      const turnType = isGenerationMilestone ? "milestone" : isCouncilTurn ? "council" : "regular";
      const generation = Math.floor(turn / sim.generationLength) + 1;

      const turnId = nanoid();
      await db.insert(turns).values({ id: turnId, simulationId, turnNumber: turn, generationNumber: generation, turnType });

      broadcast(simulationId, "turn_start", { turnNumber: turn, generation, turnType });

      const allTribes = await db.select().from(tribes).where(eq(tribes.simulationId, simulationId));

      // ── Process tribes one at a time to stay within 4M TPM limit ──
      for (const tribe of allTribes) {
        if (controller.signal.aborted) break;
        await processTribeTurn(simulationId, tribe, turnId, turn, generation, turnType);
      }

      if (turnType === "milestone") {
        await db.update(simulations).set({ currentGeneration: generation }).where(eq(simulations.id, simulationId));
      }

      await db.update(simulations).set({ currentTurn: turn }).where(eq(simulations.id, simulationId));

      // Broadcast turn complete with tribe summaries
      const updatedTribes = await db.select().from(tribes).where(eq(tribes.simulationId, simulationId));
      const tribeSummaries = await Promise.all(
        updatedTribes.map(async (t) => ({
          id: t.id,
          name: t.name,
          population: await db.select().from(agents)
            .where(and(eq(agents.tribeId, t.id), eq(agents.status, "alive")))
            .then((r) => r.length),
          techLevel: t.techLevel,
        }))
      );

      broadcast(simulationId, "turn_complete", {
        turnNumber: turn,
        generation: Math.floor(turn / sim.generationLength) + 1,
        turnType, tribes: tribeSummaries,
      });

      // Minimal delay — just enough for SSE to flush
      if (turnType !== "regular") {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    await db.update(simulations).set({ status: "completed" }).where(eq(simulations.id, simulationId));
    broadcast(simulationId, "simulation_complete", { simulationId });
  } catch (error) {
    console.error("Simulation error:", error);
    broadcast(simulationId, "simulation_error", { error: error instanceof Error ? error.message : "Unknown error" });
    await db.update(simulations).set({ status: "paused" }).where(eq(simulations.id, simulationId));
  } finally {
    abortControllers.delete(simulationId);
  }
}
