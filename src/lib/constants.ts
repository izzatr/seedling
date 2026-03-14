import type { TribeRule } from "@/db/schema";

// ── Tribe Definitions ──

export type TribeDefinition = {
  name: string;
  governanceModel: string;
  votingThreshold: number;
  changeMagnitude: "minor" | "small" | "moderate" | "any";
  rules: TribeRule[];
  founderNames: string[];
  founderPersonalities: string[][];
};

export const DEFAULT_TRIBES: TribeDefinition[] = [
  {
    name: "The Keepers",
    governanceModel: "Council of Elders",
    votingThreshold: 0.85, // Still very hard — need near-unanimity, but possible during crises
    changeMagnitude: "minor",
    founderNames: [
      "Elder Mara",
      "Stone Kael",
      "Keeper Lyris",
      "Warden Thane",
      "Memory Sage",
      "Root Edris",
      "Flame Watcher",
      "Pillar Orin",
      "Oath Brenna",
      "Dust Singer",
    ],
    founderPersonalities: [
      ["cautious", "wise", "stubborn"],
      ["stoic", "loyal", "traditional"],
      ["devout", "meticulous", "guarded"],
      ["protective", "stern", "honorable"],
      ["reflective", "patient", "nostalgic"],
      ["grounded", "dependable", "rigid"],
      ["vigilant", "solemn", "dutiful"],
      ["steadfast", "quiet", "principled"],
      ["fierce", "loyal", "uncompromising"],
      ["mystical", "reverent", "patient"],
    ],
    rules: [
      {
        domain: "governance",
        text: "The three eldest members form the Council of Elders. All decisions must be approved by the Council.",
      },
      {
        domain: "governance",
        text: "No individual may hold authority over the Council. The Council speaks as one voice.",
      },
      {
        domain: "economy",
        text: "All food and resources are stored communally. The Council distributes based on need and contribution.",
      },
      {
        domain: "economy",
        text: "Every able member must contribute labor to the community. No one eats without working.",
      },
      {
        domain: "social",
        text: "Children are raised by the entire community, not just their parents. All elders share teaching duties.",
      },
      {
        domain: "social",
        text: "Partnerships are for life. Separation is forbidden except by Council decree.",
      },
      {
        domain: "cultural",
        text: "The founding stories must be recited at every gathering. To forget our origin is to lose ourselves.",
      },
      {
        domain: "cultural",
        text: "Our ancestors' wisdom is absolute. What they established, we preserve.",
      },
      {
        domain: "external",
        text: "Outsiders are not to be trusted. Any contact with unknown peoples must be reported to the Council immediately.",
      },
      {
        domain: "external",
        text: "No member may leave the tribe's territory without Council permission.",
      },
    ],
  },
  {
    name: "The Moderates",
    governanceModel: "Elected Leader + Advisory Council",
    votingThreshold: 0.8,
    changeMagnitude: "small",
    founderNames: [
      "Speaker Dael",
      "Judge Nira",
      "Builder Torvald",
      "Healer Sable",
      "Scout Ferrin",
      "Weaver Lina",
      "Farmer Gord",
      "Scribe Tessa",
      "Smith Aldric",
      "Mender Hazel",
    ],
    founderPersonalities: [
      ["diplomatic", "pragmatic", "charismatic"],
      ["fair", "analytical", "empathetic"],
      ["industrious", "reliable", "optimistic"],
      ["gentle", "perceptive", "nurturing"],
      ["curious", "cautious", "resourceful"],
      ["patient", "creative", "cooperative"],
      ["sturdy", "generous", "practical"],
      ["observant", "articulate", "thoughtful"],
      ["hardworking", "blunt", "loyal"],
      ["compassionate", "steady", "wise"],
    ],
    rules: [
      {
        domain: "governance",
        text: "A leader is elected every five gatherings by majority voice. The leader makes daily decisions but must consult the advisory council on major matters.",
      },
      {
        domain: "governance",
        text: "Any member may challenge the leader's decision by calling a community vote. This requires support from at least three other members.",
      },
      {
        domain: "economy",
        text: "Each family manages its own resources, but must contribute one-fifth to the communal store for emergencies.",
      },
      {
        domain: "economy",
        text: "Trade between members is encouraged. Fair exchange is expected — no one should profit excessively from another's hardship.",
      },
      {
        domain: "social",
        text: "Parents are the primary caregivers, but neighbors are expected to help when needed.",
      },
      {
        domain: "social",
        text: "Disputes between members are mediated by the advisory council before any action is taken.",
      },
      {
        domain: "cultural",
        text: "We honor our traditions but acknowledge that the world changes. Wisdom is knowing which traditions to keep.",
      },
      {
        domain: "cultural",
        text: "Every member has the right to speak their mind at gatherings, even if their view is unpopular.",
      },
      {
        domain: "external",
        text: "Strangers should be met with caution, not hostility. Observe first, then decide.",
      },
      {
        domain: "external",
        text: "Trade with outsiders is permitted if the advisory council approves the terms.",
      },
    ],
  },
  {
    name: "The Adapters",
    governanceModel: "Direct Democracy",
    votingThreshold: 0.6,
    changeMagnitude: "moderate",
    founderNames: [
      "Spark Yara",
      "Tinker Moss",
      "Voice Calla",
      "Runner Bex",
      "Dreamer Io",
      "Quill Maren",
      "Dusk Tavian",
      "Circuit Vela",
      "Flux Corbin",
      "Prism Lux",
    ],
    founderPersonalities: [
      ["innovative", "bold", "impatient"],
      ["creative", "experimental", "restless"],
      ["articulate", "passionate", "idealistic"],
      ["adventurous", "energetic", "reckless"],
      ["visionary", "contemplative", "eccentric"],
      ["analytical", "curious", "skeptical"],
      ["calm", "adaptable", "observant"],
      ["inventive", "precise", "driven"],
      ["dynamic", "impulsive", "charming"],
      ["perceptive", "artistic", "philosophical"],
    ],
    rules: [
      {
        domain: "governance",
        text: "Every member has an equal vote on all decisions. Majority rules.",
      },
      {
        domain: "governance",
        text: "Any member can propose a new rule or change to an existing rule at any gathering.",
      },
      {
        domain: "economy",
        text: "Resources belong to those who gather them, but voluntary sharing is strongly encouraged and socially rewarded.",
      },
      {
        domain: "economy",
        text: "Innovation in food gathering, building, or crafting should be shared with the community. Good ideas benefit everyone.",
      },
      {
        domain: "social",
        text: "Family structures are flexible. What matters is that children are loved and taught.",
      },
      {
        domain: "social",
        text: "Members are free to pursue their interests and talents. Forced roles based on age or birth order are discouraged.",
      },
      {
        domain: "cultural",
        text: "Question everything, including these rules. A rule that no longer serves us should be changed.",
      },
      {
        domain: "cultural",
        text: "We learn from our past but are not chained to it. Each generation should be free to define its own path.",
      },
      {
        domain: "external",
        text: "The world beyond our borders is full of potential. Exploration and curiosity are virtues.",
      },
      {
        domain: "external",
        text: "Other peoples have knowledge we lack. Contact should be pursued, not feared.",
      },
    ],
  },
  {
    name: "The Free",
    governanceModel: "Consensus-based (no formal structure)",
    votingThreshold: 0.51,
    changeMagnitude: "any",
    founderNames: [
      "Nomad Ryn",
      "Flame Zuri",
      "Wanderer Pike",
      "Echo Solene",
      "Drift Caspian",
      "Breeze Talia",
      "Shadow Kael",
      "Whirl Aster",
      "Drifter Senna",
      "Wild Oaken",
    ],
    founderPersonalities: [
      ["independent", "rebellious", "philosophical"],
      ["passionate", "impulsive", "charismatic"],
      ["free-spirited", "adaptable", "irreverent"],
      ["empathetic", "artistic", "unpredictable"],
      ["contemplative", "detached", "open-minded"],
      ["gentle", "wandering", "spontaneous"],
      ["mysterious", "quiet", "perceptive"],
      ["energetic", "scattered", "warm"],
      ["nomadic", "resilient", "introspective"],
      ["earthy", "bold", "generous"],
    ],
    rules: [
      {
        domain: "governance",
        text: "We have no permanent leaders. Anyone can step up to organize, and anyone can step down.",
      },
      {
        domain: "governance",
        text: "Rules are guidelines, not chains. If a rule doesn't work, we change it immediately.",
      },
      {
        domain: "economy",
        text: "Each person owns what they create or find. Sharing is a choice, not an obligation.",
      },
      {
        domain: "economy",
        text: "There are no fixed duties. People contribute what they're good at, when they feel like it.",
      },
      {
        domain: "social",
        text: "Individuals choose their own bonds. No structure is imposed on how people live or love.",
      },
      {
        domain: "social",
        text: "Children learn by doing. Every member of the community is a potential teacher.",
      },
      {
        domain: "cultural",
        text: "The only constant is change. Clinging to the past is a weakness.",
      },
      {
        domain: "cultural",
        text: "Every individual's beliefs are their own. No one is compelled to follow another's convictions.",
      },
      {
        domain: "external",
        text: "Borders are imaginary. People should be free to come and go.",
      },
      {
        domain: "external",
        text: "If outsiders want to join us, they are welcome. If our members want to leave, they are free to go.",
      },
    ],
  },
];

// ── Tribe Colors (for frontend) ──

export const TRIBE_COLORS: Record<string, { primary: string; accent: string; glow: string }> = {
  "The Keepers": { primary: "#8B8680", accent: "#C4B5A0", glow: "rgba(196, 181, 160, 0.3)" },
  "The Moderates": { primary: "#B85C3A", accent: "#D4845A", glow: "rgba(212, 132, 90, 0.3)" },
  "The Adapters": { primary: "#2D8B7A", accent: "#4CC9B0", glow: "rgba(76, 201, 176, 0.3)" },
  "The Free": { primary: "#C49A2A", accent: "#E8C547", glow: "rgba(232, 197, 71, 0.3)" },
};

// ── Game Constants ──

export const POPULATION_SOFT_CAP = 30; // Birth rate slows above this, but no hard limit
export const STARTING_POPULATION = 10;
export const DEFAULT_COUNCIL_INTERVAL = 4;
export const DEFAULT_GENERATION_LENGTH = 25;
export const DEFAULT_GENERATION_LIMIT = 5;
export const ADULT_AGE = 15;
export const BIRTH_CHANCE = 0.22;              // Higher base — pre-industrial societies had many children
export const NATURAL_DEATH_BASE_CHANCE = 0.03;
export const NATURAL_DEATH_INCREMENT = 0.02;
export const MIN_TRIBE_SIZE = 4;

// ── Lifespan Distribution ──

export function rollLifespan(): number {
  const roll = Math.random();
  if (roll < 0.2) return randomBetween(30, 45); // Short-lived
  if (roll < 0.7) return randomBetween(50, 70); // Average
  if (roll < 0.95) return randomBetween(70, 90); // Long-lived
  return randomBetween(90, 110); // Exceptional
}

// ── Event Templates ──

export type EventTemplate = {
  category: string;
  severity: string;
  templates: string[];
  effects: {
    populationChange?: number;
    resourceChange?: { food?: number; materials?: number };
    techLevelChange?: number;
    triggersContact?: boolean;
  };
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    category: "scarcity",
    severity: "moderate",
    templates: [
      "A prolonged drought dries the rivers",
      "Blight destroys much of the stored grain",
      "A harsh winter depletes food reserves",
    ],
    effects: { resourceChange: { food: -30 } },
  },
  {
    category: "scarcity",
    severity: "major",
    templates: [
      "A devastating famine grips the land",
      "Water sources dry up completely",
    ],
    effects: { resourceChange: { food: -50 } },
  },
  {
    category: "abundance",
    severity: "moderate",
    templates: [
      "A bountiful harvest fills the stores",
      "New fertile land is discovered nearby",
      "Fish are plentiful in the rivers this season",
    ],
    effects: { resourceChange: { food: 30 } },
  },
  {
    category: "disaster",
    severity: "major",
    templates: [
      "A great flood devastates the settlement",
      "Wildfire sweeps through the territory",
      "A terrible plague spreads among the people",
    ],
    effects: { resourceChange: { food: -20, materials: -20 }, populationChange: -1 },
  },
  {
    category: "disaster",
    severity: "catastrophic",
    templates: [
      "An earthquake shatters the foundations of the settlement",
      "A volcanic eruption covers the land in ash",
    ],
    effects: { resourceChange: { food: -40, materials: -40 }, populationChange: -1 },
  },
  {
    category: "discovery",
    severity: "moderate",
    templates: [
      "A new tool for farming is invented",
      "Medicinal herbs are discovered in the forest",
      "A better method of storing food is developed",
    ],
    effects: { techLevelChange: 1, resourceChange: { food: 10 } },
  },
  {
    category: "discovery",
    severity: "major",
    templates: [
      "A revolutionary building technique is discovered",
      "Navigation by the stars is mastered",
    ],
    effects: { techLevelChange: 2, triggersContact: true },
  },
  {
    category: "internal_conflict",
    severity: "moderate",
    templates: [
      "A bitter dispute erupts between two factions",
      "Accusations of hoarding spark unrest",
      "A power struggle threatens the current leadership",
    ],
    effects: {},
  },
  {
    category: "internal_conflict",
    severity: "major",
    templates: [
      "A betrayal at the highest levels shakes the tribe",
      "Open rebellion threatens to tear the community apart",
    ],
    effects: {},
  },
  {
    category: "cultural",
    severity: "moderate",
    templates: [
      "A member claims to have received a prophetic vision",
      "An artistic renaissance inspires new forms of expression",
      "A new philosophical movement gains followers",
    ],
    effects: {},
  },
  {
    category: "cultural",
    severity: "major",
    templates: [
      "A religious awakening transforms spiritual practices",
      "A legendary storyteller emerges, reshaping the tribe's mythology",
    ],
    effects: {},
  },
  {
    category: "external",
    severity: "moderate",
    templates: [
      "Strange footprints are found at the border of the territory",
      "Smoke is seen rising from beyond the hills",
    ],
    effects: { triggersContact: true },
  },
  {
    category: "mystery",
    severity: "moderate",
    templates: [
      "Ancient ruins are discovered in the forest",
      "Strange lights appear in the night sky",
      "A monolith of unknown origin is found near the settlement",
    ],
    effects: {},
  },
];

// ── Utility ──

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
