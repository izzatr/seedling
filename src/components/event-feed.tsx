"use client";

export type FeedEvent = {
  id: string;
  type: "birth" | "death" | "event" | "proposal" | "rule_change" | "speech" | "turn_start" | "turn_complete";
  turn?: number;
  tribeName?: string;
  tribeId?: string;
  agentName?: string;
  content?: string;
  severity?: string;
  category?: string;
  timestamp: number;
};

const EVENT_ICONS: Record<string, string> = {
  birth: "\u2022",
  death: "\u2020",
  event: "\u26A1",
  proposal: "\u270E",
  rule_change: "\u2713",
  speech: "\u275D",
  turn_start: "\u2500",
  turn_complete: "\u2500",
};

const TRIBE_COLORS: Record<string, string> = {
  "The Keepers": "var(--color-keepers-accent)",
  "The Moderates": "var(--color-moderates-accent)",
  "The Adapters": "var(--color-adapters-accent)",
  "The Free": "var(--color-free-accent)",
};

function formatEvent(event: FeedEvent): string {
  switch (event.type) {
    case "birth":
      return `${event.agentName} is born`;
    case "death":
      return `${event.agentName} has died${event.content ? ` (${event.content})` : ""}`;
    case "event":
      return event.content ?? "An event occurred";
    case "proposal":
      return `${event.agentName} proposes: "${event.content}"`;
    case "rule_change":
      return `Rule changed: ${event.content}`;
    case "speech":
      return `${event.agentName}: "${event.content}"`;
    case "turn_start":
      return `Turn ${event.turn} begins`;
    case "turn_complete":
      return `Turn ${event.turn} complete`;
    default:
      return event.content ?? "";
  }
}

export default function EventFeed({ events }: { events: FeedEvent[] }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h3
          className="font-mono text-[10px] uppercase tracking-wider"
          style={{ color: "var(--color-text-dim)" }}
        >
          Chronicle
        </h3>
        <span
          className="font-mono text-[10px]"
          style={{ color: "var(--color-text-dim)" }}
        >
          {events.length} entries
        </span>
      </div>

      {/* Event List */}
      <div className="event-feed max-h-[500px] overflow-y-auto p-2">
        {events.length === 0 ? (
          <div
            className="text-center py-8 text-sm"
            style={{ color: "var(--color-text-dim)" }}
          >
            Awaiting the first chapter...
          </div>
        ) : (
          <div className="space-y-0.5">
            {events.map((event) => {
              const isTurnMarker =
                event.type === "turn_start" || event.type === "turn_complete";
              const tribeColor =
                event.tribeName
                  ? TRIBE_COLORS[event.tribeName] ?? "var(--color-text-dim)"
                  : "var(--color-text-dim)";

              if (isTurnMarker) {
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 px-3 py-1.5"
                  >
                    <div
                      className="flex-1 h-px"
                      style={{ background: "var(--color-border)" }}
                    />
                    <span
                      className="font-mono text-[10px] shrink-0"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      {event.type === "turn_start" ? `turn ${event.turn}` : `end ${event.turn}`}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ background: "var(--color-border)" }}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={event.id}
                  className="flex gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-hover)]"
                >
                  {/* Icon */}
                  <span
                    className="text-xs shrink-0 mt-0.5 w-4 text-center"
                    style={{
                      color:
                        event.type === "death"
                          ? "var(--color-danger)"
                          : event.type === "birth"
                            ? "var(--color-success)"
                            : tribeColor,
                    }}
                  >
                    {EVENT_ICONS[event.type] ?? "\u2022"}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {event.tribeName && (
                      <span
                        className="font-mono text-[10px] mr-1.5"
                        style={{ color: tribeColor }}
                      >
                        {event.tribeName.replace("The ", "")}
                      </span>
                    )}
                    <span
                      className="text-xs leading-relaxed"
                      style={{
                        color:
                          event.type === "speech"
                            ? "var(--color-text-muted)"
                            : "var(--color-text)",
                      }}
                    >
                      {formatEvent(event)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
