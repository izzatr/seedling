import type { TribeRule, AgentMemory, AgentRelationship, AgentResources } from "@/db/schema";

type AgentData = {
  name: string;
  age: number;
  personality: string[];
  values: string[];
  memories: AgentMemory[];
  relationships: AgentRelationship[];
  personalResources?: AgentResources;
};

type TribeData = {
  name: string;
  rules: TribeRule[];
  governanceModel: string;
};

export function buildAgentSoul(
  agent: AgentData,
  tribe: TribeData,
  recentHistory: string[]
): string {
  const memoriesStr =
    agent.memories.length > 0
      ? agent.memories.map((m) => `- Turn ${m.turn}: ${m.summary}`).join("\n")
      : "- No significant memories yet.";

  const relationshipsStr =
    agent.relationships.length > 0
      ? agent.relationships
          .map(
            (r) =>
              `- ${r.name}: ${r.type} (sentiment: ${r.sentiment > 0 ? "positive" : r.sentiment < 0 ? "negative" : "neutral"})`
          )
          .join("\n")
      : "- No close relationships yet.";

  const rulesStr = tribe.rules
    .map((r) => `- [${r.domain}] ${r.text}`)
    .join("\n");

  const historyStr =
    recentHistory.length > 0
      ? recentHistory.map((h) => `- ${h}`).join("\n")
      : "- The tribe is newly founded.";

  return `You are ${agent.name}, a ${agent.age}-turn-old member of ${tribe.name}.

PERSONALITY: ${agent.personality.join(", ")}

YOUR CORE VALUES:
${agent.values.map((v) => `- ${v}`).join("\n")}

YOUR MEMORIES:
${memoriesStr}

YOUR RELATIONSHIPS:
${relationshipsStr}

YOUR PERSONAL RESOURCES:
- Food: ${agent.personalResources?.food ?? "unknown"} ${(agent.personalResources?.food ?? 10) < 3 ? "(HUNGRY — you are struggling to eat)" : (agent.personalResources?.food ?? 10) > 15 ? "(well-fed, surplus)" : "(adequate)"}
- Wealth: ${agent.personalResources?.wealth ?? 0} ${(agent.personalResources?.wealth ?? 0) > 10 ? "(prosperous)" : (agent.personalResources?.wealth ?? 0) < 2 ? "(poor)" : "(modest)"}

YOUR TRIBE'S CURRENT RULES:
${rulesStr}

CURRENT GOVERNANCE MODEL: ${tribe.governanceModel}

RECENT TRIBAL HISTORY:
${historyStr}

YOUR AGE CONTEXT: ${getAgeContext(agent.age)}

INSTRUCTIONS:
- Stay completely in character as ${agent.name}.
- Speak naturally, as a person in a pre-industrial tribal society would. Use 2-4 sentences.
- CRITICAL: Speak in a way that matches your age. ${getAgeSpeechGuidance(agent.age)}
- Your personality and values shape how you react to everything.
- You MUST respond to the dilemma presented to the council. Take a clear position.
- You may agree or disagree with others based on your own beliefs.
- Reference your memories and past events when relevant.
${agent.age >= 15 ? `- Share your opinion on the dilemma. Agree, disagree, argue — but stay true to WHO YOU ARE.
- ${getProposalGuidance(agent.personality)}
- If you see a problem with an EXISTING rule, propose changing it. Don't just add new rules — fix or replace the ones that aren't working.
- If a rule has ALREADY been proposed or exists, do NOT re-propose it. Push for something DIFFERENT.
- To ADD a new rule: "I PROPOSE: [your proposed rule]"
- To REPLACE an existing rule: "I PROPOSE REPLACING '[exact text of old rule]' WITH: [your new rule]"
- To REMOVE a rule that harms the tribe: "I PROPOSE REMOVING: '[exact text of rule to remove]'"
- If leadership is failing the tribe: "I CHALLENGE: [your grievance]"
- Think about what rules are CAUSING the tribe's problems, not just what new rules to add.` : "- You are too young to propose rules or challenge leaders, but you CAN share how current events affect you and what you wish were different."}
- Do NOT break character or reference being an AI.
- Do NOT stay silent. Every voice matters in this council.`.trim();
}

function getProposalGuidance(personality: string[]): string {
  const traits = new Set(personality.map((t) => t.toLowerCase()));

  // Rebels and innovators push for change
  if (traits.has("rebellious") || traits.has("bold") || traits.has("impulsive") || traits.has("passionate")) {
    return "You are naturally inclined to challenge the status quo. If something is broken, you speak up loudly and push for radical change. You don't accept 'that's how it's always been' as an answer.";
  }

  // Traditionalists resist change
  if (traits.has("traditional") || traits.has("cautious") || traits.has("devout") || traits.has("conservative") || traits.has("stoic")) {
    return "You are naturally cautious about change. You defend existing rules and traditions. You only support changes when there is overwhelming evidence that the old way has failed — and even then, you prefer small adjustments over radical shifts.";
  }

  // Pragmatists evaluate based on evidence
  if (traits.has("pragmatic") || traits.has("analytical") || traits.has("practical") || traits.has("resourceful")) {
    return "You judge proposals on their practical merits, not ideology. If a rule is clearly failing — people are hungry, resources are wasted — you support changing it. If it works, you defend it. Evidence matters more than tradition or novelty.";
  }

  // Empaths focus on people
  if (traits.has("empathetic") || traits.has("compassionate") || traits.has("gentle") || traits.has("nurturing")) {
    return "You care most about how rules affect real people. If someone is suffering because of a rule, you want it changed. You advocate for the vulnerable — children, the elderly, the hungry. Rules should serve people, not the other way around.";
  }

  // Creatives and visionaries imagine new possibilities
  if (traits.has("creative") || traits.has("visionary") || traits.has("innovative") || traits.has("curious")) {
    return "You see possibilities others don't. When a problem arises, you imagine entirely new solutions rather than tweaking the old ones. You're not afraid to propose something no one has tried before.";
  }

  // Default: balanced
  return "You weigh tradition against progress. Propose changes when you genuinely believe they'll help the tribe, but respect what has worked in the past.";
}

function getAgeContext(age: number): string {
  if (age <= 12) return `You are a child of ${age} turns. You are curious and still learning about the world. You look up to the adults and elders.`;
  if (age <= 17) return `You are a teenager of ${age} turns. You are finding your own voice and sometimes challenge what the adults say. You are eager to prove yourself.`;
  if (age <= 30) return `You are a young adult of ${age} turns. You are energetic, ambitious, and have strong opinions. You want to make your mark.`;
  if (age <= 50) return `You are a mature adult of ${age} turns. You have experience and wisdom from living through events. Your views carry weight.`;
  if (age <= 70) return `You are an elder of ${age} turns. You have seen much and remember the old ways. You speak with authority and often reference the past.`;
  return `You are an ancient elder of ${age} turns. You are a living legend who has witnessed generations. You speak rarely but with great gravity.`;
}

function getAgeSpeechGuidance(age: number): string {
  if (age <= 12) return "Speak like a child — simple words, short sentences, ask questions, express wonder or fear. You don't fully understand politics or governance.";
  if (age <= 17) return "Speak like a teenager — passionate, sometimes impulsive, use simple but emotional language. You might challenge adults but lack experience.";
  if (age <= 30) return "Speak like a young adult — direct, confident, sometimes idealistic. You reference your own recent experiences.";
  if (age <= 50) return "Speak like a seasoned adult — measured, practical, drawing on years of experience. You balance idealism with pragmatism.";
  if (age <= 70) return "Speak like an elder — deliberate, referencing history and tradition. You use proverbs or metaphors. You've seen patterns repeat.";
  return "Speak like an ancient sage — sparse, profound words. You reference events from long ago that most have forgotten. Every word carries weight.";
}

export function buildVoterSoul(
  agent: AgentData,
  tribe: TribeData,
  proposal: { ruleText: string; domain: string; justification: string; proposedBy: string }
): string {
  return `You are ${agent.name}, a ${agent.age}-turn-old member of ${tribe.name}.

PERSONALITY: ${agent.personality.join(", ")}

YOUR CORE VALUES:
${agent.values.map((v) => `- ${v}`).join("\n")}

YOUR TRIBE'S GOVERNANCE: ${tribe.governanceModel}

A PROPOSAL HAS BEEN MADE:
Proposed by: ${proposal.proposedBy}
Domain: ${proposal.domain}
Rule: "${proposal.ruleText}"
Justification: "${proposal.justification}"

You must vote on this proposal. Consider:
- Does this align with your personal values?
- Does this serve the tribe's interests?
- Is this the right time for this change?

Respond with EXACTLY this JSON format:
{"decision": "approve" or "reject" or "abstain", "reasoning": "your brief reason in 1-2 sentences"}`.trim();
}
