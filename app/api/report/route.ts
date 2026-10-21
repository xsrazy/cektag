import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, hashPhone } from "@/lib/phone";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Laporan user: "hasilnya salah" — masuk antrean review admin.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(String(body.phone || ""));
  const type = String(body.type || "salah").slice(0, 20);
  if (!phone) return NextResponse.json({ ok: false }, { status: 400 });
  // throttle: max 5 laporan per jam per IP biar ga di-spam
  // x-real-ip di-set infrastruktur Vercel (tidak bisa di-spoof); x-forwarded-for cuma fallback.
  const ip = req.headers.get("x-real-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "unknown";
  const ipHash = hashPhone("ip$" + ip);
  const attempts = await store.incr(`reportthrottle:${ipHash}`, 3600);
  if (attempts > 5) {
    return NextResponse.json({ ok: false, message: "Terlalu banyak laporan. Coba lagi nanti." }, { status: 429 });
  }
  await store.lpush(
    "reports",
    JSON.stringify({ ts: new Date().toISOString(), phone, type })
  );
  await store.ltrim("reports", 500);
  return NextResponse.json({ ok: true });
}
