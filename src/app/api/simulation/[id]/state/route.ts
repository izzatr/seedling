import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { simulations, tribes, agents, turnEvents, turns } from "@/db/schema";

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

  const allTribes = await db
    .select()
    .from(tribes)
    .where(eq(tribes.simulationId, id));

  const tribesWithAgents = await Promise.all(
    allTribes.map(async (tribe) => {
      const tribeAgents = await db
        .select()
        .from(agents)
        .where(eq(agents.tribeId, tribe.id));

      const living = tribeAgents.filter((a) => a.status === "alive");

      // Economic summary
      const personalResources = living.map(
        (a) => (a.personalResources as { food: number; wealth: number }) ?? { food: 0, wealth: 0 }
      );
      const avgFood = personalResources.length > 0
        ? personalResources.reduce((s, r) => s + r.food, 0) / personalResources.length
        : 0;
      const avgWealth = personalResources.length > 0
        ? personalResources.reduce((s, r) => s + r.wealth, 0) / personalResources.length
        : 0;
      const hungry = personalResources.filter((r) => r.food < 3).length;

      return {
        ...tribe,
        agents: tribeAgents,
        livingCount: living.length,
        economy: {
          avgFood: Math.round(avgFood * 10) / 10,
          avgWealth: Math.round(avgWealth * 10) / 10,
          hungry,
          communalPool: tribe.communalPool ?? { food: 0, wealth: 0 },
        },
      };
    })
  );

  // Recent events (last 20)
  const recentTurns = await db
    .select()
    .from(turns)
    .where(eq(turns.simulationId, id))
    .orderBy(desc(turns.turnNumber))
    .limit(5);

  const recentEvents = recentTurns.length > 0
    ? await db
        .select()
        .from(turnEvents)
        .where(
          eq(
            turnEvents.turnId,
            recentTurns.map((t) => t.id)[0]
          )
        )
        .limit(20)
    : [];

  return NextResponse.json({
    simulation: {
      id: sim.id,
      name: sim.name,
      status: sim.status,
      currentTurn: sim.currentTurn,
      currentGeneration: sim.currentGeneration,
      councilInterval: sim.councilInterval,
      generationLength: sim.generationLength,
      config: sim.config,
    },
    tribes: tribesWithAgents,
    recentEvents,
  });
}
