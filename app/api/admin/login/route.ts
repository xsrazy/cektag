import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSession, adminCookieHeader } from "@/lib/auth";
import { store } from "@/lib/store";
import { hashPhone } from "@/lib/phone";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  // x-real-ip di-set infrastruktur Vercel (tidak bisa di-spoof client);
  // x-forwarded-for sepenuhnya dikontrol client jadi cuma fallback terakhir.
  return req.headers.get("x-real-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "unknown";
}

export async function POST(req: NextRequest) {
  // throttle: max 10x percobaan login per jam per IP
  const ipHash = hashPhone("ip$" + clientIp(req));
  const attempts = await store.incr(`loginthrottle:${ipHash}`, 3600);
  if (attempts > 10) {
    return NextResponse.json(
      { ok: false, message: "Terlalu banyak percobaan. Coba lagi 1 jam lagi." },
      { status: 429 }
    );
  }
  const body = await req.json().catch(() => ({}));
  // captcha wajib biar brute-force susah (bot ga bisa lewat tanpa token valid)
  const ip = clientIp(req);
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ ok: false, message: "Verifikasi captcha gagal. Coba lagi." }, { status: 400 });
  }
  const ok = await verifyPassword(String(body.password || ""));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // lambatkan brute force
    return NextResponse.json({ ok: false, message: "Password salah." }, { status: 401 });
  }
  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", adminCookieHeader(token));
  return res;
}
