import { NextResponse } from "next/server";
import { store, storageBackend } from "@/lib/store";
import { getAccounts } from "@/lib/getcontact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Health check ringan untuk monitoring. Tanpa data sensitif:
// jumlah akun GetContact disembunyikan (info infra).
export async function GET() {
  const accs = getAccounts();
  let okCount = 0;
  for (const a of accs) {
    const s = await store.get(`acct:${a.index}:status`);
    if (!s || s === "ok") okCount++;
  }
  const status = accs.length === 0 ? "unconfigured" : okCount > 0 ? "ok" : "down";
  return NextResponse.json({
    status,
    ts: new Date().toISOString(),
  });
}
