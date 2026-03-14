import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
  real,
} from "drizzle-orm/pg-core";

// ── Enums ──

export const simulationStatusEnum = pgEnum("simulation_status", [
  "setup",
  "running",
  "paused",
  "completed",
]);

export const turnTypeEnum = pgEnum("turn_type", [
  "regular",
  "council",
  "milestone",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "alive",
  "dead",
  "exiled",
]);

export const eventCategoryEnum = pgEnum("event_category", [
  "scarcity",
  "abundance",
  "disaster",
  "discovery",
  "internal_conflict",
  "external",
  "cultural",
  "mystery",
]);

export const severityEnum = pgEnum("severity", [
  "minor",
  "moderate",
  "major",
  "catastrophic",
]);

export const ruleDomainEnum = pgEnum("rule_domain", [
  "governance",
  "economy",
  "social",
  "cultural",
  "external",
]);

export const contactStageEnum = pgEnum("contact_stage", [
  "awareness",
  "observation",
  "diplomacy",
  "trade",
  "deep",
]);

export const changeMagnitudeEnum = pgEnum("change_magnitude", [
  "minor",
  "small",
  "moderate",
  "any",
]);

// ── Tables ──

export const simulations = pgTable("simulations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  config: jsonb("config").$type<SimulationConfig>().notNull(),
  status: simulationStatusEnum("status").notNull().default("setup"),
  currentTurn: integer("current_turn").notNull().default(0),
  currentGeneration: integer("current_generation").notNull().default(1),
  councilInterval: integer("council_interval").notNull().default(4),
  generationLength: integer("generation_length").notNull().default(25),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  cachedReport: jsonb("cached_report"),
});

export const tribes = pgTable("tribes", {
  id: text("id").primaryKey(),
  simulationId: text("simulation_id")
    .notNull()
    .references(() => simulations.id),
  name: text("name").notNull(),
  rules: jsonb("rules").$type<TribeRule[]>().notNull(),
  foundingRules: jsonb("founding_rules").$type<TribeRule[]>().notNull(),
  governanceModel: text("governance_model").notNull(),
  votingThreshold: real("voting_threshold").notNull(),
  changeMagnitude: changeMagnitudeEnum("change_magnitude").notNull(),
  techLevel: integer("tech_level").notNull().default(1),
  resources: jsonb("resources")
    .$type<{ food: number; materials: number; capacity: number }>()
    .notNull(),
  communalPool: jsonb("communal_pool")
    .$type<{ food: number; wealth: number }>()
    .notNull()
    .default({ food: 0, wealth: 0 }),
  foundedTurn: integer("founded_turn").notNull().default(0),
});

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  simulationId: text("simulation_id")
    .notNull()
    .references(() => simulations.id),
  tribeId: text("tribe_id")
    .notNull()
    .references(() => tribes.id),
  name: text("name").notNull(),
  personality: jsonb("personality").$type<string[]>().notNull(),
  values: jsonb("values").$type<string[]>().notNull(),
  memories: jsonb("memories").$type<AgentMemory[]>().notNull().default([]),
  relationships: jsonb("relationships")
    .$type<AgentRelationship[]>()
    .notNull()
    .default([]),
  personalResources: jsonb("personal_resources")
    .$type<AgentResources>()
    .notNull()
    .default({ food: 10, wealth: 0 }),
  age: integer("age").notNull().default(0),
  assignedLifespan: integer("assigned_lifespan").notNull(),
  parentAId: text("parent_a_id"),
  parentBId: text("parent_b_id"),
  bornTurn: integer("born_turn").notNull().default(0),
  diedTurn: integer("died_turn"),
  status: agentStatusEnum("status").notNull().default("alive"),
  causeOfDeath: text("cause_of_death"),
});

export const turns = pgTable("turns", {
  id: text("id").primaryKey(),
  simulationId: text("simulation_id")
    .notNull()
    .references(() => simulations.id),
  turnNumber: integer("turn_number").notNull(),
  generationNumber: integer("generation_number").notNull(),
  turnType: turnTypeEnum("turn_type").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const turnEvents = pgTable("turn_events", {
  id: text("id").primaryKey(),
  turnId: text("turn_id")
    .notNull()
    .references(() => turns.id),
  tribeId: text("tribe_id")
    .notNull()
    .references(() => tribes.id),
  eventCategory: eventCategoryEnum("event_category").notNull(),
  severity: severityEnum("severity").notNull(),
  description: text("description").notNull(),
  effects: jsonb("effects").$type<EventEffects>().notNull(),
});

export const economySnapshots = pgTable("economy_snapshots", {
  id: text("id").primaryKey(),
  turnId: text("turn_id")
    .notNull()
    .references(() => turns.id),
  tribeId: text("tribe_id")
    .notNull()
    .references(() => tribes.id),
  turnNumber: integer("turn_number").notNull(),
  population: integer("population").notNull(),
  avgFood: real("avg_food").notNull(),
  avgWealth: real("avg_wealth").notNull(),
  totalFood: real("total_food").notNull(),
  totalWealth: real("total_wealth").notNull(),
  hungryCount: integer("hungry_count").notNull(),
  starvingCount: integer("starving_count").notNull(),
  communalFood: real("communal_food").notNull(),
  communalWealth: real("communal_wealth").notNull(),
  inequality: real("inequality").notNull(), // Gini coefficient 0-1
  contributionRate: real("contribution_rate").notNull(),
});

export const ruleChanges = pgTable("rule_changes", {
  id: text("id").primaryKey(),
  turnId: text("turn_id")
    .notNull()
    .references(() => turns.id),
  tribeId: text("tribe_id")
    .notNull()
    .references(() => tribes.id),
  proposedBy: text("proposed_by").references(() => agents.id),
  oldRule: text("old_rule"),
  newRule: text("new_rule").notNull(),
  domain: ruleDomainEnum("domain").notNull(),
  voteResult: jsonb("vote_result").$type<VoteRecord[]>().notNull(),
  passed: boolean("passed").notNull(),
});

export const deliberationThreads = pgTable("deliberation_threads", {
  id: text("id").primaryKey(),
  turnId: text("turn_id")
    .notNull()
    .references(() => turns.id),
  tribeId: text("tribe_id")
    .notNull()
    .references(() => tribes.id),
  messages: jsonb("messages").$type<ThreadMessage[]>().notNull(),
  roundCount: integer("round_count").notNull(),
});

export const tribeContacts = pgTable("tribe_contacts", {
  id: text("id").primaryKey(),
  simulationId: text("simulation_id")
    .notNull()
    .references(() => simulations.id),
  tribeAId: text("tribe_a_id")
    .notNull()
    .references(() => tribes.id),
  tribeBId: text("tribe_b_id")
    .notNull()
    .references(() => tribes.id),
  stage: contactStageEnum("stage").notNull().default("awareness"),
  firstContactTurn: integer("first_contact_turn").notNull(),
  relationshipSentiment: integer("relationship_sentiment").notNull().default(0),
});

// ── Inlined Types (used by jsonb columns) ──

export type SimulationConfig = {
  tribeCount: number;
  populationCap: number;
  generationLimit: number;
  councilInterval: number;
  generationLength: number;
};

export type TribeRule = {
  domain: "governance" | "economy" | "social" | "cultural" | "external";
  text: string;
};

export type AgentResources = {
  food: number;
  wealth: number;
};

export type AgentMemory = {
  turn: number;
  summary: string;
};

export type AgentRelationship = {
  agentId: string;
  name: string;
  type: "parent" | "child" | "partner" | "ally" | "rival" | "neutral";
  sentiment: number; // -1 to 1
};

export type EventEffects = {
  populationChange?: number;
  resourceChange?: { food?: number; materials?: number };
  techLevelChange?: number;
  agentsKilled?: string[];
  triggersContact?: boolean;
};

export type VoteRecord = {
  agentId: string;
  agentName: string;
  decision: "approve" | "reject" | "abstain";
  reasoning: string;
};

export type ThreadMessage = {
  agentId: string;
  name: string;
  content: string;
  round: number;
};
