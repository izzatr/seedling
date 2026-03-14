import { addClient, removeClient } from "@/lib/engine/sse";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const stream = new ReadableStream({
    start(controller) {
      addClient(id, controller);

      // Send heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            new TextEncoder().encode(": heartbeat\n\n")
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on close
      _request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeClient(id, controller);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
