import { NextRequest, NextResponse } from "next/server";
import { checkSession, ADMIN_COOKIE } from "@/lib/auth";
import { getAccounts, accountQuota } from "@/lib/getcontact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tes koneksi 1 akun (tanpa makan jatah cek).
export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!(await checkSession(token))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const idx = parseInt(body.index, 10);
  const acc = getAccounts().find((a) => a.index === idx);
  if (!acc) return NextResponse.json({ ok: false, message: "Akun tidak ada." }, { status: 400 });
  const quota = await accountQuota(acc);
  const alive = quota.remaining !== null || quota.limit !== null;
  return NextResponse.json({ ok: true, alive, quota });
}
