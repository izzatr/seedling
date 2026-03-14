"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import SimulationControls from "@/components/simulation-controls";
import TribeCard, { type SpeechMessage } from "@/components/tribe-card";
import EventFeed, { type FeedEvent } from "@/components/event-feed";

type SimulationState = {
  simulation: {
    id: string;
    name: string;
    status: string;
    currentTurn: number;
    currentGeneration: number;
    councilInterval: number;
    generationLength: number;
  };
  tribes: {
    id: string;
    name: string;
    governanceModel: string;
    votingThreshold: number;
    changeMagnitude: string;
    techLevel: number;
    rules: { domain: string; text: string }[];
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
  }[];
};

export default function SimulationPage() {
  const params = useParams();
  const router = useRouter();
  const simulationId = params.id as string;

  const [state, setState] = useState<SimulationState | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [expandedTribe, setExpandedTribe] = useState<string | null>(null);
  // Track conversations per tribe (keyed by tribeId)
  const [conversations, setConversations] = useState<Record<string, SpeechMessage[]>>({});
  const eventIdCounter = useRef(0);

  // Fetch initial state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/simulation/${simulationId}/state`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error("Failed to fetch state:", err);
    }
  }, [simulationId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`/api/simulation/${simulationId}/stream`);

    const addEvent = (event: Omit<FeedEvent, "id" | "timestamp">) => {
      const newEvent: FeedEvent = {
        ...event,
        id: `evt-${eventIdCounter.current++}`,
        timestamp: Date.now(),
      };
      setEvents((prev) => [newEvent, ...prev].slice(0, 500));
    };

    es.addEventListener("turn_start", (e) => {
      const data = JSON.parse(e.data);
      addEvent({
        type: "turn_start",
        turn: data.turnNumber,
        content: `Turn ${data.turnNumber} (Gen ${data.generation}, ${data.turnType})`,
      });

      // Clear conversations at the start of each turn (fresh council)
      if (data.turnType === "council" || data.turnType === "milestone") {
        setConversations({});
      }
    });

    es.addEventListener("happening", (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "birth") {
        addEvent({
          type: "birth",
          tribeId: data.tribeId,
          tribeName: data.tribeName,
          agentName: data.agentName,
          turn: data.turn,
          content: data.parents
            ? `child of ${data.parents.join(" & ")}`
            : undefined,
        });
      } else if (data.type === "death") {
        addEvent({
          type: "death",
          tribeId: data.tribeId,
          tribeName: data.tribeName,
          agentName: data.agentName,
          turn: data.turn,
          content: data.cause,
        });
      } else if (data.type === "event") {
        addEvent({
          type: "event",
          tribeId: data.tribeId,
          tribeName: data.tribeName,
          content: data.description,
          severity: data.severity,
          category: data.category,
          turn: data.turn,
        });
      } else if (data.type === "proposal") {
        addEvent({
          type: "proposal",
          tribeId: data.tribeId,
          tribeName: data.tribeName,
          agentName: data.agentName,
          content: data.ruleText,
          turn: data.turn,
        });
      } else if (data.type === "rule_change") {
        addEvent({
          type: "rule_change",
          tribeId: data.tribeId,
          tribeName: data.tribeName,
          content: data.newRule,
          turn: data.turn,
        });
      }
    });

    es.addEventListener("speech", (e) => {
      const data = JSON.parse(e.data);

      // Add to tribe conversation
      setConversations((prev) => {
        const tribeConvo = prev[data.tribeId] ?? [];
        return {
          ...prev,
          [data.tribeId]: [
            ...tribeConvo,
            {
              agentName: data.agentName,
              content: data.content,
              round: data.round,
              timestamp: Date.now(),
            },
          ].slice(-50), // Keep last 50 messages per tribe
        };
      });

      // Also add to global event feed
      addEvent({
        type: "speech",
        tribeId: data.tribeId,
        tribeName: data.tribeName,
        agentName: data.agentName,
        content: data.content,
      });
    });

    es.addEventListener("turn_complete", (e) => {
      const data = JSON.parse(e.data);
      addEvent({
        type: "turn_complete",
        turn: data.turnNumber,
      });
      fetchState();
    });

    es.addEventListener("simulation_complete", () => {
      fetchState();
    });

    return () => {
      es.close();
    };
  }, [simulationId, fetchState]);

  // Polling fallback
  useEffect(() => {
    if (!state || state.simulation.status !== "running") return;

    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, [state, fetchState]);

  // Actions
  async function handleStart() {
    // Optimistically update status so button disappears immediately
    setState((prev) =>
      prev ? { ...prev, simulation: { ...prev.simulation, status: "running" } } : prev
    );
    await fetch(`/api/simulation/${simulationId}/start`, { method: "POST" });
  }

  async function handlePause() {
    setState((prev) =>
      prev ? { ...prev, simulation: { ...prev.simulation, status: "paused" } } : prev
    );
    await fetch(`/api/simulation/${simulationId}/pause`, { method: "POST" });
  }

  async function handleStop() {
    setState((prev) =>
      prev ? { ...prev, simulation: { ...prev.simulation, status: "completed" } } : prev
    );
    await fetch(`/api/simulation/${simulationId}/stop`, { method: "POST" });
  }

  function handleReport() {
    router.push(`/simulation/${simulationId}/report`);
  }

  if (!state) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ color: "var(--color-text-dim)" }}
      >
        <div className="text-center">
          <div className="font-display text-2xl mb-2 animate-pulse-subtle">
            Loading simulation...
          </div>
          <p className="font-mono text-xs">Reconstructing civilizations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col gap-4 p-4">
      {/* Controls Bar */}
      <SimulationControls
        status={state.simulation.status}
        currentTurn={state.simulation.currentTurn}
        currentGeneration={state.simulation.currentGeneration}
        onStart={handleStart}
        onPause={handlePause}
        onStop={handleStop}
        onReport={handleReport}
      />

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tribe Cards — 2 columns on left */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.tribes.map((tribe) => (
            <TribeCard
              key={tribe.id}
              id={tribe.id}
              simulationId={simulationId}
              name={tribe.name}
              governanceModel={tribe.governanceModel}
              votingThreshold={tribe.votingThreshold}
              changeMagnitude={tribe.changeMagnitude}
              techLevel={tribe.techLevel}
              rules={tribe.rules as { domain: "governance" | "economy" | "social" | "cultural" | "external"; text: string }[]}
              agents={tribe.agents}
              livingCount={tribe.livingCount}
              economy={tribe.economy}
              conversation={conversations[tribe.id] ?? []}
              expanded={expandedTribe === tribe.id}
              onToggle={() =>
                setExpandedTribe(
                  expandedTribe === tribe.id ? null : tribe.id
                )
              }
            />
          ))}
        </div>

        {/* Event Feed — right column */}
        <div className="lg:col-span-1">
          <EventFeed events={events} />
        </div>
      </div>
    </div>
  );
}
