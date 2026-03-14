"use client";

type SimulationControlsProps = {
  status: string;
  currentTurn: number;
  currentGeneration: number;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onReport: () => void;
};

export default function SimulationControls({
  status,
  currentTurn,
  currentGeneration,
  onStart,
  onPause,
  onStop,
  onReport,
}: SimulationControlsProps) {
  const statusColor =
    status === "running"
      ? "var(--color-success)"
      : status === "paused"
        ? "var(--color-warning)"
        : status === "completed"
          ? "var(--color-info)"
          : "var(--color-text-dim)";

  return (
    <div
      className="flex items-center justify-between px-6 py-3 rounded-xl"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Left: Logo + Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, #C4B5A0, #D4845A, #4CC9B0, #E8C547, #C4B5A0)",
              opacity: 0.7,
            }}
          />
          <span
            className="font-display text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            seedling
          </span>
        </div>

        <div
          className="h-4 w-px"
          style={{ background: "var(--color-border)" }}
        />

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${status === "running" ? "animate-pulse-subtle" : ""}`}
            style={{ background: statusColor }}
          />
          <span
            className="font-mono text-xs uppercase tracking-wider"
            style={{ color: statusColor }}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Center: Turn + Gen */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-text-dim)" }}
          >
            Turn
          </div>
          <div
            className="font-mono text-lg font-bold"
            style={{ color: "var(--color-text)" }}
          >
            {currentTurn}
          </div>
        </div>
        <div className="text-center">
          <div
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-text-dim)" }}
          >
            Generation
          </div>
          <div
            className="font-mono text-lg font-bold"
            style={{ color: "var(--color-text)" }}
          >
            {currentGeneration}
          </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        {status === "setup" || status === "paused" ? (
          <button
            onClick={onStart}
            className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all hover:brightness-110 cursor-pointer"
            style={{
              background: "var(--color-success)",
              color: "var(--color-ground)",
            }}
          >
            {status === "paused" ? "Resume" : "Start"}
          </button>
        ) : null}

        {status === "running" ? (
          <button
            onClick={onPause}
            className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all hover:brightness-110 cursor-pointer"
            style={{
              background: "var(--color-warning)",
              color: "var(--color-ground)",
            }}
          >
            Pause
          </button>
        ) : null}

        {status !== "completed" && status !== "setup" ? (
          <button
            onClick={onStop}
            className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all hover:brightness-110 cursor-pointer"
            style={{
              background: "var(--color-danger)",
              color: "var(--color-text)",
            }}
          >
            Stop
          </button>
        ) : null}

        {status === "completed" ? (
          <button
            onClick={onReport}
            className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all hover:brightness-110 cursor-pointer"
            style={{
              background: "var(--color-info)",
              color: "var(--color-ground)",
            }}
          >
            View Report
          </button>
        ) : null}
      </div>
    </div>
  );
}
