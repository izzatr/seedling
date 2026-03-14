import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { simulations } from "@/db/schema";
import { pauseSimulation } from "@/lib/engine/simulation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  pauseSimulation(id);

  await db
    .update(simulations)
    .set({ status: "paused" })
    .where(eq(simulations.id, id));

  return NextResponse.json({ status: "paused" });
}
