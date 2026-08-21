import { NextResponse } from "next/server";
import { COLLECTIONS, resetToSeed } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/session";

export async function POST() {
  const user = await getCurrentUser();
  if (user.role !== "firm_admin" && user.role !== "platform_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  for (const collection of Object.values(COLLECTIONS)) resetToSeed(collection);
  return NextResponse.json({ ok: true });
}
