import { generateText } from "ai";
import { flashModel } from "../ai/models";
import { buildAgentSoul } from "../ai/soul";
import { shuffle } from "../constants";
import { broadcast } from "../engine/sse";
import type { TribeRule, AgentMemory, AgentRelationship, ThreadMessage } from "@/db/schema";

type AgentForDelib = {
  id: string;
  name: string;
  age: number;
  personality: string[];
  values: string[];
  memories: AgentMemory[];
  relationships: AgentRelationship[];
};

type TribeForDelib = {
  id: string;
  name: string;
  rules: TribeRule[];
  governanceModel: string;
};

export type Proposal = {
  agentId: string;
  agentName: string;
  ruleText: string;
  domain: string;
  justification: string;
  replacesRule?: string;
  action: "add" | "replace" | "remove";
};

export type Challenge = {
  agentId: string;
  agentName: string;
  grievance: string;
  proposedAlternative: string;
};

function getRoundCount(agentCount: number): number {
  // More rounds = richer deliberation with back-and-forth
  if (agentCount <= 4) return 2;
  if (agentCount <= 8) return 2;
  if (agentCount <= 15) return 3;
  return 3;
}

export async function runDeliberation(
  simulationId: string,
  tribe: TribeForDelib,
  livingAgents: AgentForDelib[],
  context: string,
  recentHistory: string[]
): Promise<{
  messages: ThreadMessage[];
  proposals: Proposal[];
  challenges: Challenge[];
  roundCount: number;
}> {
  const rounds = getRoundCount(livingAgents.length);
  const allMessages: ThreadMessage[] = [];
  const proposals: Proposal[] = [];
  const challenges: Challenge[] = [];

  // Generate a concrete dilemma for the council to address
  const dilemma = generateDilemma(tribe, livingAgents.length, context);

  // Thread context accumulates between rounds
  const threadLines: string[] = [
    `Council of ${tribe.name} convenes. ${context}\n\nTHE COUNCIL MUST ADDRESS: ${dilemma}`,
  ];

  for (let round = 0; round < rounds; round++) {
    // Not everyone speaks every round — cap at 10 speakers for large tribes
    const MAX_SPEAKERS_PER_ROUND = 10;
    const speakingOrder = shuffle(livingAgents).slice(0, MAX_SPEAKERS_PER_ROUND);
    // Keep context manageable — first line (council intro + dilemma) + last 15 messages
    const MAX_CONTEXT_MESSAGES = 15;
    const contextLines = threadLines.length <= MAX_CONTEXT_MESSAGES + 1
      ? threadLines
      : [threadLines[0], `[...${threadLines.length - MAX_CONTEXT_MESSAGES - 1} earlier messages...]`, ...threadLines.slice(-MAX_CONTEXT_MESSAGES)];
    const threadSnapshot = contextLines.join("\n\n");

    // ── Agents speak in batches with delays to respect TPM limits ──
    const BATCH_SIZE = 3;
    const roundResults: { agent: AgentForDelib; text: string }[] = [];

    for (let b = 0; b < speakingOrder.length; b += BATCH_SIZE) {
      // Pause between batches to spread token usage across the minute
      if (b > 0) await new Promise((r) => setTimeout(r, 2000));
      const batch = speakingOrder.slice(b, b + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (agent) => {
          const soul = buildAgentSoul(
            agent,
            { name: tribe.name, rules: tribe.rules, governanceModel: tribe.governanceModel },
            recentHistory
          );

          try {
            const response = await generateText({
              model: flashModel,
              system: soul,
              messages: [{ role: "user", content: threadSnapshot }],
            });

            // Strip <think>...</think> tags from thinking models (Qwen3.5)
            let cleaned = response.text
              .replace(/<think>[\s\S]*?<\/think>/gi, "")
              .trim();
            // Also strip leading/trailing asterisks (markdown actions)
            cleaned = cleaned.replace(/^\*+|\*+$/g, "").trim();
            return { agent, text: cleaned };
          } catch (error) {
            console.error(`Deliberation error for ${agent.name}:`, error);
            return { agent, text: "" };
          }
        })
      );
      roundResults.push(...batchResults);
    }

    // Process results sequentially (ordering, broadcasting, parsing)
    for (const { agent, text } of roundResults) {
      if (!text || text.includes("[stays silent]") || text.length < 5) continue;

      const message: ThreadMessage = {
        agentId: agent.id,
        name: agent.name,
        content: text,
        round,
      };
      allMessages.push(message);
      threadLines.push(`[${agent.name}]: ${text}`);

      broadcast(simulationId, "speech", {
        tribeId: tribe.id,
        tribeName: tribe.name,
        agentName: agent.name,
        content: text,
        round,
      });

      // Parse proposals — add, replace, or remove
      const removeMatch = text.match(/I PROPOSE REMOVING:\s*['"](.+?)['"]/i);
      const replaceMatch = text.match(/I PROPOSE REPLACING\s*['"](.+?)['"]\s*WITH:\s*(.+?)(?:\.|$)/i);
      const addMatch = text.match(/I PROPOSE:\s*(.+?)(?:\.|$)/i);

      if (removeMatch) {
        proposals.push({
          agentId: agent.id,
          agentName: agent.name,
          ruleText: removeMatch[1].trim(),
          replacesRule: removeMatch[1].trim(),
          domain: guessRuleDomain(removeMatch[1]),
          justification: text,
          action: "remove",
        });
      } else if (replaceMatch) {
        proposals.push({
          agentId: agent.id,
          agentName: agent.name,
          ruleText: replaceMatch[2].trim(),
          replacesRule: replaceMatch[1].trim(),
          domain: guessRuleDomain(replaceMatch[2]),
          justification: text,
          action: "replace",
        });
      } else if (addMatch) {
        proposals.push({
          agentId: agent.id,
          agentName: agent.name,
          ruleText: addMatch[1].trim(),
          domain: guessRuleDomain(addMatch[1]),
          justification: text,
          action: "add",
        });
      }

      // Parse challenges
      const challengeMatch = text.match(/I CHALLENGE:\s*(.+?)(?:\.|$)/i);
      if (challengeMatch) {
        challenges.push({
          agentId: agent.id,
          agentName: agent.name,
          grievance: challengeMatch[1].trim(),
          proposedAlternative: text,
        });
      }
    }
  }

  return { messages: allMessages, proposals, challenges, roundCount: rounds };
}

function guessRuleDomain(text: string): string {
  const lower = text.toLowerCase();
  if (/leader|vote|council|govern|decide/.test(lower)) return "governance";
  if (/resource|food|trade|work|share/.test(lower)) return "economy";
  if (/family|child|partner|marriage|dispute/.test(lower)) return "social";
  if (/belief|tradition|story|sacred|ancestor/.test(lower)) return "cultural";
  if (/outsider|stranger|border|explore|contact/.test(lower)) return "external";
  return "cultural";
}

// ── Dilemma Generator ──
// Creates concrete problems that directly challenge existing rules

type DilemmaFn = (tribe: TribeForDelib, pop: number, ctx: string) => string | null;

const DILEMMA_GENERATORS: DilemmaFn[] = [
  // Pick a random existing rule and challenge it
  (tribe) => {
    const rule = tribe.rules[Math.floor(Math.random() * tribe.rules.length)];
    return `One of your rules states: "${rule.text}" — Some members believe this rule is outdated or harmful. Others defend it fiercely. Should this rule be CHANGED, REMOVED, or KEPT as-is? If changed, what should replace it?`;
  },

  // Governance crisis
  (tribe, pop) => {
    if (pop <= 10) return null;
    const govRules = tribe.rules.filter((r) => r.domain === "governance");
    if (govRules.length === 0) return null;
    return `Your governance rule says: "${govRules[0].text}" — But with ${pop} members, many feel unheard. Three younger members are threatening to leave unless the governance changes. Do you reform how decisions are made, or let them go?`;
  },

  // Economy failing
  (tribe, _pop, ctx) => {
    if (!/hungry|scarce|starving|famine/i.test(ctx)) return null;
    const econRules = tribe.rules.filter((r) => r.domain === "economy");
    if (econRules.length === 0) return null;
    return `People are going hungry. Your economy rule says: "${econRules[0].text}" — This is clearly not working. Members are angry. Do you fundamentally change how resources work, or try to make the current system work harder?`;
  },

  // Social tension from inequality
  (tribe, pop) => {
    if (pop < 12) return null;
    const socialRules = tribe.rules.filter((r) => r.domain === "social");
    if (socialRules.length === 0) return null;
    return `A bitter dispute has erupted. The wealthy members live comfortably while others struggle. Your social rule says: "${socialRules[0].text}" — Is this fair? Should the tribe force redistribution, or is inequality the price of freedom?`;
  },

  // Cultural identity crisis
  (tribe, pop) => {
    if (pop < 15) return null;
    const cultRules = tribe.rules.filter((r) => r.domain === "cultural");
    if (cultRules.length === 0) return null;
    return `The newest generation has never known the founders. They don't understand why the rule "${cultRules[0].text}" matters. They want to define their OWN identity. Should the tribe let go of old beliefs, or force the young to learn them?`;
  },

  // External pressure
  (tribe) => {
    const extRules = tribe.rules.filter((r) => r.domain === "external");
    if (extRules.length === 0) return null;
    return `Scouts report a thriving settlement beyond the hills — they have food, tools, and knowledge we lack. Your rule says: "${extRules[0].text}" — But some members want to trade, or even merge with them. Do you open your borders or stay isolated?`;
  },

  // Power struggle
  (tribe, pop) => {
    if (pop < 10) return null;
    return `A charismatic young member has gathered a following of ${Math.floor(pop / 3)} supporters. They demand a completely new form of governance — abolishing the current "${tribe.governanceModel}" system. This is a direct challenge to how the tribe is led. What happens?`;
  },

  // The radical question
  (tribe) => {
    return `Imagine you could ERASE all current rules and start fresh. What kind of society would you build? What rules would you write from scratch? This is not hypothetical — if enough of you agree, you CAN change everything. What is your vision for the tribe's future?`;
  },

  // Specific rule contradiction
  (tribe) => {
    if (tribe.rules.length < 4) return null;
    const r1 = tribe.rules[Math.floor(Math.random() * tribe.rules.length)];
    let r2 = tribe.rules[Math.floor(Math.random() * tribe.rules.length)];
    let attempts = 0;
    while (r2.text === r1.text && attempts < 5) {
      r2 = tribe.rules[Math.floor(Math.random() * tribe.rules.length)];
      attempts++;
    }
    return `Two of your rules seem to conflict: "${r1.text}" vs "${r2.text}" — When these clash, which takes priority? Should one be removed or rewritten to resolve the tension?`;
  },

  // Death of an elder who held old values
  (_tribe, _pop, ctx) => {
    if (!/mourns|loss|died/i.test(ctx)) return null;
    return `An elder who passionately defended the old ways has died. With them gone, the strongest voice for tradition is silenced. This is a turning point — do you honor their legacy by preserving what they fought for, or seize this moment to make the changes they always blocked?`;
  },
];

function generateDilemma(tribe: TribeForDelib, population: number, context: string): string {
  // Try context-specific dilemmas first, then fall back to random
  const shuffled = [...DILEMMA_GENERATORS].sort(() => Math.random() - 0.5);

  for (const gen of shuffled) {
    const dilemma = gen(tribe, population, context);
    if (dilemma) return dilemma;
  }

  // Ultimate fallback
  const rule = tribe.rules[Math.floor(Math.random() * tribe.rules.length)];
  return `Your rule states: "${rule.text}" — Does this still serve the tribe? Should it be changed, strengthened, or abolished entirely?`;
}
