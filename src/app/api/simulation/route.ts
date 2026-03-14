import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { simulations, tribes } from "@/db/schema";
import {
  DEFAULT_TRIBES,
  DEFAULT_COUNCIL_INTERVAL,
  DEFAULT_GENERATION_LENGTH,
  DEFAULT_GENERATION_LIMIT,
} from "@/lib/constants";
import { spawnFoundingAgents } from "@/lib/agents/spawner";

export async function POST() {
  try {
    const simulationId = nanoid();

    // Create simulation
    await db.insert(simulations).values({
      id: simulationId,
      name: `Simulation ${new Date().toLocaleDateString()}`,
      config: {
        tribeCount: 4,
        populationCap: 50, // soft cap, no hard limit
        generationLimit: DEFAULT_GENERATION_LIMIT,
        councilInterval: DEFAULT_COUNCIL_INTERVAL,
        generationLength: DEFAULT_GENERATION_LENGTH,
      },
      status: "setup",
      currentTurn: 0,
      currentGeneration: 1,
      councilInterval: DEFAULT_COUNCIL_INTERVAL,
      generationLength: DEFAULT_GENERATION_LENGTH,
    });

    // Create tribes and founding agents
    for (const tribeDef of DEFAULT_TRIBES) {
      const tribeId = nanoid();

      await db.insert(tribes).values({
        id: tribeId,
        simulationId,
        name: tribeDef.name,
        rules: tribeDef.rules,
        foundingRules: tribeDef.rules,
        governanceModel: tribeDef.governanceModel,
        votingThreshold: tribeDef.votingThreshold,
        changeMagnitude: tribeDef.changeMagnitude,
        techLevel: 1,
        resources: { food: 100, materials: 50, capacity: 30 },
        communalPool: { food: 50, wealth: 0 },
        foundedTurn: 0,
      });

      await spawnFoundingAgents(simulationId, tribeId, tribeDef);
    }

    return NextResponse.json({ id: simulationId });
  } catch (error) {
    console.error("Failed to create simulation:", error);
    return NextResponse.json(
      { error: "Failed to create simulation" },
      { status: 500 }
    );
  }
}
