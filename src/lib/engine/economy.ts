import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { agents, tribes, type TribeRule, type AgentResources } from "@/db/schema";
import { broadcast } from "./sse";

// ── Constants ──

const FOOD_CONSUMPTION_PER_TURN = 1;      // Each agent eats 1 food per turn
const BASE_FOOD_PRODUCTION = 3;            // Base food gathered per turn per adult
const BASE_WEALTH_PRODUCTION = 1;          // Base wealth generated per turn per adult
const CHILD_PRODUCTION_FACTOR = 0.3;       // Children produce 30% of adult rate
const HUNGER_THRESHOLD = 3;                // Below this, agent is "hungry"
const STARVATION_THRESHOLD = 0;            // At 0 food, risk of death

// ── Production Modifiers by Personality ──

const PRODUCTION_BONUSES: Record<string, number> = {
  industrious: 0.4, hardworking: 0.4, reliable: 0.3,
  creative: 0.2, innovative: 0.2, inventive: 0.2,
  pragmatic: 0.2, resourceful: 0.3, sturdy: 0.2,
  generous: -0.1, // gives away more, keeps less
  lazy: -0.3, detached: -0.2, contemplative: -0.1,
};

function getProductionMultiplier(personality: string[], age: number, techLevel: number): number {
  let mult = 1.0;

  // Age factor: young adults (18-40) most productive
  if (age < 10) mult *= 0.1;       // tiny children barely contribute
  else if (age < 15) mult *= CHILD_PRODUCTION_FACTOR;
  else if (age < 20) mult *= 0.7;  // teens learning
  else if (age <= 40) mult *= 1.0;  // prime
  else if (age <= 60) mult *= 0.8;  // experienced but slowing
  else mult *= 0.5;                  // elders — wisdom, less labor

  // Personality bonuses
  for (const trait of personality) {
    mult += PRODUCTION_BONUSES[trait] ?? 0;
  }

  // Tech level bonus (+10% per level above 1)
  mult *= 1 + (techLevel - 1) * 0.1;

  return Math.max(0.1, mult); // minimum 10% production
}

// ── Determine Economic Policy from Rules ──

type EconomicPolicy = {
  contributionRate: number;  // 0-1: how much agents give to communal pool
  distributionMode: "equal" | "need" | "merit" | "none";
};

function inferEconomicPolicy(rules: TribeRule[]): EconomicPolicy {
  const economyRules = rules
    .filter((r) => r.domain === "economy")
    .map((r) => r.text.toLowerCase())
    .join(" ");

  // Detect contribution level
  let contributionRate = 0.1; // default: minimal tax
  if (/all.*communal|stored communally|everything.*shared|common store/i.test(economyRules)) {
    contributionRate = 0.8; // near-total communalism
  } else if (/one-fifth|20%|contribute.*portion|tax|tithe/i.test(economyRules)) {
    contributionRate = 0.2;
  } else if (/voluntary|encouraged|choice|not.*obligation/i.test(economyRules)) {
    contributionRate = 0.05; // very little required
  } else if (/no.*fixed|own what|individual/i.test(economyRules)) {
    contributionRate = 0.02; // almost nothing
  }

  // Detect distribution mode
  let distributionMode: EconomicPolicy["distributionMode"] = "equal";
  if (/need|hunger|starving|those who lack/i.test(economyRules)) {
    distributionMode = "need";
  } else if (/merit|contribution|earn|reward/i.test(economyRules)) {
    distributionMode = "merit";
  } else if (/no.*obligation|keep.*own|individual/i.test(economyRules)) {
    distributionMode = "none";
  }

  return { contributionRate, distributionMode };
}

// ── Main Economy Processing ──

export async function processEconomy(
  simulationId: string,
  tribeId: string,
  currentTurn: number
): Promise<{ hungry: string[]; starving: string[]; avgWealth: number; inequality: number }> {
  const tribe = await db.select().from(tribes).where(eq(tribes.id, tribeId)).then((r) => r[0]);
  if (!tribe) return { hungry: [], starving: [], avgWealth: 0, inequality: 0 };

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

  if (living.length === 0) return { hungry: [], starving: [], avgWealth: 0, inequality: 0 };

  const policy = inferEconomicPolicy(tribe.rules as TribeRule[]);
  const communalPool = (tribe.communalPool as { food: number; wealth: number }) ?? { food: 0, wealth: 0 };
  let poolFood = communalPool.food;
  let poolWealth = communalPool.wealth;

  // ── Phase 1: Production ──
  // Each agent produces resources based on their capabilities
  const updates: { id: string; resources: AgentResources; name: string }[] = [];

  for (const agent of living) {
    const res = (agent.personalResources as AgentResources) ?? { food: 10, wealth: 0 };
    const mult = getProductionMultiplier(
      agent.personality as string[],
      agent.age,
      tribe.techLevel
    );

    const foodProduced = Math.round(BASE_FOOD_PRODUCTION * mult);
    const wealthProduced = Math.round(BASE_WEALTH_PRODUCTION * mult * 10) / 10;

    // ── Phase 2: Contribution to communal pool ──
    const foodContribution = Math.floor(foodProduced * policy.contributionRate);
    const wealthContribution = Math.round(wealthProduced * policy.contributionRate * 10) / 10;

    poolFood += foodContribution;
    poolWealth += wealthContribution;

    // Agent keeps the rest
    const newFood = res.food + (foodProduced - foodContribution);
    const newWealth = res.wealth + (wealthProduced - wealthContribution);

    updates.push({
      id: agent.id,
      name: agent.name,
      resources: { food: newFood, wealth: newWealth },
    });
  }

  // ── Phase 3: Consumption ──
  for (const u of updates) {
    u.resources.food -= FOOD_CONSUMPTION_PER_TURN;
  }

  // ── Phase 4: Distribution from communal pool ──
  if (policy.distributionMode !== "none" && poolFood > 0) {
    if (policy.distributionMode === "equal") {
      // Equal shares
      const shareFood = Math.floor(poolFood / living.length);
      const shareWealth = Math.round((poolWealth / living.length) * 10) / 10;
      for (const u of updates) {
        u.resources.food += shareFood;
        u.resources.wealth += shareWealth;
      }
      poolFood = poolFood % living.length; // remainder stays in pool
      poolWealth = 0;
    } else if (policy.distributionMode === "need") {
      // Give to those below hunger threshold first
      const needy = updates.filter((u) => u.resources.food < HUNGER_THRESHOLD);
      if (needy.length > 0) {
        const perNeedy = Math.floor(poolFood / needy.length);
        for (const u of needy) {
          u.resources.food += perNeedy;
        }
        poolFood = poolFood % Math.max(1, needy.length);
      }
      // Distribute wealth equally
      const shareWealth = Math.round((poolWealth / living.length) * 10) / 10;
      for (const u of updates) {
        u.resources.wealth += shareWealth;
      }
      poolWealth = 0;
    } else if (policy.distributionMode === "merit") {
      // Proportional to what they contributed (simplified: by production multiplier)
      const totalMult = living.reduce(
        (sum, a) =>
          sum + getProductionMultiplier(a.personality as string[], a.age, tribe.techLevel),
        0
      );
      for (let i = 0; i < updates.length; i++) {
        const agentMult = getProductionMultiplier(
          living[i].personality as string[],
          living[i].age,
          tribe.techLevel
        );
        const share = agentMult / totalMult;
        updates[i].resources.food += Math.floor(poolFood * share);
        updates[i].resources.wealth += Math.round(poolWealth * share * 10) / 10;
      }
      poolFood = 0;
      poolWealth = 0;
    }
  }

  // ── Phase 5: Family sharing ──
  // Parents share with hungry children
  for (const u of updates) {
    if (u.resources.food < HUNGER_THRESHOLD) {
      const agent = living.find((a) => a.id === u.id);
      if (!agent) continue;
      const rels = (agent.relationships as { agentId: string; type: string }[]) ?? [];
      const parentIds = rels.filter((r) => r.type === "parent").map((r) => r.agentId);
      for (const parentId of parentIds) {
        const parent = updates.find((p) => p.id === parentId);
        if (parent && parent.resources.food > HUNGER_THRESHOLD + 2) {
          const gift = Math.min(3, parent.resources.food - HUNGER_THRESHOLD);
          parent.resources.food -= gift;
          u.resources.food += gift;
          break;
        }
      }
    }
  }

  // ── Phase 6: Persist ──
  // Ensure no negative food
  for (const u of updates) {
    u.resources.food = Math.max(0, u.resources.food);
    u.resources.wealth = Math.max(0, Math.round(u.resources.wealth * 10) / 10);
  }

  await Promise.all(
    updates.map((u) =>
      db.update(agents).set({ personalResources: u.resources }).where(eq(agents.id, u.id))
    )
  );

  // Update communal pool
  await db.update(tribes).set({
    communalPool: { food: Math.max(0, poolFood), wealth: Math.max(0, poolWealth) },
  }).where(eq(tribes.id, tribeId));

  // ── Phase 7: Calculate metrics ──
  const hungry = updates.filter((u) => u.resources.food < HUNGER_THRESHOLD).map((u) => u.name);
  const starving = updates.filter((u) => u.resources.food <= STARVATION_THRESHOLD).map((u) => u.name);

  const allWealth = updates.map((u) => u.resources.wealth);
  const avgWealth = allWealth.reduce((s, w) => s + w, 0) / allWealth.length;

  // Gini coefficient (simplified)
  const sorted = [...allWealth].sort((a, b) => a - b);
  const n = sorted.length;
  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    giniSum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  const totalWealth = sorted.reduce((s, w) => s + w, 0);
  const inequality = totalWealth > 0 ? giniSum / (n * totalWealth) : 0;

  // Broadcast if people are hungry
  if (hungry.length > 0) {
    broadcast(simulationId, "happening", {
      type: "event",
      tribeId,
      tribeName: tribe.name,
      category: "economy",
      description: `${hungry.length} member${hungry.length > 1 ? "s" : ""} ${hungry.length > 1 ? "are" : "is"} going hungry. Food is scarce.`,
      severity: starving.length > 0 ? "major" : "moderate",
      turn: currentTurn,
    });
  }

  return { hungry, starving, avgWealth, inequality };
}

// ── Starvation Deaths ──

export async function processStarvation(
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
    const res = (agent.personalResources as AgentResources) ?? { food: 10, wealth: 0 };
    // Only die of starvation if food has been at 0 (10% chance per turn at 0 food)
    if (res.food <= 0 && living.length - deaths.length > 4) {
      if (Math.random() < 0.4) {
        await db.update(agents).set({
          status: "dead",
          diedTurn: currentTurn,
          causeOfDeath: "starvation",
        }).where(eq(agents.id, agent.id));

        deaths.push(agent.name);
        broadcast(simulationId, "happening", {
          type: "death",
          tribeId,
          agentName: agent.name,
          age: agent.age,
          cause: "starvation",
          turn: currentTurn,
        });
      }
    }
  }

  return deaths;
}
