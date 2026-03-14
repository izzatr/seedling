"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TRIBES = [
  {
    name: "The Keepers",
    tagline: "Guardians of the immutable",
    governance: "Council of Elders",
    threshold: "85%",
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
    <div
      className="h-screen flex flex-col relative overflow-hidden"
      style={{
        "--color-text-muted": "#3D3832",
        "--color-text-dim": "#5C564E",
      } as React.CSSProperties}
    >
      {/* Background video */}
      <div className="absolute inset-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/Generated Video March 14, 2026 - 2_36PM.mp4" type="video/mp4" />
        </video>
        {/* Gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(250, 248, 244, 0.9) 0%, rgba(250, 248, 244, 0.7) 25%, rgba(250, 248, 244, 0.4) 50%, rgba(250, 248, 244, 0.15) 75%, transparent 100%)",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Seedling" className="w-7 h-7 opacity-70" />
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
          v0.1 / generational social simulator
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
        <div className="max-w-5xl mx-auto text-center animate-fade-in-up">
          {/* Title */}
          <h1
            className="font-display text-5xl md:text-7xl font-light tracking-tight mb-3"
            style={{ color: "var(--color-text)" }}
          >
            Seedling
          </h1>

          <p
            className="text-base md:text-lg max-w-2xl mx-auto mb-2 leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            How does a society&rsquo;s willingness to change its own rules shape
            its long-term trajectory?
          </p>

          <p
            className="text-xs max-w-xl mx-auto mb-8"
            style={{ color: "var(--color-text-dim)" }}
          >
            Four tribes. Four philosophies. Powered by AI agents with
            personalities, values, and memories. Watch centuries of societal
            evolution unfold in minutes.
          </p>

          {/* Tribe Preview Cards — compact */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {TRIBES.map((tribe, i) => (
              <div
                key={tribe.name}
                className={`tribe-card-border rounded-lg p-3 text-left opacity-0 animate-fade-in-up stagger-${i + 1} transition-all duration-300 hover:translate-y-[-2px]`}
                style={
                  {
                    background: "rgba(250, 248, 244, 0.75)",
                    backdropFilter: "blur(8px)",
                    "--tribe-accent": `var(--color-${tribe.colorClass}-accent)`,
                  } as React.CSSProperties
                }
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-base"
                    style={{
                      color: `var(--color-${tribe.colorClass}-accent)`,
                    }}
                  >
                    {tribe.icon}
                  </span>
                  <div className="min-w-0">
                    <h3
                      className="font-display text-sm font-medium leading-tight"
                      style={{
                        color: `var(--color-${tribe.colorClass}-accent)`,
                      }}
                    >
                      {tribe.name}
                    </h3>
                    <p
                      className="text-[10px] leading-tight truncate"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      {tribe.tagline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono text-[9px] uppercase tracking-wider"
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

                <p
                  className="text-[10px] italic leading-snug line-clamp-2"
                  style={{
                    color: "var(--color-text-dim)",
                    borderLeft: `2px solid var(--color-${tribe.colorClass})`,
                    paddingLeft: "8px",
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
            className="group relative px-10 py-3 rounded-full font-display text-base tracking-wide transition-all duration-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.7))",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
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
            className="mt-2 font-mono text-[10px]"
            style={{ color: "var(--color-text-dim)" }}
          >
            5 generations &middot; ~125 turns &middot; powered by Gemini
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 px-8 py-3 flex justify-between items-center"
        style={{
          color: "var(--color-text-dim)",
        }}
      >
        <span className="font-mono text-[10px]">
          AI agents with souls, values, and memories
        </span>
        <span className="font-mono text-[10px]">Gemini 3 Hackathon Paris</span>
      </footer>
    </div>
  );
}
