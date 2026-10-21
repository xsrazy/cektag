import { NextRequest, NextResponse } from "next/server";
import { checkSession, destroySession, clearCookieHeader, ADMIN_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (token && (await checkSession(token))) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookieHeader());
  return res;
}
