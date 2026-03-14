"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

// ── Types ──

type TribeRule = { domain: string; text: string };

type VoteDetail = {
  agentId: string;
  agentName: string;
  decision: "approve" | "reject" | "abstain";
  reasoning: string;
};

type RuleChangeDetail = {
  domain: string;
  oldRule: string | null;
  newRule: string;
  proposedBy: string;
  turnNumber: number;
  generation: number;
  votes: { approve: number; reject: number; abstain: number; total: number };
  voteDetails: VoteDetail[];
};

type EventItem = {
  description: string;
  category: string;
  severity: string;
  turnNumber: number;
  generation: number;
  effects: {
    populationChange?: number;
    resourceChange?: { food?: number; materials?: number };
    techLevelChange?: number;
  };
};

type TribeReport = {
  id: string;
  name: string;
  governanceModel: string;
  votingThreshold: number;
  changeMagnitude: string;
  techLevel: number;
  resources: { food: number; materials: number; capacity: number };
  drift: { overallDrift: number; domainDrift: Record<string, number> };
  population: { total: number; living: number; dead: number };
  demographics: {
    avgLifespan: number;
    causesOfDeath: Record<string, number>;
    generationBreakdown: Record<string, { born: number; died: number }>;
    foundersTotal: number;
    foundersAlive: number;
  };
  notableAgents: {
    oldest: { name: string; age: number; status: string; personality: string[]; values: string[] } | null;
    mostConnected: { name: string; relationshipCount: number; status: string } | null;
    mostProlific: { name: string; childCount: number; status: string } | null;
  };
  ruleChanges: {
    passed: number;
    rejected: number;
    total: number;
    details: RuleChangeDetail[];
  };
  events: {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    timeline: EventItem[];
  };
  deliberations: {
    total: number;
    highlights: {
      turnNumber: number;
      generation: number;
      roundCount: number;
      speakerCount: number;
      excerpt: { name: string; content: string }[];
    }[];
  };
  turningPoints: {
    turnNumber: number;
    generation: number;
    description: string;
    type: "event" | "rule_change";
  }[];
  crisisSurvivalRate: number;
  economy: {
    communalPool: { food: number; wealth: number };
    avgFood: number;
    avgWealth: number;
    totalFood: number;
    totalWealth: number;
    hungry: number;
    starving: number;
    inequality: number;
    starvationDeaths: number;
    scarcityEvents: number;
    timeline: {
      turn: number;
      population: number;
      avgFood: number;
      avgWealth: number;
      totalFood: number;
      totalWealth: number;
      hungry: number;
      starving: number;
      communalFood: number;
      communalWealth: number;
      inequality: number;
    }[];
  };
  foundingRules: TribeRule[];
  currentRules: TribeRule[];
};

type ContactInfo = {
  tribeA: string;
  tribeB: string;
  stage: string;
  firstContactTurn: number;
  sentiment: number;
};

type ReportData = {
  simulation: {
    id: string;
    name: string;
    totalTurns: number;
    totalGenerations: number;
    councilInterval: number;
    generationLength: number;
  };
  tribes: TribeReport[];
  contacts: ContactInfo[];
  worldHistory: string;
  divergenceAnalysis: string;
};

// ── Constants ──

const TRIBE_COLORS: Record<string, { accent: string; bg: string; glow: string; hex: string }> = {
  "The Keepers": { accent: "var(--color-keepers-accent)", bg: "rgba(196, 181, 160, 0.08)", glow: "rgba(196, 181, 160, 0.15)", hex: "#7A6F5E" },
  "The Moderates": { accent: "var(--color-moderates-accent)", bg: "rgba(212, 132, 90, 0.08)", glow: "rgba(212, 132, 90, 0.15)", hex: "#B85C3A" },
  "The Adapters": { accent: "var(--color-adapters-accent)", bg: "rgba(76, 201, 176, 0.08)", glow: "rgba(76, 201, 176, 0.15)", hex: "#238070" },
  "The Free": { accent: "var(--color-free-accent)", bg: "rgba(232, 197, 71, 0.08)", glow: "rgba(232, 197, 71, 0.15)", hex: "#B8911F" },
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: "var(--color-text-dim)",
  moderate: "var(--color-info)",
  major: "var(--color-warning)",
  catastrophic: "var(--color-danger)",
};

const DOMAIN_LABELS: Record<string, string> = {
  governance: "GOV",
  economy: "ECON",
  social: "SOC",
  cultural: "CULT",
  external: "EXT",
};

// ── Helpers ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-mono text-[10px] uppercase tracking-[0.15em] mb-3"
      style={{ color: "var(--color-text-dim)" }}
    >
      {children}
    </h3>
  );
}

function StatBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div
        className="font-mono text-[10px] uppercase mb-1"
        style={{ color: "var(--color-text-dim)" }}
      >
        {label}
      </div>
      <div
        className="font-mono text-sm font-bold"
        style={{ color: color || "var(--color-text)" }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="font-mono text-[10px] mt-0.5"
          style={{ color: "var(--color-text-dim)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function DriftBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="font-mono text-[10px] uppercase tracking-wider w-10 shrink-0"
        style={{ color: "var(--color-text-dim)" }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--color-surface-raised)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${Math.min(100, value)}%`,
            background: color,
            opacity: 0.7,
          }}
        />
      </div>
      <span
        className="font-mono text-[10px] w-8 text-right"
        style={{ color: "var(--color-text-muted)" }}
      >
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Main Component ──

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const simulationId = params.id as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTribe, setExpandedTribe] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/simulation/${simulationId}/report`);
        if (res.ok) {
          const data = await res.json();
          setReport(data);
        }
      } catch (err) {
        console.error("Failed to fetch report:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [simulationId]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ color: "var(--color-text-dim)" }}
      >
        <div className="text-center">
          <div className="font-display text-2xl mb-2 animate-pulse-subtle">
            Compiling the chronicles...
          </div>
          <p className="font-mono text-xs">
            Analyzing divergence across generations
          </p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ color: "var(--color-text-dim)" }}
      >
        Report not found.
      </div>
    );
  }

  const getTribeSection = (tribeId: string) =>
    activeSection[tribeId] || "overview";
  const setTribeSection = (tribeId: string, section: string) =>
    setActiveSection((prev) => ({ ...prev, [tribeId]: section }));

  // Sort tribes by drift (most changed first)
  const sortedTribes = [...report.tribes].sort(
    (a, b) => b.drift.overallDrift - a.drift.overallDrift
  );

  // Find the tribe with the highest/lowest drift
  const mostDrifted = sortedTribes[0];
  const leastDrifted = sortedTribes[sortedTribes.length - 1];

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-10 animate-fade-in-up">
        <button
          onClick={() => router.push(`/simulation/${simulationId}`)}
          className="font-mono text-xs mb-6 inline-block cursor-pointer transition-colors"
          style={{ color: "var(--color-text-dim)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--color-text)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--color-text-dim)")
          }
        >
          &larr; Back to simulation
        </button>

        <h1
          className="font-display text-4xl md:text-5xl font-light mb-2"
          style={{ color: "var(--color-text)" }}
        >
          Divergence Report
        </h1>
        <p
          className="font-mono text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          {report.simulation.totalTurns} turns &middot;{" "}
          {report.simulation.totalGenerations} generations &middot; council
          every {report.simulation.councilInterval} turns
        </p>
      </div>

      {/* ── Comparative Dashboard ── */}
      <div className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <SectionLabel>Comparative Overview</SectionLabel>
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {/* Table Header */}
          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: "140px repeat(4, 1fr)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div className="p-3" />
            {sortedTribes.map((tribe) => {
              const colors = TRIBE_COLORS[tribe.name];
              return (
                <div
                  key={tribe.id}
                  className="p-3 text-center"
                  style={{ borderLeft: "1px solid var(--color-border)" }}
                >
                  <span
                    className="font-display text-sm font-medium"
                    style={{ color: colors?.accent || "var(--color-text)" }}
                  >
                    {tribe.name.replace("The ", "")}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Metrics Rows */}
          {[
            {
              label: "Drift",
              render: (t: TribeReport) => (
                <span
                  className="font-mono text-sm font-bold"
                  style={{
                    color:
                      TRIBE_COLORS[t.name]?.accent || "var(--color-text)",
                  }}
                >
                  {t.drift.overallDrift.toFixed(1)}%
                </span>
              ),
            },
            {
              label: "Population",
              render: (t: TribeReport) => (
                <span className="font-mono text-sm">
                  {t.population.living}{" "}
                  <span style={{ color: "var(--color-text-dim)" }}>
                    / {t.population.total}
                  </span>
                </span>
              ),
            },
            {
              label: "Rules Changed",
              render: (t: TribeReport) => (
                <span className="font-mono text-sm">
                  {t.ruleChanges.passed}{" "}
                  <span style={{ color: "var(--color-text-dim)" }}>
                    of {t.ruleChanges.total}
                  </span>
                </span>
              ),
            },
            {
              label: "Tech Level",
              render: (t: TribeReport) => (
                <span className="font-mono text-sm">Lv{t.techLevel}</span>
              ),
            },
            {
              label: "Events",
              render: (t: TribeReport) => (
                <span className="font-mono text-sm">{t.events.total}</span>
              ),
            },
            {
              label: "Avg Lifespan",
              render: (t: TribeReport) => (
                <span className="font-mono text-sm">
                  {t.demographics.avgLifespan || "—"}
                </span>
              ),
            },
            {
              label: "Avg Food",
              render: (t: TribeReport) => (
                <span
                  className="font-mono text-sm"
                  style={{
                    color:
                      t.economy.avgFood < 3
                        ? "var(--color-danger)"
                        : t.economy.avgFood < 5
                          ? "var(--color-warning)"
                          : "var(--color-text)",
                  }}
                >
                  {t.economy.avgFood}
                </span>
              ),
            },
            {
              label: "Avg Wealth",
              render: (t: TribeReport) => (
                <span className="font-mono text-sm">{t.economy.avgWealth}</span>
              ),
            },
            {
              label: "Inequality",
              render: (t: TribeReport) => (
                <span
                  className="font-mono text-sm"
                  style={{
                    color:
                      t.economy.inequality > 60
                        ? "var(--color-danger)"
                        : t.economy.inequality > 35
                          ? "var(--color-warning)"
                          : "var(--color-success)",
                  }}
                >
                  {t.economy.inequality}%
                </span>
              ),
            },
            {
              label: "Crisis Survival",
              render: (t: TribeReport) => (
                <span
                  className="font-mono text-sm"
                  style={{
                    color:
                      t.crisisSurvivalRate >= 75
                        ? "var(--color-success)"
                        : t.crisisSurvivalRate >= 50
                          ? "var(--color-warning)"
                          : "var(--color-danger)",
                  }}
                >
                  {t.crisisSurvivalRate}%
                </span>
              ),
            },
            {
              label: "Founders Alive",
              render: (t: TribeReport) => (
                <span className="font-mono text-sm">
                  {t.demographics.foundersAlive}{" "}
                  <span style={{ color: "var(--color-text-dim)" }}>
                    / {t.demographics.foundersTotal}
                  </span>
                </span>
              ),
            },
          ].map((row) => (
            <div
              key={row.label}
              className="grid gap-0"
              style={{
                gridTemplateColumns: "140px repeat(4, 1fr)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div
                className="p-3 font-mono text-[10px] uppercase tracking-wider flex items-center"
                style={{ color: "var(--color-text-dim)" }}
              >
                {row.label}
              </div>
              {sortedTribes.map((tribe) => (
                <div
                  key={tribe.id}
                  className="p-3 text-center flex items-center justify-center"
                  style={{
                    borderLeft: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  {row.render(tribe)}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Drift Comparison Visual */}
        <div className="mt-4 flex gap-3">
          {sortedTribes.map((tribe) => {
            const colors = TRIBE_COLORS[tribe.name];
            return (
              <div key={tribe.id} className="flex-1">
                <div
                  className="h-24 rounded-lg relative overflow-hidden"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 transition-all duration-1000 rounded-b-lg"
                    style={{
                      height: `${Math.min(100, tribe.drift.overallDrift)}%`,
                      background: `linear-gradient(to top, ${colors?.accent || "#fff"}20, ${colors?.accent || "#fff"}08)`,
                      borderTop: `2px solid ${colors?.accent || "#fff"}50`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="font-mono text-lg font-bold"
                      style={{ color: colors?.accent || "var(--color-text)" }}
                    >
                      {tribe.drift.overallDrift.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div
                  className="text-center mt-1 font-mono text-[10px]"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  {tribe.name.replace("The ", "")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Cross-Tribe Comparison Charts ── */}
      {(() => {
        // Merge all tribe timelines into unified turn-keyed data
        const hasTimelines = report.tribes.some(
          (t) => t.economy.timeline.length > 1
        );
        if (!hasTimelines) return null;

        // Build merged data: one row per turn with columns per tribe
        const turnSet = new Set<number>();
        for (const tribe of report.tribes) {
          for (const snap of tribe.economy.timeline) {
            turnSet.add(snap.turn);
          }
        }
        const allTurns = [...turnSet].sort((a, b) => a - b);

        // Build lookup per tribe
        const tribeLookups = report.tribes.map((tribe) => {
          const lookup = new Map<number, (typeof tribe.economy.timeline)[0]>();
          for (const snap of tribe.economy.timeline) {
            lookup.set(snap.turn, snap);
          }
          const shortName = tribe.name.replace("The ", "");
          return { tribe, shortName, lookup };
        });

        const mergedData = allTurns.map((turn) => {
          const row: Record<string, number> = { turn };
          for (const { shortName, lookup } of tribeLookups) {
            const snap = lookup.get(turn);
            if (snap) {
              row[`${shortName}_pop`] = snap.population;
              row[`${shortName}_food`] = snap.avgFood;
              row[`${shortName}_wealth`] = snap.avgWealth;
              row[`${shortName}_ineq`] = snap.inequality;
              row[`${shortName}_hungry`] = snap.hungry;
            }
          }
          return row;
        });

        // Build chart configs
        const popConfig: ChartConfig = {};
        const foodConfig: ChartConfig = {};
        const wealthConfig: ChartConfig = {};
        const ineqConfig: ChartConfig = {};
        for (const { tribe, shortName } of tribeLookups) {
          const hex = TRIBE_COLORS[tribe.name]?.hex || "#888";
          popConfig[`${shortName}_pop`] = { label: shortName, color: hex };
          foodConfig[`${shortName}_food`] = { label: shortName, color: hex };
          wealthConfig[`${shortName}_wealth`] = { label: shortName, color: hex };
          ineqConfig[`${shortName}_ineq`] = { label: shortName, color: hex };
        }

        return (
          <div className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <SectionLabel>Cross-Tribe Comparison</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Population */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h4
                  className="font-mono text-[10px] uppercase tracking-wider mb-3"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Population
                </h4>
                <ChartContainer config={popConfig} className="min-h-[200px] w-full">
                  <AreaChart data={mergedData} accessibilityLayer>
                    <defs>
                      {tribeLookups.map(({ shortName }) => (
                        <linearGradient key={shortName} id={`cmp-pop-${shortName}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={`var(--color-${shortName}_pop)`} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={`var(--color-${shortName}_pop)`} stopOpacity={0.01} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="turn" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `T${v}`} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {tribeLookups.map(({ shortName }) => (
                      <Area key={shortName} dataKey={`${shortName}_pop`} type="monotone" fill={`url(#cmp-pop-${shortName})`} stroke={`var(--color-${shortName}_pop)`} strokeWidth={2} connectNulls />
                    ))}
                  </AreaChart>
                </ChartContainer>
              </div>

              {/* Avg Food */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h4
                  className="font-mono text-[10px] uppercase tracking-wider mb-3"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Average Food
                </h4>
                <ChartContainer config={foodConfig} className="min-h-[200px] w-full">
                  <AreaChart data={mergedData} accessibilityLayer>
                    <defs>
                      {tribeLookups.map(({ shortName }) => (
                        <linearGradient key={shortName} id={`cmp-food-${shortName}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={`var(--color-${shortName}_food)`} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={`var(--color-${shortName}_food)`} stopOpacity={0.01} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="turn" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `T${v}`} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {tribeLookups.map(({ shortName }) => (
                      <Area key={shortName} dataKey={`${shortName}_food`} type="monotone" fill={`url(#cmp-food-${shortName})`} stroke={`var(--color-${shortName}_food)`} strokeWidth={2} connectNulls />
                    ))}
                  </AreaChart>
                </ChartContainer>
              </div>

              {/* Avg Wealth */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h4
                  className="font-mono text-[10px] uppercase tracking-wider mb-3"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Average Wealth
                </h4>
                <ChartContainer config={wealthConfig} className="min-h-[200px] w-full">
                  <AreaChart data={mergedData} accessibilityLayer>
                    <defs>
                      {tribeLookups.map(({ shortName }) => (
                        <linearGradient key={shortName} id={`cmp-wealth-${shortName}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={`var(--color-${shortName}_wealth)`} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={`var(--color-${shortName}_wealth)`} stopOpacity={0.01} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="turn" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `T${v}`} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {tribeLookups.map(({ shortName }) => (
                      <Area key={shortName} dataKey={`${shortName}_wealth`} type="monotone" fill={`url(#cmp-wealth-${shortName})`} stroke={`var(--color-${shortName}_wealth)`} strokeWidth={2} connectNulls />
                    ))}
                  </AreaChart>
                </ChartContainer>
              </div>

              {/* Inequality */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h4
                  className="font-mono text-[10px] uppercase tracking-wider mb-3"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Wealth Inequality (Gini %)
                </h4>
                <ChartContainer config={ineqConfig} className="min-h-[200px] w-full">
                  <AreaChart data={mergedData} accessibilityLayer>
                    <defs>
                      {tribeLookups.map(({ shortName }) => (
                        <linearGradient key={shortName} id={`cmp-ineq-${shortName}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={`var(--color-${shortName}_ineq)`} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={`var(--color-${shortName}_ineq)`} stopOpacity={0.01} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="turn" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `T${v}`} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} domain={[0, 100]} />
                    <ReferenceLine y={35} stroke="var(--color-warning)" strokeDasharray="4 3" strokeOpacity={0.4} />
                    <ReferenceLine y={60} stroke="var(--color-danger)" strokeDasharray="4 3" strokeOpacity={0.4} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {tribeLookups.map(({ shortName }) => (
                      <Area key={shortName} dataKey={`${shortName}_ineq`} type="monotone" fill={`url(#cmp-ineq-${shortName})`} stroke={`var(--color-${shortName}_ineq)`} strokeWidth={2} connectNulls />
                    ))}
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Tribe Deep Dives ── */}
      <div className="space-y-6 mb-10">
        {report.tribes.map((tribe, i) => {
          const colors = TRIBE_COLORS[tribe.name] ?? {
            accent: "var(--color-text)",
            bg: "rgba(255,255,255,0.05)",
            glow: "rgba(255,255,255,0.1)",
          };
          const isExpanded = expandedTribe === tribe.id;
          const section = getTribeSection(tribe.id);

          const tabs = [
            { key: "overview", label: "Overview" },
            { key: "economy", label: "Economy" },
            { key: "rules", label: "Rules" },
            { key: "events", label: "Events" },
            { key: "agents", label: "Agents" },
            { key: "deliberations", label: "Councils" },
          ];

          return (
            <div
              key={tribe.id}
              className={`rounded-xl overflow-hidden opacity-0 animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
              style={{
                background: "var(--color-surface)",
                border: `1px solid var(--color-border)`,
              }}
            >
              {/* Tribe Header — clickable to expand */}
              <button
                className="w-full p-6 flex items-center justify-between cursor-pointer text-left"
                onClick={() =>
                  setExpandedTribe(isExpanded ? null : tribe.id)
                }
                style={{
                  borderBottom: isExpanded
                    ? "1px solid var(--color-border)"
                    : "none",
                }}
              >
                <div>
                  <h2
                    className="font-display text-xl font-medium mb-1"
                    style={{ color: colors.accent }}
                  >
                    {tribe.name}
                  </h2>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-text-dim)" }}
                  >
                    {tribe.governanceModel} &middot;{" "}
                    {Math.round(tribe.votingThreshold * 100)}% threshold
                    &middot; {tribe.changeMagnitude} mutability
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  {/* Quick stats visible even collapsed */}
                  <div className="hidden md:flex items-center gap-6">
                    <div className="text-right">
                      <div
                        className="font-mono text-2xl font-bold"
                        style={{ color: colors.accent }}
                      >
                        {tribe.drift.overallDrift.toFixed(1)}%
                      </div>
                      <div
                        className="font-mono text-[10px] uppercase"
                        style={{ color: "var(--color-text-dim)" }}
                      >
                        drift
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold">
                        {tribe.population.living}
                      </div>
                      <div
                        className="font-mono text-[10px] uppercase"
                        style={{ color: "var(--color-text-dim)" }}
                      >
                        alive
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold">
                        Lv{tribe.techLevel}
                      </div>
                      <div
                        className="font-mono text-[10px] uppercase"
                        style={{ color: "var(--color-text-dim)" }}
                      >
                        tech
                      </div>
                    </div>
                  </div>
                  <span
                    className="font-mono text-xs transition-transform"
                    style={{
                      color: "var(--color-text-dim)",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                    }}
                  >
                    &#x25BC;
                  </span>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div>
                  {/* Tab Navigation */}
                  <div
                    className="flex gap-0 border-b"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer relative"
                        style={{
                          color:
                            section === tab.key
                              ? colors.accent
                              : "var(--color-text-dim)",
                          borderBottom:
                            section === tab.key
                              ? `2px solid ${colors.accent}`
                              : "2px solid transparent",
                        }}
                        onClick={() => setTribeSection(tribe.id, tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    {/* ── Overview Tab ── */}
                    {section === "overview" && (
                      <div className="space-y-6">
                        {/* Drift */}
                        <div>
                          <SectionLabel>Domain Drift</SectionLabel>
                          <div className="space-y-2">
                            {Object.entries(tribe.drift.domainDrift).map(
                              ([domain, drift]) => (
                                <DriftBar
                                  key={domain}
                                  label={DOMAIN_LABELS[domain] || domain}
                                  value={drift}
                                  color={colors.accent}
                                />
                              )
                            )}
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div>
                          <SectionLabel>Vital Statistics</SectionLabel>
                          <div
                            className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-4 p-4 rounded-lg"
                            style={{ background: colors.bg }}
                          >
                            <StatBox
                              label="Living"
                              value={tribe.population.living}
                              color={colors.accent}
                            />
                            <StatBox
                              label="Dead"
                              value={tribe.population.dead}
                            />
                            <StatBox
                              label="Total Born"
                              value={tribe.population.total}
                            />
                            <StatBox
                              label="Avg Lifespan"
                              value={tribe.demographics.avgLifespan || "—"}
                            />
                            <StatBox
                              label="Tech Level"
                              value={`Lv${tribe.techLevel}`}
                              color="var(--color-info)"
                            />
                            <StatBox
                              label="Founders Alive"
                              value={`${tribe.demographics.foundersAlive}/${tribe.demographics.foundersTotal}`}
                            />
                            <StatBox
                              label="Crisis Survival"
                              value={`${tribe.crisisSurvivalRate}%`}
                              color={
                                tribe.crisisSurvivalRate >= 75
                                  ? "var(--color-success)"
                                  : tribe.crisisSurvivalRate >= 50
                                    ? "var(--color-warning)"
                                    : "var(--color-danger)"
                              }
                            />
                            <StatBox
                              label="Rules Changed"
                              value={tribe.ruleChanges.passed}
                              sub={`${tribe.ruleChanges.rejected} rejected`}
                              color={colors.accent}
                            />
                          </div>
                        </div>

                        {/* Economy */}
                        <div>
                          <SectionLabel>Economy</SectionLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {[
                              {
                                label: "Avg Food",
                                value: tribe.economy.avgFood,
                                color:
                                  tribe.economy.avgFood < 3
                                    ? "var(--color-danger)"
                                    : tribe.economy.avgFood < 5
                                      ? "var(--color-warning)"
                                      : "var(--color-success)",
                              },
                              {
                                label: "Avg Wealth",
                                value: tribe.economy.avgWealth,
                                color: "var(--color-text)",
                              },
                              {
                                label: "Inequality",
                                value: `${tribe.economy.inequality}%`,
                                color:
                                  tribe.economy.inequality > 60
                                    ? "var(--color-danger)"
                                    : tribe.economy.inequality > 35
                                      ? "var(--color-warning)"
                                      : "var(--color-success)",
                              },
                              {
                                label: "Hungry",
                                value: tribe.economy.hungry,
                                color:
                                  tribe.economy.hungry > 0
                                    ? "var(--color-warning)"
                                    : "var(--color-text-dim)",
                              },
                              {
                                label: "Starving",
                                value: tribe.economy.starving,
                                color:
                                  tribe.economy.starving > 0
                                    ? "var(--color-danger)"
                                    : "var(--color-text-dim)",
                              },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="p-3 rounded-lg text-center"
                                style={{
                                  background: "var(--color-surface-raised)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                <div
                                  className="font-mono text-lg font-bold"
                                  style={{ color: item.color }}
                                >
                                  {item.value}
                                </div>
                                <div
                                  className="font-mono text-[10px] uppercase mt-1"
                                  style={{ color: "var(--color-text-dim)" }}
                                >
                                  {item.label}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Communal Pool + Tribe Resources */}
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div
                              className="p-3 rounded-lg"
                              style={{
                                background: "var(--color-surface-raised)",
                                border: "1px solid var(--color-border)",
                              }}
                            >
                              <div
                                className="font-mono text-[9px] uppercase tracking-wider mb-2"
                                style={{ color: "var(--color-text-dim)" }}
                              >
                                Communal Pool
                              </div>
                              <div className="flex gap-4">
                                <div>
                                  <span
                                    className="font-mono text-sm font-bold"
                                    style={{ color: "var(--color-text)" }}
                                  >
                                    {tribe.economy.communalPool.food}
                                  </span>
                                  <span
                                    className="font-mono text-[10px] ml-1"
                                    style={{ color: "var(--color-text-dim)" }}
                                  >
                                    food
                                  </span>
                                </div>
                                <div>
                                  <span
                                    className="font-mono text-sm font-bold"
                                    style={{ color: "var(--color-text)" }}
                                  >
                                    {tribe.economy.communalPool.wealth}
                                  </span>
                                  <span
                                    className="font-mono text-[10px] ml-1"
                                    style={{ color: "var(--color-text-dim)" }}
                                  >
                                    wealth
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div
                              className="p-3 rounded-lg"
                              style={{
                                background: "var(--color-surface-raised)",
                                border: "1px solid var(--color-border)",
                              }}
                            >
                              <div
                                className="font-mono text-[9px] uppercase tracking-wider mb-2"
                                style={{ color: "var(--color-text-dim)" }}
                              >
                                Scarcity Impact
                              </div>
                              <div className="flex gap-4">
                                <div>
                                  <span
                                    className="font-mono text-sm font-bold"
                                    style={{
                                      color:
                                        tribe.economy.scarcityEvents > 0
                                          ? "var(--color-warning)"
                                          : "var(--color-text-dim)",
                                    }}
                                  >
                                    {tribe.economy.scarcityEvents}
                                  </span>
                                  <span
                                    className="font-mono text-[10px] ml-1"
                                    style={{ color: "var(--color-text-dim)" }}
                                  >
                                    famines
                                  </span>
                                </div>
                                <div>
                                  <span
                                    className="font-mono text-sm font-bold"
                                    style={{
                                      color:
                                        tribe.economy.starvationDeaths > 0
                                          ? "var(--color-danger)"
                                          : "var(--color-text-dim)",
                                    }}
                                  >
                                    {tribe.economy.starvationDeaths}
                                  </span>
                                  <span
                                    className="font-mono text-[10px] ml-1"
                                    style={{ color: "var(--color-text-dim)" }}
                                  >
                                    starved
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Causes of Death */}
                        {Object.keys(tribe.demographics.causesOfDeath).length > 0 && (
                          <div>
                            <SectionLabel>Causes of Death</SectionLabel>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(tribe.demographics.causesOfDeath)
                                .sort(([, a], [, b]) => b - a)
                                .map(([cause, count]) => (
                                  <span
                                    key={cause}
                                    className="font-mono text-[11px] px-2.5 py-1 rounded-full"
                                    style={{
                                      background: "var(--color-surface-raised)",
                                      color: "var(--color-text-muted)",
                                      border: "1px solid var(--color-border)",
                                    }}
                                  >
                                    {cause}{" "}
                                    <span style={{ color: "var(--color-text-dim)" }}>
                                      x{count}
                                    </span>
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Event Breakdown */}
                        <div>
                          <SectionLabel>Event Breakdown</SectionLabel>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div
                                className="font-mono text-[10px] uppercase mb-2"
                                style={{ color: "var(--color-text-dim)" }}
                              >
                                By Category
                              </div>
                              <div className="space-y-1">
                                {Object.entries(tribe.events.byCategory)
                                  .sort(([, a], [, b]) => b - a)
                                  .map(([cat, count]) => (
                                    <div
                                      key={cat}
                                      className="flex justify-between font-mono text-xs"
                                    >
                                      <span
                                        style={{
                                          color: "var(--color-text-muted)",
                                        }}
                                      >
                                        {cat.replace("_", " ")}
                                      </span>
                                      <span
                                        style={{
                                          color: "var(--color-text)",
                                        }}
                                      >
                                        {count}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                            <div>
                              <div
                                className="font-mono text-[10px] uppercase mb-2"
                                style={{ color: "var(--color-text-dim)" }}
                              >
                                By Severity
                              </div>
                              <div className="space-y-1">
                                {Object.entries(tribe.events.bySeverity)
                                  .sort(([, a], [, b]) => b - a)
                                  .map(([sev, count]) => (
                                    <div
                                      key={sev}
                                      className="flex justify-between font-mono text-xs"
                                    >
                                      <span
                                        style={{
                                          color:
                                            SEVERITY_COLORS[sev] ||
                                            "var(--color-text-muted)",
                                        }}
                                      >
                                        {sev}
                                      </span>
                                      <span
                                        style={{
                                          color: "var(--color-text)",
                                        }}
                                      >
                                        {count}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Turning Points */}
                        {tribe.turningPoints.length > 0 && (
                          <div>
                            <SectionLabel>
                              Key Turning Points ({tribe.turningPoints.length})
                            </SectionLabel>
                            <div className="relative pl-4">
                              {/* Timeline line */}
                              <div
                                className="absolute left-[5px] top-0 bottom-0 w-px"
                                style={{ background: "var(--color-border)" }}
                              />
                              <div className="space-y-3">
                                {tribe.turningPoints.map((tp, j) => (
                                  <div key={j} className="flex gap-3 items-start relative">
                                    <div
                                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 -ml-[9px] z-10"
                                      style={{
                                        background:
                                          tp.type === "event"
                                            ? "var(--color-warning)"
                                            : colors.accent,
                                        border: "2px solid var(--color-surface)",
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <div className="flex items-baseline gap-2 mb-0.5">
                                        <span
                                          className="font-mono text-[10px]"
                                          style={{ color: "var(--color-text-dim)" }}
                                        >
                                          T{tp.turnNumber} &middot; Gen {tp.generation}
                                        </span>
                                        <span
                                          className="font-mono text-[9px] uppercase px-1 py-0.5 rounded"
                                          style={{
                                            background:
                                              tp.type === "event"
                                                ? "var(--color-warning)15"
                                                : `${colors.accent}15`,
                                            color:
                                              tp.type === "event"
                                                ? "var(--color-warning)"
                                                : colors.accent,
                                          }}
                                        >
                                          {tp.type === "event" ? "crisis" : "reform"}
                                        </span>
                                      </div>
                                      <p
                                        className="text-xs leading-relaxed"
                                        style={{ color: "var(--color-text-muted)" }}
                                      >
                                        {tp.description}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Economy Tab ── */}
                    {section === "economy" && (
                      <div className="space-y-6">
                        {tribe.economy.timeline.length > 1 ? (
                          <>
                            {/* Food & Wealth Chart */}
                            <div>
                              <SectionLabel>Food & Wealth Over Time</SectionLabel>
                              <ChartContainer
                                config={{
                                  avgFood: { label: "Avg Food", color: "var(--color-success)" },
                                  avgWealth: { label: "Avg Wealth", color: "var(--color-warning)" },
                                } satisfies ChartConfig}
                                className="min-h-[200px] w-full"
                              >
                                <AreaChart data={tribe.economy.timeline} accessibilityLayer>
                                  <defs>
                                    <linearGradient id={`fillFood-${tribe.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--color-avgFood)" stopOpacity={0.3} />
                                      <stop offset="100%" stopColor="var(--color-avgFood)" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id={`fillWealth-${tribe.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--color-avgWealth)" stopOpacity={0.3} />
                                      <stop offset="100%" stopColor="var(--color-avgWealth)" stopOpacity={0.02} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid vertical={false} />
                                  <XAxis dataKey="turn" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `T${v}`} />
                                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                                  <ChartLegend content={<ChartLegendContent />} />
                                  <Area dataKey="avgFood" type="monotone" fill={`url(#fillFood-${tribe.id})`} stroke="var(--color-avgFood)" strokeWidth={2} />
                                  <Area dataKey="avgWealth" type="monotone" fill={`url(#fillWealth-${tribe.id})`} stroke="var(--color-avgWealth)" strokeWidth={2} />
                                </AreaChart>
                              </ChartContainer>
                            </div>

                            {/* Population & Hunger Chart */}
                            <div>
                              <SectionLabel>Population & Hunger</SectionLabel>
                              <ChartContainer
                                config={{
                                  population: { label: "Population", color: colors.accent },
                                  hungry: { label: "Hungry", color: "var(--color-warning)" },
                                  starving: { label: "Starving", color: "var(--color-danger)" },
                                } satisfies ChartConfig}
                                className="min-h-[200px] w-full"
                              >
                                <AreaChart data={tribe.economy.timeline} accessibilityLayer>
                                  <defs>
                                    <linearGradient id={`fillPop-${tribe.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--color-population)" stopOpacity={0.2} />
                                      <stop offset="100%" stopColor="var(--color-population)" stopOpacity={0.02} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid vertical={false} />
                                  <XAxis dataKey="turn" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `T${v}`} />
                                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} allowDecimals={false} />
                                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                                  <ChartLegend content={<ChartLegendContent />} />
                                  <Area dataKey="population" type="monotone" fill={`url(#fillPop-${tribe.id})`} stroke="var(--color-population)" strokeWidth={2} />
                                  <Area dataKey="hungry" type="monotone" fill="var(--color-hungry)" fillOpacity={0.1} stroke="var(--color-hungry)" strokeWidth={1.5} strokeDasharray="4 2" />
                                  <Area dataKey="starving" type="monotone" fill="var(--color-starving)" fillOpacity={0.1} stroke="var(--color-starving)" strokeWidth={1.5} strokeDasharray="4 2" />
                                </AreaChart>
                              </ChartContainer>
                            </div>

                            {/* Inequality Chart */}
                            <div>
                              <SectionLabel>Wealth Inequality (Gini %)</SectionLabel>
                              <ChartContainer
                                config={{
                                  inequality: { label: "Inequality %", color: "var(--color-info)" },
                                } satisfies ChartConfig}
                                className="min-h-[160px] w-full"
                              >
                                <AreaChart data={tribe.economy.timeline} accessibilityLayer>
                                  <defs>
                                    <linearGradient id={`fillIneq-${tribe.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--color-inequality)" stopOpacity={0.25} />
                                      <stop offset="100%" stopColor="var(--color-inequality)" stopOpacity={0.02} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid vertical={false} />
                                  <XAxis dataKey="turn" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `T${v}`} />
                                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} domain={[0, 100]} />
                                  <ReferenceLine y={35} stroke="var(--color-warning)" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: "moderate", position: "right", fill: "var(--color-warning)", fontSize: 10 }} />
                                  <ReferenceLine y={60} stroke="var(--color-danger)" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: "severe", position: "right", fill: "var(--color-danger)", fontSize: 10 }} />
                                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                                  <Area dataKey="inequality" type="monotone" fill={`url(#fillIneq-${tribe.id})`} stroke="var(--color-inequality)" strokeWidth={2} />
                                </AreaChart>
                              </ChartContainer>
                            </div>

                            {/* Communal Pool Chart */}
                            <div>
                              <SectionLabel>Communal Pool</SectionLabel>
                              <ChartContainer
                                config={{
                                  communalFood: { label: "Communal Food", color: "var(--color-success)" },
                                  communalWealth: { label: "Communal Wealth", color: "var(--color-warning)" },
                                } satisfies ChartConfig}
                                className="min-h-[160px] w-full"
                              >
                                <AreaChart data={tribe.economy.timeline} accessibilityLayer>
                                  <defs>
                                    <linearGradient id={`fillCFood-${tribe.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--color-communalFood)" stopOpacity={0.3} />
                                      <stop offset="100%" stopColor="var(--color-communalFood)" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id={`fillCWealth-${tribe.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--color-communalWealth)" stopOpacity={0.3} />
                                      <stop offset="100%" stopColor="var(--color-communalWealth)" stopOpacity={0.02} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid vertical={false} />
                                  <XAxis dataKey="turn" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `T${v}`} />
                                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                                  <ChartLegend content={<ChartLegendContent />} />
                                  <Area dataKey="communalFood" type="monotone" fill={`url(#fillCFood-${tribe.id})`} stroke="var(--color-communalFood)" strokeWidth={2} />
                                  <Area dataKey="communalWealth" type="monotone" fill={`url(#fillCWealth-${tribe.id})`} stroke="var(--color-communalWealth)" strokeWidth={2} />
                                </AreaChart>
                              </ChartContainer>
                            </div>
                          </>
                        ) : (
                          <p
                            className="text-xs italic"
                            style={{ color: "var(--color-text-dim)" }}
                          >
                            No economic data recorded
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Rules Tab ── */}
                    {section === "rules" && (
                      <div className="space-y-6">
                        {/* Rule Comparison */}
                        <div>
                          <SectionLabel>
                            Founding Rules vs Current Rules
                          </SectionLabel>
                          <div className="space-y-3">
                            {["governance", "economy", "social", "cultural", "external"].map(
                              (domain) => {
                                const founding = tribe.foundingRules.filter(
                                  (r) => r.domain === domain
                                );
                                const current = tribe.currentRules.filter(
                                  (r) => r.domain === domain
                                );
                                const drift =
                                  tribe.drift.domainDrift[domain] || 0;

                                return (
                                  <div
                                    key={domain}
                                    className="rounded-lg overflow-hidden"
                                    style={{
                                      border: "1px solid var(--color-border)",
                                    }}
                                  >
                                    <div
                                      className="px-4 py-2 flex justify-between items-center"
                                      style={{
                                        background:
                                          "var(--color-surface-raised)",
                                      }}
                                    >
                                      <span
                                        className="font-mono text-[11px] uppercase tracking-wider font-bold"
                                        style={{ color: colors.accent }}
                                      >
                                        {domain}
                                      </span>
                                      <span
                                        className="font-mono text-[10px]"
                                        style={{
                                          color:
                                            drift > 50
                                              ? "var(--color-warning)"
                                              : "var(--color-text-dim)",
                                        }}
                                      >
                                        {drift.toFixed(0)}% drift
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--color-border)" }}>
                                      <div className="p-3">
                                        <div
                                          className="font-mono text-[9px] uppercase tracking-wider mb-2"
                                          style={{
                                            color: "var(--color-text-dim)",
                                          }}
                                        >
                                          Founding
                                        </div>
                                        {founding.map((r, j) => {
                                          const stillExists = current.some(
                                            (cr) => cr.text === r.text
                                          );
                                          return (
                                            <p
                                              key={j}
                                              className="text-xs leading-relaxed mb-2"
                                              style={{
                                                color: stillExists
                                                  ? "var(--color-text-muted)"
                                                  : "var(--color-danger)",
                                                textDecoration: stillExists
                                                  ? "none"
                                                  : "line-through",
                                                opacity: stillExists ? 1 : 0.7,
                                              }}
                                            >
                                              {r.text}
                                            </p>
                                          );
                                        })}
                                      </div>
                                      <div className="p-3" style={{ borderColor: "var(--color-border)" }}>
                                        <div
                                          className="font-mono text-[9px] uppercase tracking-wider mb-2"
                                          style={{
                                            color: "var(--color-text-dim)",
                                          }}
                                        >
                                          Current
                                        </div>
                                        {current.map((r, j) => {
                                          const isNew = !founding.some(
                                            (fr) => fr.text === r.text
                                          );
                                          return (
                                            <p
                                              key={j}
                                              className="text-xs leading-relaxed mb-2"
                                              style={{
                                                color: isNew
                                                  ? "var(--color-success)"
                                                  : "var(--color-text-muted)",
                                              }}
                                            >
                                              {isNew && (
                                                <span
                                                  className="font-mono text-[9px] mr-1"
                                                  style={{
                                                    color:
                                                      "var(--color-success)",
                                                  }}
                                                >
                                                  NEW
                                                </span>
                                              )}
                                              {r.text}
                                            </p>
                                          );
                                        })}
                                        {current.length === 0 && (
                                          <p
                                            className="text-xs italic"
                                            style={{
                                              color: "var(--color-text-dim)",
                                            }}
                                          >
                                            No rules in this domain
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {/* Rule Change History */}
                        {tribe.ruleChanges.details.length > 0 && (
                          <div>
                            <SectionLabel>
                              Rule Change History ({tribe.ruleChanges.passed}{" "}
                              passed, {tribe.ruleChanges.rejected} rejected)
                            </SectionLabel>
                            <div className="space-y-3">
                              {tribe.ruleChanges.details.map((change, j) => (
                                <div
                                  key={j}
                                  className="p-3 rounded-lg"
                                  style={{
                                    background: "var(--color-surface-raised)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded"
                                        style={{
                                          background: `${colors.accent}20`,
                                          color: colors.accent,
                                        }}
                                      >
                                        {change.domain}
                                      </span>
                                      <span
                                        className="font-mono text-[10px]"
                                        style={{
                                          color: "var(--color-text-dim)",
                                        }}
                                      >
                                        Turn {change.turnNumber} &middot; Gen{" "}
                                        {change.generation}
                                      </span>
                                    </div>
                                    <span
                                      className="font-mono text-[10px]"
                                      style={{
                                        color: "var(--color-text-dim)",
                                      }}
                                    >
                                      by {change.proposedBy}
                                    </span>
                                  </div>
                                  {change.oldRule && (
                                    <p
                                      className="text-xs mb-1 line-through"
                                      style={{
                                        color: "var(--color-danger)",
                                        opacity: 0.7,
                                      }}
                                    >
                                      {change.oldRule}
                                    </p>
                                  )}
                                  <p
                                    className="text-xs mb-2"
                                    style={{
                                      color: "var(--color-success)",
                                    }}
                                  >
                                    {change.newRule}
                                  </p>
                                  <div className="flex gap-3 font-mono text-[10px]">
                                    <span
                                      style={{
                                        color: "var(--color-success)",
                                      }}
                                    >
                                      {change.votes.approve} approve
                                    </span>
                                    <span
                                      style={{
                                        color: "var(--color-danger)",
                                      }}
                                    >
                                      {change.votes.reject} reject
                                    </span>
                                    <span
                                      style={{
                                        color: "var(--color-text-dim)",
                                      }}
                                    >
                                      {change.votes.abstain} abstain
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Events Tab ── */}
                    {section === "events" && (
                      <div>
                        <SectionLabel>
                          Event Chronicle ({tribe.events.total} total)
                        </SectionLabel>
                        {tribe.events.timeline.length === 0 ? (
                          <p
                            className="text-xs italic"
                            style={{ color: "var(--color-text-dim)" }}
                          >
                            No events recorded
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {/* Group by generation */}
                            {Object.entries(
                              tribe.events.timeline.reduce(
                                (acc, e) => {
                                  const gen = e.generation;
                                  if (!acc[gen]) acc[gen] = [];
                                  acc[gen].push(e);
                                  return acc;
                                },
                                {} as Record<number, EventItem[]>
                              )
                            )
                              .sort(([a], [b]) => Number(a) - Number(b))
                              .map(([gen, events]) => (
                                <div key={gen} className="mb-4">
                                  <div
                                    className="font-mono text-[10px] uppercase tracking-wider mb-2 pb-1"
                                    style={{
                                      color: "var(--color-text-dim)",
                                      borderBottom:
                                        "1px solid var(--color-border)",
                                    }}
                                  >
                                    Generation {gen}
                                  </div>
                                  <div className="space-y-2 pl-3">
                                    {events.map((event, j) => (
                                      <div
                                        key={j}
                                        className="flex gap-3 items-start"
                                      >
                                        <div
                                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                                          style={{
                                            background:
                                              SEVERITY_COLORS[
                                                event.severity
                                              ] || "var(--color-text-dim)",
                                          }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-baseline gap-2">
                                            <span
                                              className="font-mono text-[10px]"
                                              style={{
                                                color: "var(--color-text-dim)",
                                              }}
                                            >
                                              T{event.turnNumber}
                                            </span>
                                            <span
                                              className="font-mono text-[9px] uppercase px-1 py-0.5 rounded"
                                              style={{
                                                color:
                                                  SEVERITY_COLORS[
                                                    event.severity
                                                  ],
                                                background: `${SEVERITY_COLORS[event.severity]}15`,
                                              }}
                                            >
                                              {event.severity}
                                            </span>
                                            <span
                                              className="font-mono text-[9px] uppercase"
                                              style={{
                                                color: "var(--color-text-dim)",
                                              }}
                                            >
                                              {event.category.replace("_", " ")}
                                            </span>
                                          </div>
                                          <p
                                            className="text-xs leading-relaxed mt-0.5"
                                            style={{
                                              color: "var(--color-text-muted)",
                                            }}
                                          >
                                            {event.description}
                                          </p>
                                          {/* Show effects if meaningful */}
                                          {(event.effects.populationChange ||
                                            event.effects.resourceChange ||
                                            event.effects.techLevelChange) && (
                                            <div className="flex gap-2 mt-1 font-mono text-[9px]">
                                              {event.effects
                                                .populationChange && (
                                                <span
                                                  style={{
                                                    color:
                                                      event.effects
                                                        .populationChange > 0
                                                        ? "var(--color-success)"
                                                        : "var(--color-danger)",
                                                  }}
                                                >
                                                  pop{" "}
                                                  {event.effects
                                                    .populationChange > 0
                                                    ? "+"
                                                    : ""}
                                                  {
                                                    event.effects
                                                      .populationChange
                                                  }
                                                </span>
                                              )}
                                              {event.effects.resourceChange
                                                ?.food && (
                                                <span
                                                  style={{
                                                    color:
                                                      event.effects
                                                        .resourceChange.food > 0
                                                        ? "var(--color-success)"
                                                        : "var(--color-danger)",
                                                  }}
                                                >
                                                  food{" "}
                                                  {event.effects.resourceChange
                                                    .food > 0
                                                    ? "+"
                                                    : ""}
                                                  {
                                                    event.effects
                                                      .resourceChange.food
                                                  }
                                                </span>
                                              )}
                                              {event.effects.resourceChange
                                                ?.materials && (
                                                <span
                                                  style={{
                                                    color:
                                                      event.effects
                                                        .resourceChange
                                                        .materials > 0
                                                        ? "var(--color-success)"
                                                        : "var(--color-danger)",
                                                  }}
                                                >
                                                  mat{" "}
                                                  {event.effects.resourceChange
                                                    .materials > 0
                                                    ? "+"
                                                    : ""}
                                                  {
                                                    event.effects
                                                      .resourceChange.materials
                                                  }
                                                </span>
                                              )}
                                              {event.effects
                                                .techLevelChange && (
                                                <span
                                                  style={{
                                                    color:
                                                      "var(--color-info)",
                                                  }}
                                                >
                                                  tech +
                                                  {
                                                    event.effects
                                                      .techLevelChange
                                                  }
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Agents Tab ── */}
                    {section === "agents" && (
                      <div className="space-y-6">
                        {/* Notable Figures */}
                        <div>
                          <SectionLabel>Notable Figures</SectionLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {tribe.notableAgents.oldest && (
                              <div
                                className="p-4 rounded-lg"
                                style={{
                                  background: "var(--color-surface-raised)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                <div
                                  className="font-mono text-[9px] uppercase tracking-wider mb-2"
                                  style={{ color: "var(--color-text-dim)" }}
                                >
                                  Longest Lived
                                </div>
                                <div
                                  className="font-display text-sm font-medium mb-1"
                                  style={{ color: colors.accent }}
                                >
                                  {tribe.notableAgents.oldest.name}
                                </div>
                                <div
                                  className="font-mono text-xs"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  Age {tribe.notableAgents.oldest.age}
                                  {tribe.notableAgents.oldest.status ===
                                    "alive" && (
                                    <span
                                      style={{ color: "var(--color-success)" }}
                                    >
                                      {" "}
                                      (still alive)
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {tribe.notableAgents.oldest.personality.map(
                                    (p) => (
                                      <span
                                        key={p}
                                        className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                                        style={{
                                          background: `${colors.accent}15`,
                                          color: "var(--color-text-dim)",
                                        }}
                                      >
                                        {p}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {tribe.notableAgents.mostConnected && (
                              <div
                                className="p-4 rounded-lg"
                                style={{
                                  background: "var(--color-surface-raised)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                <div
                                  className="font-mono text-[9px] uppercase tracking-wider mb-2"
                                  style={{ color: "var(--color-text-dim)" }}
                                >
                                  Most Connected
                                </div>
                                <div
                                  className="font-display text-sm font-medium mb-1"
                                  style={{ color: colors.accent }}
                                >
                                  {tribe.notableAgents.mostConnected.name}
                                </div>
                                <div
                                  className="font-mono text-xs"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  {
                                    tribe.notableAgents.mostConnected
                                      .relationshipCount
                                  }{" "}
                                  relationships
                                  {tribe.notableAgents.mostConnected.status ===
                                    "dead" && (
                                    <span
                                      style={{
                                        color: "var(--color-text-dim)",
                                      }}
                                    >
                                      {" "}
                                      (deceased)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {tribe.notableAgents.mostProlific && (
                              <div
                                className="p-4 rounded-lg"
                                style={{
                                  background: "var(--color-surface-raised)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                <div
                                  className="font-mono text-[9px] uppercase tracking-wider mb-2"
                                  style={{ color: "var(--color-text-dim)" }}
                                >
                                  Most Children
                                </div>
                                <div
                                  className="font-display text-sm font-medium mb-1"
                                  style={{ color: colors.accent }}
                                >
                                  {tribe.notableAgents.mostProlific.name}
                                </div>
                                <div
                                  className="font-mono text-xs"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  {tribe.notableAgents.mostProlific.childCount}{" "}
                                  children
                                  {tribe.notableAgents.mostProlific.status ===
                                    "dead" && (
                                    <span
                                      style={{
                                        color: "var(--color-text-dim)",
                                      }}
                                    >
                                      {" "}
                                      (deceased)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Generational Demographics */}
                        <div>
                          <SectionLabel>Generational Breakdown</SectionLabel>
                          <div className="flex gap-2">
                            {Object.entries(
                              tribe.demographics.generationBreakdown
                            )
                              .sort(([a], [b]) => Number(a) - Number(b))
                              .map(([gen, data]) => (
                                <div
                                  key={gen}
                                  className="flex-1 p-3 rounded-lg text-center"
                                  style={{
                                    background: "var(--color-surface-raised)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                >
                                  <div
                                    className="font-mono text-[9px] uppercase mb-2"
                                    style={{ color: "var(--color-text-dim)" }}
                                  >
                                    Gen {gen}
                                  </div>
                                  <div
                                    className="font-mono text-sm font-bold"
                                    style={{ color: "var(--color-text)" }}
                                  >
                                    {data.born}
                                  </div>
                                  <div
                                    className="font-mono text-[9px] mt-1"
                                    style={{ color: "var(--color-text-dim)" }}
                                  >
                                    {data.died} died
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Deliberations Tab ── */}
                    {section === "deliberations" && (
                      <div>
                        <SectionLabel>
                          Council Sessions ({tribe.deliberations.total} total)
                        </SectionLabel>
                        {tribe.deliberations.highlights.length === 0 ? (
                          <p
                            className="text-xs italic"
                            style={{ color: "var(--color-text-dim)" }}
                          >
                            No council sessions recorded
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {tribe.deliberations.highlights.map(
                              (session, j) => (
                                <div
                                  key={j}
                                  className="rounded-lg overflow-hidden"
                                  style={{
                                    border: "1px solid var(--color-border)",
                                  }}
                                >
                                  <div
                                    className="px-4 py-2 flex justify-between items-center"
                                    style={{
                                      background: "var(--color-surface-raised)",
                                    }}
                                  >
                                    <span
                                      className="font-mono text-[10px]"
                                      style={{ color: "var(--color-text-dim)" }}
                                    >
                                      Turn {session.turnNumber} &middot; Gen{" "}
                                      {session.generation}
                                    </span>
                                    <span
                                      className="font-mono text-[10px]"
                                      style={{ color: "var(--color-text-dim)" }}
                                    >
                                      {session.speakerCount} speakers &middot;{" "}
                                      {session.roundCount} rounds
                                    </span>
                                  </div>
                                  <div className="p-4 space-y-3">
                                    {session.excerpt.map((msg, k) => (
                                      <div key={k}>
                                        <span
                                          className="font-display text-xs font-medium"
                                          style={{ color: colors.accent }}
                                        >
                                          {msg.name}
                                        </span>
                                        <p
                                          className="text-xs leading-relaxed mt-0.5 pl-3"
                                          style={{
                                            color: "var(--color-text-muted)",
                                            borderLeft: `2px solid ${colors.accent}30`,
                                          }}
                                        >
                                          {msg.content.length > 300
                                            ? msg.content.slice(0, 300) + "..."
                                            : msg.content}
                                        </p>
                                      </div>
                                    ))}
                                    {session.excerpt.length === 3 && (
                                      <p
                                        className="font-mono text-[10px] italic"
                                        style={{
                                          color: "var(--color-text-dim)",
                                        }}
                                      >
                                        ...and more deliberation
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cross-Tribe Relations ── */}
      {report.contacts.length > 0 && (
        <div className="mb-10 animate-fade-in-up">
          <SectionLabel>Inter-Tribe Relations</SectionLabel>
          <div
            className="rounded-xl p-6"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="space-y-3">
              {report.contacts.map((contact, i) => {
                const colorsA = TRIBE_COLORS[contact.tribeA];
                const colorsB = TRIBE_COLORS[contact.tribeB];
                const sentimentColor =
                  contact.sentiment > 0
                    ? "var(--color-success)"
                    : contact.sentiment < 0
                      ? "var(--color-danger)"
                      : "var(--color-text-dim)";

                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-3 rounded-lg"
                    style={{
                      background: "var(--color-surface-raised)",
                    }}
                  >
                    <span
                      className="font-display text-xs font-medium"
                      style={{
                        color: colorsA?.accent || "var(--color-text)",
                      }}
                    >
                      {contact.tribeA}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className="flex-1 h-px"
                        style={{
                          background: `linear-gradient(to right, ${colorsA?.accent || "#fff"}40, ${colorsB?.accent || "#fff"}40)`,
                        }}
                      />
                      <span
                        className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: "var(--color-surface)",
                          color: "var(--color-text-dim)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {contact.stage}
                      </span>
                      <div
                        className="flex-1 h-px"
                        style={{
                          background: `linear-gradient(to left, ${colorsB?.accent || "#fff"}40, ${colorsA?.accent || "#fff"}40)`,
                        }}
                      />
                    </div>
                    <span
                      className="font-display text-xs font-medium"
                      style={{
                        color: colorsB?.accent || "var(--color-text)",
                      }}
                    >
                      {contact.tribeB}
                    </span>
                    <div className="text-right shrink-0 w-24">
                      <div
                        className="font-mono text-[10px]"
                        style={{ color: sentimentColor }}
                      >
                        sentiment: {contact.sentiment > 0 ? "+" : ""}
                        {contact.sentiment}
                      </div>
                      <div
                        className="font-mono text-[9px]"
                        style={{ color: "var(--color-text-dim)" }}
                      >
                        turn {contact.firstContactTurn}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Key Insights ── */}
      <div className="mb-10 animate-fade-in-up">
        <SectionLabel>Key Insights</SectionLabel>
        <div
          className="rounded-xl p-6 space-y-4"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {mostDrifted && leastDrifted && (
            <>
              <InsightItem
                accent={TRIBE_COLORS[mostDrifted.name]?.accent}
                text={`${mostDrifted.name} drifted the most at ${mostDrifted.drift.overallDrift.toFixed(1)}%, with ${mostDrifted.ruleChanges.passed} rule changes passed through their ${mostDrifted.governanceModel}.`}
              />
              <InsightItem
                accent={TRIBE_COLORS[leastDrifted.name]?.accent}
                text={`${leastDrifted.name} preserved the most stability at ${leastDrifted.drift.overallDrift.toFixed(1)}% drift, with a ${Math.round(leastDrifted.votingThreshold * 100)}% voting threshold making change difficult.`}
              />
            </>
          )}
          {report.tribes.map((tribe) => {
            const catastrophicCount =
              tribe.events.bySeverity["catastrophic"] || 0;
            if (catastrophicCount > 0) {
              return (
                <InsightItem
                  key={tribe.id}
                  accent="var(--color-danger)"
                  text={`${tribe.name} survived ${catastrophicCount} catastrophic event${catastrophicCount > 1 ? "s" : ""}.`}
                />
              );
            }
            return null;
          })}
          {report.tribes.map((tribe) => {
            if (
              tribe.demographics.foundersAlive > 0 &&
              tribe.demographics.foundersTotal > 0
            ) {
              return (
                <InsightItem
                  key={`founder-${tribe.id}`}
                  accent={TRIBE_COLORS[tribe.name]?.accent}
                  text={`${tribe.demographics.foundersAlive} of ${tribe.demographics.foundersTotal} original founders of ${tribe.name} are still alive.`}
                />
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* ── AI Divergence Analysis ── */}
      {report.divergenceAnalysis && (
        <div className="mb-10 animate-fade-in-up">
          <SectionLabel>Divergence Analysis</SectionLabel>
          <div
            className="rounded-xl p-6"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="font-mono text-[9px] uppercase tracking-wider mb-3 flex items-center gap-2"
              style={{ color: "var(--color-text-dim)" }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--color-info)" }}
              />
              AI-Generated Comparative Analysis
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--color-text-muted)" }}
            >
              {report.divergenceAnalysis}
            </div>
          </div>
        </div>
      )}

      {/* ── World History ── */}
      {report.worldHistory && (
        <div className="mb-10 animate-fade-in-up">
          <SectionLabel>The Chronicle of Four Peoples</SectionLabel>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="px-6 py-3 flex items-center gap-2"
              style={{
                background: "var(--color-surface-raised)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span
                className="font-mono text-[9px] uppercase tracking-wider"
                style={{ color: "var(--color-text-dim)" }}
              >
                AI-Generated World History &mdash; A future historian looks back
              </span>
            </div>
            <div className="p-6 md:p-8">
              <div
                className="font-body text-sm leading-[1.8] whitespace-pre-wrap max-w-3xl mx-auto"
                style={{ color: "var(--color-text-muted)" }}
              >
                {report.worldHistory}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div
        className="text-center py-8 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        <p
          className="font-display text-lg italic"
          style={{ color: "var(--color-text-dim)" }}
        >
          &ldquo;How does a society&rsquo;s willingness to change its own rules
          shape its long-term trajectory?&rdquo;
        </p>
      </div>
    </div>
  );
}

function InsightItem({
  accent,
  text,
}: {
  accent?: string;
  text: string;
}) {
  return (
    <p
      className="text-xs leading-relaxed pl-3"
      style={{
        color: "var(--color-text-muted)",
        borderLeft: `2px solid ${accent || "var(--color-text-dim)"}`,
      }}
    >
      {text}
    </p>
  );
}

