import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkSession, ADMIN_COOKIE } from "@/lib/auth";
import { store } from "@/lib/store";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aksi admin: freeze / unfreeze nomor.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!(await checkSession(token))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "del_order") {
    const idx = parseInt(String(body.index ?? ""), 10);
    const all = await store.lrange("orders:recent", 100);
    if (!isNaN(idx) && idx >= 0 && idx < all.length) {
      all.splice(idx, 1);
      await store.del("orders:recent");
      for (const item of all.reverse()) await store.lpush("orders:recent", item);
      return NextResponse.json({ ok: true, message: "Pesanan dihapus." });
    }
    return NextResponse.json({ ok: false, message: "Pesanan tidak ketemu." }, { status: 400 });
  }

  if (action === "del_report") {
    const idx = parseInt(String(body.index ?? ""), 10);
    const all = await store.lrange("reports", 1000);
    if (!isNaN(idx) && idx >= 0 && idx < all.length) {
      all.splice(idx, 1);
      await store.del("reports");
      for (const item of all.reverse()) await store.lpush("reports", item);
      return NextResponse.json({ ok: true, message: "Laporan dihapus." });
    }
    return NextResponse.json({ ok: false, message: "Laporan tidak ketemu." }, { status: 400 });
  }

  const phone = normalizePhone(String(body.phone || ""));
  if (!phone) return NextResponse.json({ ok: false, message: "Nomor tidak valid." }, { status: 400 });

  if (action === "freeze") {
    if (await store.get(`frozen:${phone}`)) {
      return NextResponse.json({ ok: true, message: "Nomer ini udah dibekuin." });
    }
    await store.set(`frozen:${phone}`, "1", 30 * 24 * 3600);
    await store.sadd("frozen:set", phone);
    return NextResponse.json({ ok: true, message: "Nomor dibekukan 30 hari." });
  }
  if (action === "unfreeze") {
    await store.del(`frozen:${phone}`);
    await store.del(`flag:${phone}`);
    await store.srem("frozen:set", phone);
    return NextResponse.json({ ok: true, message: "Nomor dibuka." });
  }
  // Mode test (17 Okt 2026, permintaan user): bikin order LUNAS tanpa bayar,
  // khusus buat ngetes alur tanpa kepotong duit pribadi. Hanya bisa dibuat dari
  // admin yang login (route ini sudah proteksi session). Order ditandai test:true
  // supaya tidak mengotori statistik, dan hanya bisa dipakai lewat link khusus.
  if (action === "create_test_order") {
    const orderId = `CT-TEST-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    const now = new Date().toISOString();
    const order = {
      orderId,
      phone,
      status: "PAID",
      amount: 0,
      amountToPay: 0,
      uniqueCode: 0,
      invoiceId: null,
      test: true,
      paidAt: now,
      paidVia: "TEST",
      createdAt: now,
    };
    await store.set(`order:${orderId}`, JSON.stringify(order), 60 * 60);
    await store.lpush(
      "orders:recent",
      JSON.stringify({ orderId, phone, amount: 0, status: "PAID", test: true, at: now })
    );
    await store.ltrim("orders:recent", 100);
    const base = (process.env.APP_URL || "https://cektag.web.id").replace(/\/$/, "");
    return NextResponse.json({
      ok: true,
      orderId,
      testUrl: `${base}/?testOrder=${orderId}&phone=${phone}`,
      message: "Order test dibuat. Buka linknya buat ngetes.",
    });
  }
  return NextResponse.json({ ok: false, message: "Aksi tidak dikenal." }, { status: 400 });
}
