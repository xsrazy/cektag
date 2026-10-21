import { NextResponse } from "next/server";
import { store, todayKey } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Statistik publik (agregat, tanpa data sensitif).
export async function GET() {
  const day = todayKey();
  const checksToday = parseInt((await store.get(`stats:${day}:checks`)) || "0", 10);
  const checksTotal = parseInt((await store.get("stats:total:checks")) || "0", 10);
  return NextResponse.json({ checksToday, checksTotal });
}
