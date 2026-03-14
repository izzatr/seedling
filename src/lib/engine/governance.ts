import { generateText } from "ai";
import { flashModel, proModel } from "../ai/models";
import { buildVoterSoul } from "../ai/soul";
import { buildMagnitudeEvaluationPrompt } from "../ai/prompts";
import type { TribeRule, AgentMemory, AgentRelationship, VoteRecord } from "@/db/schema";
import type { Proposal } from "../agents/deliberation";

type AgentForVote = {
  id: string;
  name: string;
  age: number;
  personality: string[];
  values: string[];
  memories: AgentMemory[];
  relationships: AgentRelationship[];
};

type TribeForVote = {
  name: string;
  rules: TribeRule[];
  governanceModel: string;
  votingThreshold: number;
  changeMagnitude: "minor" | "small" | "moderate" | "any";
};

export async function evaluateMagnitude(
  tribe: TribeForVote,
  proposal: Proposal
): Promise<{ allowed: boolean; reasoning: string }> {
  try {
    const prompt = buildMagnitudeEvaluationPrompt(
      tribe.rules,
      proposal.ruleText,
      proposal.domain,
      tribe.changeMagnitude,
      proposal.replacesRule
    );

    const result = await generateText({
      model: proModel,
      messages: [{ role: "user", content: prompt }],
    });

    const cleaned = result.text
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/```json\n?|```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      allowed: Boolean(parsed.allowed),
      reasoning: parsed.reasoning || "No reasoning provided.",
    };
  } catch (error) {
    console.error("Magnitude evaluation error:", error);
    // Default: reject if we can't evaluate
    return { allowed: false, reasoning: "Evaluation failed — defaulting to reject." };
  }
}

export async function runVote(
  tribe: TribeForVote,
  agents: AgentForVote[],
  proposal: Proposal
): Promise<{ passed: boolean; votes: VoteRecord[] }> {
  // First check magnitude
  const magnitude = await evaluateMagnitude(tribe, proposal);
  if (!magnitude.allowed) {
    return {
      passed: false,
      votes: [
        {
          agentId: "system",
          agentName: "Magnitude Check",
          decision: "reject",
          reasoning: magnitude.reasoning,
        },
      ],
    };
  }

  // Sample voters for large tribes to stay within API limits
  // Shuffle and take up to 10 voters — representative sample
  const MAX_VOTERS = 10;
  const voters = agents.length <= MAX_VOTERS
    ? agents
    : [...agents].sort(() => Math.random() - 0.5).slice(0, MAX_VOTERS);

  // Run votes in small batches with delays
  const voteResults: VoteRecord[] = [];
  const VOTE_BATCH = 3;
  for (let i = 0; i < voters.length; i += VOTE_BATCH) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));
    const batch = voters.slice(i, i + VOTE_BATCH);
    const batchResults = await Promise.all(batch.map(async (agent): Promise<VoteRecord> => {
    try {
      const soul = buildVoterSoul(agent, tribe, {
        ruleText: proposal.ruleText,
        domain: proposal.domain,
        justification: proposal.justification,
        proposedBy: proposal.agentName,
      });

      const result = await generateText({
        model: flashModel,
        system: soul,
        messages: [
          {
            role: "user",
            content: "Cast your vote now. Respond with the JSON format specified.",
          },
        ],
      });

      // Strip <think> tags and code fences from thinking models
      const cleaned = result.text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/```json\n?|```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        agentId: agent.id,
        agentName: agent.name,
        decision: parsed.decision ?? "abstain",
        reasoning: parsed.reasoning ?? "No reason given.",
      };
    } catch {
      return {
        agentId: agent.id,
        agentName: agent.name,
        decision: "abstain",
        reasoning: "Failed to reach a decision.",
      };
    }
  }));
    voteResults.push(...batchResults);
  }

  // Tally
  const approvals = voteResults.filter((v) => v.decision === "approve").length;
  const total = voteResults.filter((v) => v.decision !== "abstain").length;
  const approvalRate = total > 0 ? approvals / total : 0;
  const passed = approvalRate >= tribe.votingThreshold;

  return { passed, votes: voteResults };
}
