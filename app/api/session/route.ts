import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { Users } from "@/lib/db/repo";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!Users.get(userId)) {
    return NextResponse.json({ error: "Unknown demo user" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, userId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
