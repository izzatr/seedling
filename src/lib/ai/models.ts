import { createGoogleGenerativeAI } from "@ai-sdk/google";

// ── Provider ──

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ── Models ──

// Fast model: Gemini 2.5 Flash Lite — 4K RPM, 4M TPM, free tier
// Used for bulk agent work: deliberation, voting, flavor text, inheritance
export const flashModel = google("gemini-2.5-flash-lite");

// Smart model: Gemini 3 Flash — nuanced judgment, narratives
export const proModel = google("gemini-3-flash-preview");
