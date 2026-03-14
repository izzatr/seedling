"use client";

import { useRef, useEffect } from "react";
import type { TribeRule } from "@/db/schema";

export type SpeechMessage = {
  agentName: string;
  content: string;
  round: number;
  timestamp: number;
};

type TribeCardProps = {
  id: string;
  simulationId: string;
  name: string;
  governanceModel: string;
  votingThreshold: number;
  changeMagnitude: string;
  techLevel: number;
  rules: TribeRule[];
  agents: {
    id: string;
    name: string;
    age: number;
    status: string;
    personality: string[];
  }[];
  livingCount: number;
  economy?: {
    avgFood: number;
    avgWealth: number;
    hungry: number;
    communalPool: { food: number; wealth: number };
  };
  conversation: SpeechMessage[];
  expanded?: boolean;
  onToggle?: () => void;
};

const COLOR_MAP: Record<string, { color: string; accent: string; glow: string }> = {
  "The Keepers": {
    color: "var(--color-keepers)",
    accent: "var(--color-keepers-accent)",
    glow: "glow-keepers",
  },
  "The Moderates": {
    color: "var(--color-moderates)",
    accent: "var(--color-moderates-accent)",
    glow: "glow-moderates",
  },
  "The Adapters": {
    color: "var(--color-adapters)",
    accent: "var(--color-adapters-accent)",
    glow: "glow-adapters",
  },
  "The Free": {
    color: "var(--color-free)",
    accent: "var(--color-free-accent)",
    glow: "glow-free",
  },
};

const ICON_MAP: Record<string, string> = {
  "The Keepers": "\u25C6",
  "The Moderates": "\u25B3",
  "The Adapters": "\u25CB",
  "The Free": "\u2726",
};

export default function TribeCard({
  id,
  simulationId,
  name,
  governanceModel,
  votingThreshold,
  changeMagnitude,
  techLevel,
  rules,
  agents,
  livingCount,
  economy,
  conversation,
  expanded,
  onToggle,
}: TribeCardProps) {
  const colors = COLOR_MAP[name] ?? {
    color: "var(--color-text-muted)",
    accent: "var(--color-text)",
    glow: "",
  };
  const icon = ICON_MAP[name] ?? "\u25CF";
  const livingAgents = agents.filter((a) => a.status === "alive");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll conversation to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length]);

  return (
    <div
      className={`tribe-card-border rounded-xl transition-all duration-300 ${colors.glow}`}
      style={
        {
          background: "var(--color-surface)",
          "--tribe-accent": colors.accent,
        } as React.CSSProperties
      }
    >
      {/* Header — clickable to expand */}
      <div className="p-5 pb-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" style={{ color: colors.accent }}>
              {icon}
            </span>
            <div>
              <h3
                className="font-display text-lg font-medium"
                style={{ color: colors.accent }}
              >
                {name}
              </h3>
              <p
                className="text-xs"
                style={{ color: "var(--color-text-dim)" }}
              >
                {governanceModel}
              </p>
            </div>
          </div>

          {/* Population badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: livingCount > 3 ? "var(--color-success)" : "var(--color-danger)",
              }}
            />
            <span className="font-mono text-xs" style={{ color: "var(--color-text)" }}>
              {livingCount}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div
          className="grid grid-cols-5 gap-2 p-3 rounded-lg mb-3"
          style={{ background: "var(--color-surface-raised)" }}
        >
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-dim)" }}>
              Threshold
            </div>
            <div className="font-mono text-sm font-bold" style={{ color: colors.accent }}>
              {Math.round(votingThreshold * 100)}%
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-dim)" }}>
              Food
            </div>
            <div className="font-mono text-sm font-bold" style={{
              color: (economy?.avgFood ?? 0) < 5 ? "var(--color-danger)" : "var(--color-text)",
            }}>
              {economy?.avgFood?.toFixed(0) ?? "—"}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-dim)" }}>
              Wealth
            </div>
            <div className="font-mono text-sm font-bold" style={{ color: "var(--color-text)" }}>
              {economy?.avgWealth?.toFixed(1) ?? "—"}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-dim)" }}>
              Hungry
            </div>
            <div className="font-mono text-sm font-bold" style={{
              color: (economy?.hungry ?? 0) > 0 ? "var(--color-danger)" : "var(--color-success)",
            }}>
              {economy?.hungry ?? 0}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-text-dim)" }}>
              Pool
            </div>
            <div className="font-mono text-sm font-bold" style={{ color: "var(--color-text)" }}>
              {economy?.communalPool?.food ?? 0}
            </div>
          </div>
        </div>

        {/* Living Members */}
        <div className="flex flex-wrap gap-1.5">
          {livingAgents.slice(0, 8).map((agent) => (
            <span
              key={agent.id}
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{
                background: "var(--color-surface-raised)",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              {agent.name}
              <span
                className="font-mono ml-1"
                style={{ color: "var(--color-text-dim)", fontSize: "9px" }}
              >
                {agent.age}
              </span>
            </span>
          ))}
          {livingAgents.length > 8 && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ color: "var(--color-text-dim)" }}
            >
              +{livingAgents.length - 8} more
            </span>
          )}
        </div>
      </div>

      {/* Conversation Thread — the main attraction */}
      <div
        className="border-t px-4 py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h4
          className="font-mono text-[10px] uppercase tracking-wider mb-3 flex items-center justify-between"
          style={{ color: "var(--color-text-dim)" }}
        >
          <span className="flex items-center gap-2">
            Council Deliberation
            {conversation.length > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-subtle"
                style={{ background: colors.accent }}
              />
            )}
          </span>
          <span className="flex items-center gap-3">
            {conversation.length} messages
            <a
              href={`/simulation/${simulationId}/tribe/${id}`}
              className="underline transition-colors hover:text-[var(--color-text)]"
              onClick={(e) => e.stopPropagation()}
            >
              full history &rarr;
            </a>
          </span>
        </h4>

        {conversation.length === 0 ? (
          <div
            className="text-center py-6 text-xs italic"
            style={{ color: "var(--color-text-dim)" }}
          >
            Awaiting the next council session...
          </div>
        ) : (
          <div
            className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1"
          >
            {conversation.map((msg, i) => {
              const isProposal = /I PROPOSE:/i.test(msg.content);
              const isChallenge = /I CHALLENGE:/i.test(msg.content);
              const isSilent = msg.content.includes("[stays silent]");

              if (isSilent) return null;

              return (
                <div
                  key={i}
                  className="rounded-lg p-2.5 transition-colors"
                  style={{
                    background: isProposal
                      ? "rgba(76, 201, 176, 0.06)"
                      : isChallenge
                        ? "rgba(212, 74, 74, 0.06)"
                        : "var(--color-surface-raised)",
                    borderLeft: isProposal
                      ? "2px solid var(--color-success)"
                      : isChallenge
                        ? "2px solid var(--color-danger)"
                        : `2px solid transparent`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: colors.accent }}
                    >
                      {msg.agentName}
                    </span>
                    {isProposal && (
                      <span
                        className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(76, 201, 176, 0.15)",
                          color: "var(--color-success)",
                        }}
                      >
                        proposal
                      </span>
                    )}
                    {isChallenge && (
                      <span
                        className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(212, 74, 74, 0.15)",
                          color: "var(--color-danger)",
                        }}
                      >
                        challenge
                      </span>
                    )}
                    <span
                      className="font-mono text-[9px] ml-auto"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      r{msg.round + 1}
                    </span>
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {msg.content}
                  </p>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Expanded: Rules */}
      {expanded && (
        <div
          className="border-t px-5 py-4 animate-fade-in"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h4
            className="font-mono text-[10px] uppercase tracking-wider mb-3"
            style={{ color: "var(--color-text-dim)" }}
          >
            Current Rules ({changeMagnitude} mutability)
          </h4>
          <div className="space-y-2">
            {rules.map((rule, i) => (
              <div key={i} className="flex gap-2">
                <span
                  className="font-mono text-[10px] uppercase shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                  style={{
                    color: colors.accent,
                    background: "var(--color-surface-raised)",
                  }}
                >
                  {rule.domain.slice(0, 3)}
                </span>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {rule.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
