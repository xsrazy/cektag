import { NextRequest, NextResponse } from "next/server";
import { store, todayKey } from "@/lib/store";
import { accountOverview } from "@/lib/getcontact";
import { safeEqual } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron harian 00:05 WIB: arsip statistik + cek kesehatan akun (tanpa makan jatah cek).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const given = req.nextUrl.searchParams.get("secret") || "";
  // x-vercel-cron bisa di-spoof client, jadi tidak dipakai sebagai auth — wajib secret.
  if (!secret || !safeEqual(given, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const day = todayKey();
  const checks = parseInt((await store.get(`stats:${day}:checks`)) || "0", 10);
  const apiHits = parseInt((await store.get(`apihits:${day}`)) || "0", 10);
  await store.set(`archive:${day}`, JSON.stringify({ checks, apiHits }), 90 * 24 * 3600);

  const accounts = await accountOverview();
  const problems = accounts
    .filter((a) => a.status === "dead")
    .map((a) => `akun ${a.index} DEAD`);
  console.log(`[cektag-cron] ${day}: checks=${checks} apiHits=${apiHits} problems=${problems.join(",") || "none"}`);
  return NextResponse.json({ ok: true, day, checks, apiHits, problems });
}
