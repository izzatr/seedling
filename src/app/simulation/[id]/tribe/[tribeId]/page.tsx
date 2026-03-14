"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

type ThreadMessage = {
  agentId: string;
  name: string;
  content: string;
  round: number;
};

type Thread = {
  id: string;
  turnNumber: number;
  generationNumber: number;
  turnType: string;
  messages: ThreadMessage[];
  roundCount: number;
};

type RuleChange = {
  id: string;
  oldRule: string | null;
  newRule: string;
  domain: string;
  passed: boolean;
  turnNumber: number;
  voteResult: { agentId: string; agentName: string; decision: string; reasoning: string }[];
  proposedBy: string | null;
};

type TribeEvent = {
  id: string;
  category: string;
  severity: string;
  description: string;
  turnNumber: number;
};

type TribeData = {
  tribe: {
    id: string;
    name: string;
    governanceModel: string;
    votingThreshold: number;
    changeMagnitude: string;
    techLevel: number;
    rules: { domain: string; text: string }[];
    foundingRules: { domain: string; text: string }[];
    agents: {
      id: string;
      name: string;
      age: number;
      status: string;
      personality: string[];
      values: string[];
    }[];
    livingCount: number;
  };
  threads: Thread[];
  events: TribeEvent[];
  ruleChanges: RuleChange[];
};

const TRIBE_COLORS: Record<string, { accent: string; bg: string }> = {
  "The Keepers": { accent: "var(--color-keepers-accent)", bg: "rgba(196, 181, 160, 0.06)" },
  "The Moderates": { accent: "var(--color-moderates-accent)", bg: "rgba(212, 132, 90, 0.06)" },
  "The Adapters": { accent: "var(--color-adapters-accent)", bg: "rgba(76, 201, 176, 0.06)" },
  "The Free": { accent: "var(--color-free-accent)", bg: "rgba(232, 197, 71, 0.06)" },
};

export default function TribeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const simulationId = params.id as string;
  const tribeId = params.tribeId as string;

  const [data, setData] = useState<TribeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"deliberations" | "rules" | "events" | "members">("deliberations");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/simulation/${simulationId}/tribe/${tribeId}`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error("Failed to fetch tribe data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Poll for updates every 5s
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [simulationId, tribeId]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--color-text-dim)" }}>
        <div className="font-display text-2xl animate-pulse-subtle">Loading tribe history...</div>
      </div>
    );
  }

  const { tribe, threads, events, ruleChanges: changes } = data;
  const colors = TRIBE_COLORS[tribe.name] ?? { accent: "var(--color-text)", bg: "rgba(255,255,255,0.03)" };
  const livingAgents = tribe.agents.filter((a) => a.status === "alive");

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push(`/simulation/${simulationId}`)}
          className="font-mono text-xs mb-4 inline-block cursor-pointer transition-colors"
          style={{ color: "var(--color-text-dim)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-dim)")}
        >
          &larr; Back to simulation
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-light" style={{ color: colors.accent }}>
              {tribe.name}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-dim)" }}>
              {tribe.governanceModel} &middot; {Math.round(tribe.votingThreshold * 100)}% threshold &middot; {tribe.changeMagnitude} mutability
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="font-mono text-[10px] uppercase" style={{ color: "var(--color-text-dim)" }}>Population</div>
              <div className="font-mono text-xl font-bold" style={{ color: "var(--color-text)" }}>{tribe.livingCount}</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[10px] uppercase" style={{ color: "var(--color-text-dim)" }}>Councils</div>
              <div className="font-mono text-xl font-bold" style={{ color: colors.accent }}>{threads.length}</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[10px] uppercase" style={{ color: "var(--color-text-dim)" }}>Rule Changes</div>
              <div className="font-mono text-xl font-bold" style={{ color: colors.accent }}>{changes.filter((c) => c.passed).length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
        {(["deliberations", "rules", "events", "members"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all cursor-pointer"
            style={{
              color: tab === t ? colors.accent : "var(--color-text-dim)",
              borderBottom: tab === t ? `2px solid ${colors.accent}` : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "deliberations" && (
        <div className="space-y-6">
          {threads.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--color-text-dim)" }}>
              No council sessions yet. Start the simulation to see deliberations.
            </div>
          ) : (
            threads.map((thread) => {
              // Find rule changes and events for this turn
              const turnChanges = changes.filter((c) => c.turnNumber === thread.turnNumber);
              const turnEvents = events.filter((e) => e.turnNumber === thread.turnNumber);

              return (
                <div
                  key={thread.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  {/* Turn Header */}
                  <div
                    className="px-5 py-3 flex items-center justify-between"
                    style={{ background: colors.bg, borderBottom: "1px solid var(--color-border)" }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold" style={{ color: colors.accent }}>
                        Turn {thread.turnNumber}
                      </span>
                      <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded" style={{
                        background: "var(--color-surface-raised)",
                        color: thread.turnType === "milestone" ? "var(--color-warning)" : "var(--color-text-muted)",
                      }}>
                        {thread.turnType === "milestone" ? `Gen ${thread.generationNumber} Milestone` : `Gen ${thread.generationNumber}`}
                      </span>
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: "var(--color-text-dim)" }}>
                      {thread.messages.length} messages &middot; {thread.roundCount} rounds
                    </span>
                  </div>

                  {/* Events this turn */}
                  {turnEvents.length > 0 && (
                    <div className="px-5 py-2 space-y-1" style={{ background: "rgba(232, 197, 71, 0.03)" }}>
                      {turnEvents.map((evt) => (
                        <div key={evt.id} className="flex items-start gap-2">
                          <span className="text-xs" style={{ color: "var(--color-warning)" }}>&loz;</span>
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            <span className="font-mono text-[9px] uppercase mr-1.5" style={{ color: "var(--color-text-dim)" }}>
                              {evt.severity}
                            </span>
                            {evt.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Conversation */}
                  <div className="px-5 py-4 space-y-3">
                    {thread.messages.map((msg, i) => {
                      const isProposal = /I PROPOSE:/i.test(msg.content);
                      const isChallenge = /I CHALLENGE:/i.test(msg.content);

                      return (
                        <div
                          key={i}
                          className="rounded-lg p-3"
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
                                : "2px solid transparent",
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold" style={{ color: colors.accent }}>
                              {msg.name}
                            </span>
                            {isProposal && (
                              <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(76, 201, 176, 0.15)", color: "var(--color-success)" }}>
                                proposal
                              </span>
                            )}
                            {isChallenge && (
                              <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(212, 74, 74, 0.15)", color: "var(--color-danger)" }}>
                                challenge
                              </span>
                            )}
                            <span className="font-mono text-[9px] ml-auto" style={{ color: "var(--color-text-dim)" }}>
                              round {msg.round + 1}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                            {msg.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rule changes from this turn */}
                  {turnChanges.length > 0 && (
                    <div className="px-5 py-3 space-y-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                      {turnChanges.map((change) => (
                        <div key={change.id} className="rounded-lg p-3" style={{ background: change.passed ? "rgba(76, 201, 176, 0.05)" : "rgba(212, 74, 74, 0.05)" }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded" style={{
                              background: change.passed ? "rgba(76, 201, 176, 0.15)" : "rgba(212, 74, 74, 0.15)",
                              color: change.passed ? "var(--color-success)" : "var(--color-danger)",
                            }}>
                              {change.passed ? "passed" : "rejected"}
                            </span>
                            <span className="font-mono text-[9px] uppercase" style={{ color: "var(--color-text-dim)" }}>
                              {change.domain}
                            </span>
                          </div>
                          <p className="text-sm mb-2" style={{ color: "var(--color-text)" }}>
                            &ldquo;{change.newRule}&rdquo;
                          </p>
                          {/* Vote breakdown */}
                          <div className="flex flex-wrap gap-1.5">
                            {change.voteResult.map((vote, vi) => (
                              <span key={vi} className="text-[10px] px-1.5 py-0.5 rounded" style={{
                                background: "var(--color-surface)",
                                color: vote.decision === "approve" ? "var(--color-success)"
                                  : vote.decision === "reject" ? "var(--color-danger)"
                                    : "var(--color-text-dim)",
                              }}>
                                {vote.agentName}: {vote.decision}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "rules" && (
        <div className="space-y-4">
          <h3 className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-dim)" }}>
            Current Rules ({tribe.rules.length})
          </h3>
          {tribe.rules.map((rule, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg" style={{ background: "var(--color-surface)" }}>
              <span className="font-mono text-[10px] uppercase shrink-0 px-2 py-0.5 rounded h-fit"
                style={{ color: colors.accent, background: "var(--color-surface-raised)" }}>
                {rule.domain}
              </span>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{rule.text}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "events" && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--color-text-dim)" }}>No events recorded yet.</div>
          ) : (
            events.map((evt) => {
              const isBirth = evt.category === "birth";
              const isDeath = evt.category === "death";

              return (
                <div key={evt.id} className="flex gap-3 p-3 rounded-lg" style={{ background: "var(--color-surface)" }}>
                  <div className="shrink-0 text-center" style={{ minWidth: "50px" }}>
                    <div className="font-mono text-xs font-bold" style={{ color: colors.accent }}>T{evt.turnNumber}</div>
                    <div className="font-mono text-[9px] uppercase" style={{
                      color: isBirth ? "var(--color-success)"
                        : isDeath ? "var(--color-danger)"
                          : evt.severity === "catastrophic" ? "var(--color-danger)"
                            : evt.severity === "major" ? "var(--color-warning)"
                              : "var(--color-text-dim)",
                    }}>
                      {isBirth ? "birth" : isDeath ? "death" : evt.severity}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 flex-1">
                    <span className="text-sm mt-0.5" style={{
                      color: isBirth ? "var(--color-success)" : isDeath ? "var(--color-danger)" : "var(--color-text-muted)",
                    }}>
                      {isBirth ? "\u2022" : isDeath ? "\u2020" : "\u25C7"}
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{evt.description}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tribe.agents
            .sort((a, b) => (a.status === "alive" ? -1 : 1))
            .map((agent) => (
              <div key={agent.id} className="p-4 rounded-lg" style={{
                background: "var(--color-surface)",
                opacity: agent.status === "alive" ? 1 : 0.5,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: agent.status === "alive" ? colors.accent : "var(--color-text-dim)" }}>
                    {agent.name}
                  </span>
                  <span className="font-mono text-xs" style={{ color: "var(--color-text-dim)" }}>
                    {agent.status === "alive" ? `age ${agent.age}` : "deceased"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {agent.personality.map((trait, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{
                      background: "var(--color-surface-raised)", color: "var(--color-text-muted)",
                    }}>
                      {trait}
                    </span>
                  ))}
                </div>
                <div className="space-y-0.5">
                  {agent.values.map((v, i) => (
                    <p key={i} className="text-[11px] italic" style={{ color: "var(--color-text-dim)" }}>
                      &ldquo;{v}&rdquo;
                    </p>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
