import { generateText } from "ai";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { turnEvents, type EventEffects, type TribeRule } from "@/db/schema";
import { flashModel } from "../ai/models";
import { buildEventFlavorPrompt } from "../ai/prompts";
import { EVENT_TEMPLATES, pickRandom } from "../constants";
import { broadcast } from "./sse";

type TurnType = "regular" | "council" | "milestone";

export async function rollForEvents(
  simulationId: string,
  turnId: string,
  tribeId: string,
  tribeName: string,
  tribeRules: TribeRule[],
  turnType: TurnType,
  currentTurn: number
): Promise<
  {
    category: string;
    severity: string;
    description: string;
    effects: EventEffects;
  }[]
> {
  // Event probability by turn type
  const probability =
    turnType === "regular" ? 0.1 : turnType === "council" ? 0.4 : 0.6;

  if (Math.random() > probability) return [];

  // Pick severity based on turn type
  const severity = pickSeverity(turnType);

  // Find matching templates
  const matching = EVENT_TEMPLATES.filter((t) => t.severity === severity);
  if (matching.length === 0) return [];

  const template = pickRandom(matching);
  const templateText = pickRandom(template.templates);

  // Generate flavor text with LLM
  let description = templateText;
  try {
    const flavorPrompt = buildEventFlavorPrompt(
      tribeName,
      tribeRules,
      templateText,
      severity
    );
    const result = await generateText({
      model: flashModel,
      messages: [{ role: "user", content: flavorPrompt }],
    });
    description = result.text.trim();
  } catch {
    // Fall back to template text
  }

  const event = {
    category: template.category,
    severity: template.severity,
    description,
    effects: template.effects as EventEffects,
  };

  // Persist
  await db.insert(turnEvents).values({
    id: nanoid(),
    turnId,
    tribeId,
    eventCategory: event.category as "scarcity" | "abundance" | "disaster" | "discovery" | "internal_conflict" | "external" | "cultural" | "mystery",
    severity: event.severity as "minor" | "moderate" | "major" | "catastrophic",
    description: event.description,
    effects: event.effects,
  });

  // Broadcast
  broadcast(simulationId, "happening", {
    type: "event",
    tribeId,
    tribeName,
    category: event.category,
    severity: event.severity,
    description: event.description,
    turn: currentTurn,
  });

  return [event];
}

function pickSeverity(turnType: TurnType): string {
  const roll = Math.random();

  if (turnType === "regular") {
    return "minor"; // Regular turns only get minor events
  }

  if (turnType === "council") {
    if (roll < 0.5) return "moderate";
    if (roll < 0.85) return "major";
    return "catastrophic";
  }

  // Milestone
  if (roll < 0.3) return "moderate";
  if (roll < 0.7) return "major";
  return "catastrophic";
}
