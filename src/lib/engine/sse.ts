type SSEController = ReadableStreamDefaultController;

const controllers = new Map<string, Set<SSEController>>();

export function addClient(
  simulationId: string,
  controller: SSEController
): void {
  if (!controllers.has(simulationId)) {
    controllers.set(simulationId, new Set());
  }
  controllers.get(simulationId)!.add(controller);
}

export function removeClient(
  simulationId: string,
  controller: SSEController
): void {
  controllers.get(simulationId)?.delete(controller);
  if (controllers.get(simulationId)?.size === 0) {
    controllers.delete(simulationId);
  }
}

export type SSEEventType =
  | "turn_start"
  | "happening"
  | "speech"
  | "turn_complete"
  | "simulation_complete"
  | "simulation_error";

export function broadcast(
  simulationId: string,
  eventType: SSEEventType,
  data: Record<string, unknown>
): void {
  const clients = controllers.get(simulationId);
  if (!clients || clients.size === 0) return;

  const encoded = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead: SSEController[] = [];

  for (const controller of clients) {
    try {
      controller.enqueue(new TextEncoder().encode(encoded));
    } catch {
      dead.push(controller);
    }
  }

  for (const controller of dead) {
    clients.delete(controller);
  }
}
