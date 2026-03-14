import { nanoid } from "nanoid";
import { db } from "@/db";
import { agents } from "@/db/schema";
import {
  rollLifespan,
  pickRandom,
  randomBetween,
  type TribeDefinition,
} from "../constants";

const CHILD_NAMES_PREFIXES = [
  "Young",
  "Swift",
  "Bright",
  "Little",
  "Dawn",
  "River",
  "Star",
  "Moon",
  "Storm",
  "Ash",
  "Ember",
  "Frost",
  "Sage",
  "Thorn",
  "Reed",
  "Coral",
  "Wren",
  "Flint",
  "Ivy",
  "Birch",
];

const CHILD_NAMES_SUFFIXES = [
  "walker",
  "song",
  "wind",
  "heart",
  "born",
  "shade",
  "light",
  "bloom",
  "crest",
  "fall",
  "spark",
  "vale",
  "stone",
  "weave",
  "tide",
  "leaf",
  "flame",
  "brook",
  "pine",
  "moss",
];

const ALL_TRAITS = [
  "cautious",
  "bold",
  "empathetic",
  "analytical",
  "rebellious",
  "loyal",
  "creative",
  "pragmatic",
  "idealistic",
  "stoic",
  "passionate",
  "curious",
  "traditional",
  "innovative",
  "diplomatic",
  "blunt",
  "patient",
  "restless",
  "generous",
  "self-reliant",
];

export async function spawnFoundingAgents(
  simulationId: string,
  tribeId: string,
  tribeDef: TribeDefinition
): Promise<void> {
  const agentRows = tribeDef.founderNames.map((name, i) => {
    const age = randomBetween(20, 40);
    // Ensure lifespan is always at least 30 turns beyond current age
    const minLifespan = age + 30;
    let lifespan = rollLifespan();
    while (lifespan < minLifespan) {
      lifespan = rollLifespan();
    }
    return {
      id: nanoid(),
      simulationId,
      tribeId,
      name,
      personality: tribeDef.founderPersonalities[i],
      values: generateFounderValues(tribeDef),
      memories: [],
      relationships: [],
      personalResources: { food: 15, wealth: 5 },
      age,
      assignedLifespan: lifespan,
      bornTurn: 0,
      status: "alive" as const,
    };
  });

  await db.insert(agents).values(agentRows);
}

function generateFounderValues(tribeDef: TribeDefinition): string[] {
  // Founders' values are directly derived from their tribe's rules
  const ruleTexts = tribeDef.rules.map((r) => r.text);
  const values: string[] = [];

  // Take 2-3 rule-inspired values
  const picked = new Set<number>();
  while (values.length < 3 && picked.size < ruleTexts.length) {
    const idx = Math.floor(Math.random() * ruleTexts.length);
    if (!picked.has(idx)) {
      picked.add(idx);
      values.push(shortenRule(ruleTexts[idx]));
    }
  }

  // Add 1-2 personal values
  const personalValues = [
    "Family is the foundation of everything",
    "Strength comes from unity",
    "Every person deserves to be heard",
    "The land provides if we respect it",
    "Knowledge is the greatest treasure",
    "Actions speak louder than words",
    "Trust must be earned, not assumed",
    "Change is neither good nor bad — it simply is",
    "The young must learn from the old",
    "Courage means doing what is right, even when afraid",
  ];

  values.push(pickRandom(personalValues));
  if (Math.random() > 0.5) values.push(pickRandom(personalValues));

  return values;
}

function shortenRule(rule: string): string {
  // Convert a long rule into a personal belief
  if (rule.length > 80) {
    return rule.substring(0, rule.indexOf(".") + 1) || rule.substring(0, 80);
  }
  return rule;
}

export function generateChildName(): string {
  return `${pickRandom(CHILD_NAMES_PREFIXES)} ${pickRandom(CHILD_NAMES_SUFFIXES)}`;
}

export function inheritTraits(
  parentA: string[],
  parentB: string[]
): string[] {
  const traits: string[] = [];

  // Take 1-2 from each parent
  traits.push(pickRandom(parentA));
  traits.push(pickRandom(parentB));

  // Chance of a new trait
  if (Math.random() > 0.5) {
    const newTrait = pickRandom(
      ALL_TRAITS.filter((t) => !traits.includes(t))
    );
    traits.push(newTrait);
  }

  return traits;
}
