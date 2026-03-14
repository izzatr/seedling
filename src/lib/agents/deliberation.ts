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
    const threadSnapshot = threadLines.join("\n\n");

    // ── Agents speak in batches ──
    // Gemini 2.5 Flash Lite has 4K RPM — can handle larger batches
    const BATCH_SIZE = 10;
    const roundResults: { agent: AgentForDelib; text: string }[] = [];

    for (let b = 0; b < speakingOrder.length; b += BATCH_SIZE) {
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
// Creates concrete problems that force agents to confront their rules

type DilemmaPool = { condition: (pop: number, context: string) => boolean; dilemma: string }[];

const DILEMMAS: DilemmaPool = [
  // Population pressure
  { condition: (pop) => pop > 15, dilemma: "The tribe has grown large. Food stores are stretched thin. Some say we need new rules about who gets what. Others say our current system works. How should we distribute resources as we grow?" },
  { condition: (pop) => pop > 20, dilemma: "With so many members, the old ways of making decisions are slow. Some voices are never heard. Should we change how we govern ourselves to handle our growing numbers?" },
  { condition: (pop) => pop < 6, dilemma: "Our numbers are dangerously low. We must decide: do we change our ways to attract outsiders, or hold firm to our traditions and hope for natural growth?" },
  // Generational tension
  { condition: (_, ctx) => ctx.includes("New members") || ctx.includes("born"), dilemma: "The young ones are coming of age. They question some of our oldest rules. The elders insist on tradition. How do we balance respecting our past with allowing the next generation their voice?" },
  // Resource crisis
  { condition: (_, ctx) => /famine|drought|scarcity|blight/i.test(ctx), dilemma: "Resources are scarce. Some hoard while others starve. Do we enforce sharing, or trust individuals to do the right thing? Our current rules may not be enough." },
  // Discovery / innovation
  { condition: (_, ctx) => /discover|invent|new tool|technique/i.test(ctx), dilemma: "A new discovery could change how we live. But adopting it means changing old practices. Some see opportunity; others see the loss of tradition. How do we handle new knowledge?" },
  // Internal conflict
  { condition: (_, ctx) => /conflict|dispute|struggle|unrest|rebellion/i.test(ctx), dilemma: "Tensions are rising within the tribe. Two factions disagree about the direction we should take. Our current governance may need to adapt, or we risk tearing apart." },
  // Death and legacy
  { condition: (_, ctx) => /mourns|loss|died/i.test(ctx), dilemma: "We have lost members of our community. Their wisdom and labor are gone. How do we honor them? Should their beliefs live on in our rules, or do we forge a new path without them?" },
  // General — philosophical
  { condition: () => true, dilemma: "It is time to reflect on our way of life. Are our rules serving us well? What would we change if we could? What must we preserve at all costs?" },
  { condition: () => true, dilemma: "A member asks a hard question: 'Why do we follow these rules? Who decided them, and do they still make sense for who we are today?' The council must respond." },
  { condition: () => true, dilemma: "The world around us is changing. Other peoples exist beyond our borders. Our children grow up differently than we did. Should our rules evolve with the times, or are they the bedrock that keeps us together?" },
  { condition: () => true, dilemma: "Some members feel they have no voice in decisions. Others feel the current system gives too much power to a few. How should authority be distributed in our tribe?" },
];

function generateDilemma(tribe: TribeForDelib, population: number, context: string): string {
  // Find all matching dilemmas, preferring specific ones
  const matching = DILEMMAS.filter((d) => d.condition(population, context));

  // Prefer specific (non-always-true) dilemmas when available
  const specific = matching.filter((d) => d.condition !== (() => true));
  const pool = specific.length > 0 ? specific : matching;

  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked.dilemma;
}
