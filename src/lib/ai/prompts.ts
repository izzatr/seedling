import type { TribeRule } from "@/db/schema";

export function buildMagnitudeEvaluationPrompt(
  currentRules: TribeRule[],
  proposedRule: string,
  domain: string,
  allowedMagnitude: string,
  replacesRule?: string
): string {
  const magnitudeDescriptions: Record<string, string> = {
    minor:
      "Only minor clarifications or word changes that preserve the original intent completely. The spirit and substance of the rule must remain identical.",
    small:
      "Small adjustments to existing rules. The core principle must remain, but details can shift. New rules are only allowed if they fill a gap without contradicting existing ones.",
    moderate:
      "Moderate rewrites of existing rules and introduction of new rules. The general direction of governance can shift, but radical reversals of core principles are not allowed.",
    any: "Any change is allowed, including complete reversals of existing rules, deletion of rules, and introduction of entirely new governance paradigms.",
  };

  return `You are a neutral evaluator judging whether a proposed rule change falls within the allowed magnitude of change.

CURRENT RULES:
${currentRules.map((r) => `- [${r.domain}] ${r.text}`).join("\n")}

PROPOSED CHANGE:
- Domain: ${domain}
- New rule: "${proposedRule}"
${replacesRule ? `- Replaces: "${replacesRule}"` : "- This is a new rule (does not replace an existing one)"}

ALLOWED MAGNITUDE: "${allowedMagnitude}"
${magnitudeDescriptions[allowedMagnitude] ?? "Unknown magnitude — reject by default."}

Evaluate whether this proposed change is within the allowed magnitude. Consider:
1. How different is the new rule from what it replaces (or from the existing rule set)?
2. Does it violate the spirit of the magnitude constraint?

Respond with EXACTLY this JSON format:
{"allowed": true or false, "reasoning": "your explanation in 1-2 sentences"}`;
}

export function buildEventFlavorPrompt(
  tribeName: string,
  rules: TribeRule[],
  eventTemplate: string,
  severity: string
): string {
  return `You are narrating an event for ${tribeName}, a tribal society.

THEIR RULES:
${rules.map((r) => `- [${r.domain}] ${r.text}`).join("\n")}

EVENT: ${eventTemplate}
SEVERITY: ${severity}

Write a vivid 2-3 sentence narrative of this event, contextualized to this specific tribe's culture and rules. How would THEY experience and interpret this event given their values? Write in third person, past tense, like a historian's chronicle.`;
}

export function buildInheritancePrompt(
  parentAValues: string[],
  parentBValues: string[],
  tribeRules: TribeRule[],
  recentHistory: string[]
): string {
  return `You are generating the initial values for a newborn child in a tribal society.

PARENT A'S VALUES:
${parentAValues.map((v) => `- ${v}`).join("\n")}

PARENT B'S VALUES:
${parentBValues.map((v) => `- ${v}`).join("\n")}

TRIBE'S CURRENT RULES:
${tribeRules.map((r) => `- [${r.domain}] ${r.text}`).join("\n")}

RECENT TRIBAL HISTORY:
${recentHistory.map((h) => `- ${h}`).join("\n")}

Generate 4-5 personal values for this child. They should:
- Blend elements from both parents (not just copy them)
- Show slight drift — children never perfectly mirror their parents
- Be influenced by the tribe's current culture and recent events
- Be expressed as natural language beliefs (e.g., "Community matters more than individual desires")

Respond with EXACTLY a JSON array of strings: ["value1", "value2", "value3", "value4"]`;
}

export function buildMythologizationPrompt(
  agentName: string,
  memories: { turn: number; summary: string }[]
): string {
  return `You are compressing old memories for ${agentName}, a member of a tribal society. Over time, memories fade and become mythologized — details blur, narratives form, and events become stories.

OLD MEMORIES TO COMPRESS:
${memories.map((m) => `- Turn ${m.turn}: ${m.summary}`).join("\n")}

Compress these ${memories.length} memories into 2-3 mythologized summaries. The compressed memories should:
- Merge related events into broader narratives
- Add slight distortions (as human memory does)
- Emphasize emotional impact over factual precision
- Feel like how an elder would retell these events years later

Respond with EXACTLY a JSON array: [{"turn": earliest_turn_number, "summary": "compressed narrative"}]`;
}

export function buildWorldHistoryPrompt(
  tribeHistories: {
    name: string;
    foundingRules: TribeRule[];
    currentRules: TribeRule[];
    events: string[];
    population: number;
    ruleChanges: number;
  }[]
): string {
  const tribesStr = tribeHistories
    .map(
      (t) => `
TRIBE: ${t.name}
Final population: ${t.population}
Rule changes: ${t.ruleChanges}
Key events:
${t.events.map((e) => `  - ${e}`).join("\n")}
Rules that changed most:
${t.currentRules
  .filter(
    (r) =>
      !t.foundingRules.some(
        (fr) => fr.domain === r.domain && fr.text === r.text
      )
  )
  .map((r) => `  - [${r.domain}] ${r.text}`)
  .join("\n") || "  - (no significant rule changes)"}
`
    )
    .join("\n---\n");

  return `You are a future historian writing the definitive chronicle of four ancient tribes that lived side by side. Write a 500-800 word narrative history weaving their stories together.

${tribesStr}

STYLE:
- Write as a historian looking back on these events from centuries in the future
- Use a mythologized, literary style — these are legends now, not mere records
- Weave the tribes' stories together, noting parallels, contrasts, and interactions
- Highlight the central question: how did each tribe's willingness to change its rules shape its destiny?
- End with a reflective observation about what these civilizations teach us

Write the complete narrative now.`;
}

export function buildDivergenceReportPrompt(
  tribeReports: {
    name: string;
    driftPercentage: number;
    domainDrift: Record<string, number>;
    populationHistory: { born: number; died: number; final: number };
    ruleChanges: number;
    keyEvents: string[];
  }[]
): string {
  return `Analyze the divergence of these four tribes from their founding principles. Each tribe had different levels of rule mutability.

${tribeReports.map((t) => `
TRIBE: ${t.name}
Overall drift: ${t.driftPercentage.toFixed(1)}%
Drift by domain: ${Object.entries(t.domainDrift)
    .map(([d, pct]) => `${d}: ${pct.toFixed(1)}%`)
    .join(", ")}
Population: ${t.populationHistory.born} born, ${t.populationHistory.died} died, ${t.populationHistory.final} final
Rule changes passed: ${t.ruleChanges}
Key events: ${t.keyEvents.join("; ")}
`).join("\n---\n")}

Write a 200-400 word comparative analysis. Address:
1. Which tribe changed most and least, and why?
2. How did rule mutability affect survival and prosperity?
3. What surprising outcomes emerged?
4. What does this suggest about the relationship between flexibility and stability?`;
}
