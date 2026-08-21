import { NextRequest, NextResponse } from "next/server";
import { runApplicableLawSweep } from "@/lib/agents/applicable-law-agent";
import type { IndiaStateOrUT } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { facts, state } = await req.json();
  if (!facts || typeof facts !== "string") {
    return NextResponse.json({ error: "facts is required" }, { status: 400 });
  }
  const result = runApplicableLawSweep(facts, { level: "state", state: state as IndiaStateOrUT });
  return NextResponse.json(result);
}
