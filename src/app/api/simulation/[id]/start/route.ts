import { NextResponse } from "next/server";
import { startSimulationLoop } from "@/lib/engine/simulation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fire-and-forget: start the simulation loop
  startSimulationLoop(id).catch((err) =>
    console.error("Simulation loop error:", err)
  );

  return NextResponse.json({ status: "started" });
}
