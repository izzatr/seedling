import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { tribes, agents, deliberationThreads, turns, turnEvents, ruleChanges } from "@/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; tribeId: string }> }
) {
  const { tribeId } = await params;

  const tribe = await db.select().from(tribes).where(eq(tribes.id, tribeId)).then((r) => r[0]);
  if (!tribe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tribeAgents = await db.select().from(agents).where(eq(agents.tribeId, tribeId));

  // Get all deliberation threads ordered by turn
  const threads = await db
    .select({
      id: deliberationThreads.id,
      turnId: deliberationThreads.turnId,
      messages: deliberationThreads.messages,
      roundCount: deliberationThreads.roundCount,
      turnNumber: turns.turnNumber,
      generationNumber: turns.generationNumber,
      turnType: turns.turnType,
    })
    .from(deliberationThreads)
    .innerJoin(turns, eq(turns.id, deliberationThreads.turnId))
    .where(eq(deliberationThreads.tribeId, tribeId))
    .orderBy(asc(turns.turnNumber));

  // Get world events for this tribe
  const worldEvents = await db
    .select({
      id: turnEvents.id,
      category: turnEvents.eventCategory,
      severity: turnEvents.severity,
      description: turnEvents.description,
      turnNumber: turns.turnNumber,
    })
    .from(turnEvents)
    .innerJoin(turns, eq(turns.id, turnEvents.turnId))
    .where(eq(turnEvents.tribeId, tribeId))
    .orderBy(asc(turns.turnNumber));

  // Derive birth and death events from agent data
  const birthEvents = tribeAgents
    .filter((a) => a.bornTurn > 0) // Skip founders (bornTurn 0)
    .map((a) => ({
      id: `birth-${a.id}`,
      category: "birth" as const,
      severity: "minor" as const,
      description: `${a.name} was born into the tribe.`,
      turnNumber: a.bornTurn,
    }));

  const deathEvents = tribeAgents
    .filter((a) => a.status === "dead" && a.diedTurn != null)
    .map((a) => ({
      id: `death-${a.id}`,
      category: "death" as const,
      severity: "moderate" as const,
      description: `${a.name} (age ${a.age}) died${a.causeOfDeath ? `: ${a.causeOfDeath}` : ""}.`,
      turnNumber: a.diedTurn!,
    }));

  // Merge and sort all events by turn
  const events = [...worldEvents, ...birthEvents, ...deathEvents]
    .sort((a, b) => a.turnNumber - b.turnNumber);

  // Get rule changes for this tribe
  const changes = await db
    .select({
      id: ruleChanges.id,
      oldRule: ruleChanges.oldRule,
      newRule: ruleChanges.newRule,
      domain: ruleChanges.domain,
      passed: ruleChanges.passed,
      voteResult: ruleChanges.voteResult,
      proposedBy: ruleChanges.proposedBy,
      turnNumber: turns.turnNumber,
    })
    .from(ruleChanges)
    .innerJoin(turns, eq(turns.id, ruleChanges.turnId))
    .where(eq(ruleChanges.tribeId, tribeId))
    .orderBy(asc(turns.turnNumber));

  return NextResponse.json({
    tribe: {
      ...tribe,
      agents: tribeAgents,
      livingCount: tribeAgents.filter((a) => a.status === "alive").length,
    },
    threads,
    events,
    ruleChanges: changes,
  });
}
