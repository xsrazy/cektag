import { NextRequest, NextResponse } from "next/server";
import { checkSession, ADMIN_COOKIE } from "@/lib/auth";
import { store, todayKey } from "@/lib/store";
import { accountOverview } from "@/lib/getcontact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!(await checkSession(token))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const day = todayKey();
  const checks = parseInt((await store.get(`stats:${day}:checks`)) || "0", 10);
  const apiHits = parseInt((await store.get(`apihits:${day}`)) || "0", 10);
  // kuota GetContact di-cache 3 menit: tiap load dashboard ga perlu hit API per akun
  // (5 akun x timeout 10 detik bisa bikin dashboard hang ~50 detik)
  let accounts;
  try {
    const cached = await store.get("admin:acctoverview");
    if (cached) {
      accounts = JSON.parse(cached);
    } else {
      accounts = await accountOverview();
      await store.set("admin:acctoverview", JSON.stringify(accounts), 180);
    }
  } catch {
    accounts = await accountOverview();
  }
  const top = await store.zrevrange(`top:${day}`, 20);
  const logs = (await store.lrange(`logs:${day}`, 50)).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const reports = (await store.lrange("reports", 20)).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const frozenCount = await store.scard("frozen:set");
  const frozen = await store.smembers("frozen:set");
  // dedup by orderId (ambil baris terbaru) — webhook pakai lpush atomik
  const seen = new Set<string>();
  const orders = (await store.lrange("orders:recent", 100)).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter((o: any) => {
    if (!o || !o.orderId || seen.has(o.orderId)) return false;
    seen.add(o.orderId);
    return true;
  }).slice(0, 30);
  // tandai PENDING yang datanya sudah hilang (TTL 60 mnt habis) sebagai EXPIRED.
  // Hanya tampilan — tidak ditulis balik ke list (idempotent, tanpa race dengan webhook).
  for (const o of orders) {
    if (o.status === "PENDING" && o.orderId) {
      try {
        const live = await store.get(`order:${o.orderId}`);
        if (!live) o.status = "EXPIRED";
      } catch { /* abaikan, biarkan PENDING */ }
    }
  }
  const flagged: { phone: string; info: any }[] = [];
  // kumpulkan flag stalking hari ini (scan ringan: dari top list)
  for (const t of top.slice(0, 20)) {
    const f = await store.get(`flag:${t.member}`);
    if (f) flagged.push({ phone: t.member, info: JSON.parse(f) });
  }
  return NextResponse.json({
    ok: true,
    day,
    checks,
    apiHits,
    accounts,
    top,
    logs,
    reports,
    flagged,
    frozenCount,
    frozen,
    orders,
  });
}
