"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TRIBES = [
  {
    name: "The Keepers",
    tagline: "Guardians of the immutable",
    governance: "Council of Elders",
    threshold: "95%",
    magnitude: "Minor clarifications only",
    philosophy:
      "Our ancestors' wisdom is absolute. What they established, we preserve.",
    colorClass: "keepers",
    icon: "\u25C6",
  },
  {
    name: "The Moderates",
    tagline: "Steady hands, open minds",
    governance: "Elected Leader + Advisory Council",
    threshold: "80%",
    magnitude: "Small adjustments",
    philosophy:
      "We honor our traditions but acknowledge that the world changes.",
    colorClass: "moderates",
    icon: "\u25B3",
  },
  {
    name: "The Adapters",
    tagline: "Question everything",
    governance: "Direct Democracy",
    threshold: "60%",
    magnitude: "Moderate rewrites",
    philosophy:
      "A rule that no longer serves us should be changed.",
    colorClass: "adapters",
    icon: "\u25CB",
  },
  {
    name: "The Free",
    tagline: "The only constant is change",
    governance: "Consensus-based (no formal structure)",
    threshold: "51%",
    magnitude: "Any change, including reversals",
    philosophy:
      "Rules are guidelines, not chains. If a rule doesn't work, we change it immediately.",
    colorClass: "free",
    icon: "\u2726",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch("/api/simulation", { method: "POST" });
      const data = await res.json();
      router.push(`/simulation/${data.id}`);
    } catch (err) {
      console.error("Failed to create simulation:", err);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background atmosphere */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(122, 111, 94, 0.08), transparent), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(30, 122, 106, 0.06), transparent), radial-gradient(ellipse 50% 30% at 20% 90%, rgba(184, 92, 58, 0.05), transparent)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, #C4B5A0, #D4845A, #4CC9B0, #E8C547, #C4B5A0)",
              opacity: 0.7,
            }}
          />
          <span
            className="font-display text-lg tracking-wide"
            style={{ color: "var(--color-text-muted)" }}
          >
            seedling
          </span>
        </div>
        <div
          className="font-mono text-xs"
          style={{ color: "var(--color-text-dim)" }}
        >
          v0.1 / civilization simulator
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-16">
        <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
          {/* Title */}
          <h1
            className="font-display text-6xl md:text-8xl font-light tracking-tight mb-6"
            style={{ color: "var(--color-text)" }}
          >
            Seedling
          </h1>

          <p
            className="text-lg md:text-xl max-w-2xl mx-auto mb-4 leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            How does a society&rsquo;s willingness to change its own rules shape
            its long-term trajectory?
          </p>

          <p
            className="text-sm max-w-xl mx-auto mb-16"
            style={{ color: "var(--color-text-dim)" }}
          >
            Four tribes. Four philosophies. Powered by AI agents with
            personalities, values, and memories. Watch centuries of societal
            evolution unfold in minutes.
          </p>

          {/* Tribe Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {TRIBES.map((tribe, i) => (
              <div
                key={tribe.name}
                className={`tribe-card-border rounded-xl p-5 text-left opacity-0 animate-fade-in-up stagger-${i + 1} transition-all duration-300 hover:translate-y-[-2px]`}
                style={
                  {
                    background: "var(--color-surface)",
                    "--tribe-accent": `var(--color-${tribe.colorClass}-accent)`,
                  } as React.CSSProperties
                }
              >
                {/* Tribe icon + name */}
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="text-xl"
                    style={{
                      color: `var(--color-${tribe.colorClass}-accent)`,
                    }}
                  >
                    {tribe.icon}
                  </span>
                  <div>
                    <h3
                      className="font-display text-base font-medium"
                      style={{
                        color: `var(--color-${tribe.colorClass}-accent)`,
                      }}
                    >
                      {tribe.name}
                    </h3>
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      {tribe.tagline}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span
                      className="font-mono text-[10px] uppercase tracking-wider"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      Governance
                    </span>
                    <span
                      className="text-xs text-right"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {tribe.governance}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className="font-mono text-[10px] uppercase tracking-wider"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      Threshold
                    </span>
                    <span
                      className="font-mono text-xs font-bold"
                      style={{
                        color: `var(--color-${tribe.colorClass}-accent)`,
                      }}
                    >
                      {tribe.threshold}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className="font-mono text-[10px] uppercase tracking-wider"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      Mutability
                    </span>
                    <span
                      className="text-xs text-right"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {tribe.magnitude}
                    </span>
                  </div>
                </div>

                {/* Philosophy quote */}
                <p
                  className="text-xs italic leading-relaxed"
                  style={{
                    color: "var(--color-text-dim)",
                    borderLeft: `2px solid var(--color-${tribe.colorClass})`,
                    paddingLeft: "10px",
                  }}
                >
                  &ldquo;{tribe.philosophy}&rdquo;
                </p>
              </div>
            ))}
          </div>

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={loading}
            className="group relative px-12 py-4 rounded-full font-display text-lg tracking-wide transition-all duration-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--color-text-muted)]"
            style={{
              background:
                "linear-gradient(135deg, rgba(122, 111, 94, 0.08), rgba(35, 128, 112, 0.08))",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            {loading ? (
              <span className="animate-pulse-subtle">
                Seeding civilizations...
              </span>
            ) : (
              <>Begin Simulation</>
            )}
          </button>

          <p
            className="mt-4 font-mono text-[10px]"
            style={{ color: "var(--color-text-dim)" }}
          >
            5 generations &middot; ~125 turns &middot; powered by Gemini
          </p>
        </div>
      </main>

      {/* Footer line */}
      <footer
        className="relative z-10 border-t px-8 py-4 flex justify-between items-center"
        style={{
          borderColor: "var(--color-border)",
          color: "var(--color-text-dim)",
        }}
      >
        <span className="font-mono text-[10px]">
          AI agents with souls, values, and memories
        </span>
        <span className="font-mono text-[10px]">hackathon 2025</span>
      </footer>
    </div>
  );
}
