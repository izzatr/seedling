import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { generateText } from "ai";
import { db } from "@/db";
import { agents, tribes, type AgentMemory, type AgentRelationship, type TribeRule } from "@/db/schema";
import { flashModel } from "../ai/models";
import { buildInheritancePrompt } from "../ai/prompts";
import {
  ADULT_AGE,
  BIRTH_CHANCE,
  NATURAL_DEATH_BASE_CHANCE,
  NATURAL_DEATH_INCREMENT,
  POPULATION_SOFT_CAP,
  MIN_TRIBE_SIZE,
  rollLifespan,
  pickRandom,
} from "../constants";
import { generateChildName, inheritTraits } from "../agents/spawner";
import { broadcast } from "./sse";

type LivingAgent = {
  id: string;
  name: string;
  age: number;
  assignedLifespan: number;
  personality: string[];
  values: string[];
  tribeId: string;
};

export async function processAging(
  simulationId: string,
  currentTurn: number
): Promise<void> {
  // Age all living agents by 1
  const living = await db
    .select()
    .from(agents)
    .where(
      and(eq(agents.simulationId, simulationId), eq(agents.status, "alive"))
    );

  for (const agent of living) {
    await db
      .update(agents)
      .set({ age: agent.age + 1 })
      .where(eq(agents.id, agent.id));
  }
}

export async function processDeaths(
  simulationId: string,
  tribeId: string,
  currentTurn: number
): Promise<string[]> {
  const living = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.simulationId, simulationId),
        eq(agents.tribeId, tribeId),
        eq(agents.status, "alive")
      )
    );

  const deaths: string[] = [];

  for (const agent of living) {
    if (agent.age < agent.assignedLifespan) continue;

    const turnsOver = agent.age - agent.assignedLifespan;
    const deathChance =
      NATURAL_DEATH_BASE_CHANCE + turnsOver * NATURAL_DEATH_INCREMENT;

    if (Math.random() < deathChance) {
      await db
        .update(agents)
        .set({
          status: "dead",
          diedTurn: currentTurn,
          causeOfDeath: "natural causes (old age)",
        })
        .where(eq(agents.id, agent.id));

      deaths.push(agent.name);

      broadcast(simulationId, "happening", {
        type: "death",
        tribeId,
        agentName: agent.name,
        age: agent.age,
        cause: "old age",
        turn: currentTurn,
      });
    }
  }

  return deaths;
}

export async function processBirths(
  simulationId: string,
  tribeId: string,
  currentTurn: number
): Promise<string[]> {
  const living = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.simulationId, simulationId),
        eq(agents.tribeId, tribeId),
        eq(agents.status, "alive")
      )
    );

  // Need at least 2 adults
  const adults = living.filter((a) => a.age >= ADULT_AGE);
  if (adults.length < 2) return [];

  const births: string[] = [];

  // Soft cap: birth chance reduces gradually above SOFT_CAP but never hits zero
  const softCapFactor = living.length < POPULATION_SOFT_CAP
    ? 1.0
    : Math.max(0.15, 1.0 - (living.length - POPULATION_SOFT_CAP) * 0.05);
  const adjustedChance = BIRTH_CHANCE * softCapFactor;

  // Multiple adult pairs can produce children each turn
  const possiblePairs = Math.floor(adults.length / 2);
  const birthAttempts = Math.min(possiblePairs, 3); // Up to 3 births per turn

  for (let attempt = 0; attempt < birthAttempts; attempt++) {
    if (Math.random() >= adjustedChance) continue;

    const parentA = pickRandom(adults);
    const parentB = pickRandom(adults.filter((a) => a.id !== parentA.id));
    const childName = generateChildName();
    const childTraits = inheritTraits(
      parentA.personality as string[],
      parentB.personality as string[]
    );

    // Inherit values — use AI for richer cultural transmission
    const parentAValues = parentA.values as string[];
    const parentBValues = parentB.values as string[];
    let childValues: string[];

    try {
      const tribe = await db.select().from(tribes).where(eq(tribes.id, tribeId)).then((r) => r[0]);
      const prompt = buildInheritancePrompt(
        parentAValues, parentBValues,
        (tribe?.rules as TribeRule[]) ?? [],
        [] // recent history placeholder
      );
      const result = await generateText({
        model: flashModel,
        messages: [{ role: "user", content: prompt }],
      });
      const cleaned = result.text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json\n?|```/g, "").trim();
      childValues = JSON.parse(cleaned);
      if (!Array.isArray(childValues) || childValues.length === 0) {
        childValues = blendValues(parentAValues, parentBValues);
      }
    } catch {
      childValues = blendValues(parentAValues, parentBValues);
    }

    const childId = nanoid();
    await db.insert(agents).values({
      id: childId,
      simulationId,
      tribeId,
      name: childName,
      personality: childTraits,
      values: childValues,
      memories: [] as AgentMemory[],
      relationships: [
        {
          agentId: parentA.id,
          name: parentA.name,
          type: "parent",
          sentiment: 0.7,
        },
        {
          agentId: parentB.id,
          name: parentB.name,
          type: "parent",
          sentiment: 0.7,
        },
      ] as AgentRelationship[],
      age: 0,
      assignedLifespan: rollLifespan(),
      parentAId: parentA.id,
      parentBId: parentB.id,
      bornTurn: currentTurn,
      status: "alive",
    });

    births.push(childName);

    broadcast(simulationId, "happening", {
      type: "birth",
      tribeId,
      agentName: childName,
      parents: [parentA.name, parentB.name],
      turn: currentTurn,
    });
  }

  return births;
}

function blendValues(valuesA: string[], valuesB: string[]): string[] {
  const result: string[] = [];

  // Take 2 from parent A
  result.push(pickRandom(valuesA));
  const secondA = pickRandom(valuesA.filter((v) => v !== result[0]));
  if (secondA) result.push(secondA);

  // Take 1-2 from parent B
  const fromB = pickRandom(valuesB.filter((v) => !result.includes(v)));
  if (fromB) result.push(fromB);
  if (Math.random() > 0.5) {
    const secondB = pickRandom(
      valuesB.filter((v) => !result.includes(v))
    );
    if (secondB) result.push(secondB);
  }

  return result.length > 0 ? result : ["The world is full of wonder"];
}

export async function processCrisisDeaths(
  simulationId: string,
  tribeId: string,
  count: number,
  cause: string,
  currentTurn: number
): Promise<string[]> {
  if (count <= 0) return [];

  const living = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.simulationId, simulationId),
        eq(agents.tribeId, tribeId),
        eq(agents.status, "alive")
      )
    );

  if (living.length <= MIN_TRIBE_SIZE) return []; // Prevent collapse

  // Weight by vulnerability: elderly and very young are more vulnerable
  const weighted = living.map((a) => {
    let weight = 1;
    if (a.age > 60) weight += 2; // elderly
    if (a.age < 10) weight += 1.5; // very young
    const personality = a.personality as string[];
    if (personality.includes("reckless")) weight += 1;
    if (personality.includes("cautious")) weight -= 0.5;
    return { agent: a, weight: Math.max(weight, 0.1) };
  });

  const deaths: string[] = [];
  const toKill = Math.min(count, living.length - MIN_TRIBE_SIZE); // Always leave at least MIN_TRIBE_SIZE

  for (let i = 0; i < toKill; i++) {
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    let victim = weighted[0];
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) {
        victim = w;
        break;
      }
    }

    await db
      .update(agents)
      .set({
        status: "dead",
        diedTurn: currentTurn,
        causeOfDeath: cause,
      })
      .where(eq(agents.id, victim.agent.id));

    deaths.push(victim.agent.name);
    // Remove from pool
    const idx = weighted.indexOf(victim);
    if (idx > -1) weighted.splice(idx, 1);

    broadcast(simulationId, "happening", {
      type: "death",
      tribeId,
      agentName: victim.agent.name,
      age: victim.agent.age,
      cause,
      turn: currentTurn,
    });
  }

  return deaths;
}
