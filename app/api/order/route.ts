import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import QRCode from "qrcode";
import { normalizePhone, hashPhone } from "@/lib/phone";
import { store, usingMemoryStore } from "@/lib/store";
import { createSayabayarInvoice } from "@/lib/sayabayar";
import { CHECK_PRICE } from "@/lib/pricing";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_TTL = 60 * 60; // order kedaluwarsa 60 menit

function clientIp(req: NextRequest): string {
  // x-real-ip di-set infrastruktur Vercel (tidak bisa di-spoof client);
  // x-forwarded-for sepenuhnya dikontrol client jadi cuma fallback terakhir.
  return req.headers.get("x-real-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "unknown";
}

/** Bikin invoice pembayaran QRIS via sayabayar.com. 1 invoice lunas = 1x cek. */
export async function POST(req: NextRequest) {
  // fail-closed: jangan terima order kalau Redis tidak terhubung (state pecah antar instance)
  if (process.env.NODE_ENV === "production" && usingMemoryStore()) {
    return NextResponse.json(
      { code: "server_error", message: "Layanan sedang gangguan. Coba lagi nanti." },
      { status: 503 }
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(String(body.phone || ""));
    if (!phone) {
      return NextResponse.json(
        { code: "invalid_phone", message: "Format nomer HP tidak valid. Contoh: 081234567890." },
        { status: 400 }
      );
    }
    if (phone === "6281200000000" || phone === "6281200000001") {
      return NextResponse.json({ demo: true });
    }

    const ip = clientIp(req);

    // kalau kuota GetContact abis (flag dari cron monitor), tolak sebelum invoice dibuat
    // biar user ga bayar sia-sia
    if (await store.get("gtc:quota:exhausted")) {
      return NextResponse.json(
        { code: "kuota_habis", message: "Duh, lagi rame banget yang ngecek nih.\nCoba lagi nanti aja, ya!" },
        { status: 503 }
      );
    }

    // captcha Cloudflare Turnstile wajib sebelum invoice dibuat (anti spam klik Cek)
    const tsOk = await verifyTurnstile(
      typeof body.turnstileToken === "string" ? body.turnstileToken : undefined,
      ip
    );
    if (!tsOk) {
      return NextResponse.json(
        { code: "captcha", message: "Captcha belum valid. Selesaikan captcha dulu." },
        { status: 403 }
      );
    }

    // nomer yang dibekukan admin: tolak sebelum invoice dibuat, biar duit ga nyangkut
    if (await store.get(`frozen:${phone}`)) {
      return NextResponse.json(
        { code: "frozen", message: "Nomer ini dibekukan, ga bisa dicek." },
        { status: 403 }
      );
    }

    // throttle bikin order: max 10/jam per IP
    const attempts = await store.incr(`orderthrottle:${hashPhone("ip$" + ip)}`, 3600);
    if (attempts > 10) {
      return NextResponse.json(
        { code: "too_many_orders", message: "Terlalu banyak order. Coba lagi nanti." },
        { status: 429 }
      );
    }

    if (!process.env.SAYABAYAR_API_KEY) {
      return NextResponse.json(
        { code: "payment_off", message: "Pembayaran belum aktif. Coba lagi nanti." },
        { status: 503 }
      );
    }

    // Safety net insiden 17 Okt 2026 (user bayar 2x karena halaman ke-reload
    // pas webhook datang): kalau nomer ini udah ada order LUNAS yang belum
    // dipakai dari IP yang sama, tawarin pakai itu dulu — jangan bikin invoice baru.
    // Frontend menampilkan pilihan; kirim forceNew:true buat lewati pengecekan ini.
    const forceNew = body.forceNew === true;
    const ipHash = hashPhone("ip$" + ip);
    if (!forceNew) {
      const paidKey = `paidorder:${phone}:${ipHash}`;
      const paidOid = await store.get(paidKey);
      if (paidOid) {
        let stillPaid = false;
        let paidAmount: number | null = null;
        try {
          const ps = await store.get(`order:${paidOid}`);
          const po = ps ? JSON.parse(ps) : null;
          if (po && po.status === "PAID" && po.phone === phone) {
            stillPaid = true;
            paidAmount = po.amountToPay ?? po.amount ?? null;
          }
        } catch { /* abaikan, anggap basi */ }
        if (stillPaid) {
          return NextResponse.json({
            alreadyPaid: true,
            orderId: paidOid,
            amountToPay: paidAmount,
          });
        }
        await store.del(paidKey); // basi (dipakai/kedaluwarsa) — bersihkan
      }
    }

    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const orderId = `CT-${stamp}-${rand}`;

    const inv = await createSayabayarInvoice(CHECK_PRICE, orderId, phone);

    // QR dirender langsung di CekTag biar user ga perlu buka web sayabayar:
    // pakai qr_image_url kalau ada, kalau kosong generate dari qr_payload (string QRIS).
    let qrUrl: string | null = inv.qrImageUrl;
    if (!qrUrl && inv.qrPayload) {
      try {
        qrUrl = await QRCode.toDataURL(inv.qrPayload, { width: 512, margin: 1, errorCorrectionLevel: "H" });
      } catch { /* fallback ke paymentUrl */ }
    }

    const order = {
      orderId,
      phone,
      status: "PENDING",
      amount: inv.amount,
      amountToPay: inv.amountToPay,
      uniqueCode: inv.uniqueCode,
      invoiceId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      qrUrl,
      paymentUrl: inv.paymentUrl,
      expiresAt: inv.expiresAt,
      createdAt: now.toISOString(),
      // hash IP pembuat — dipakai webhook buat indeks paidorder (anti bayar 2x)
      ipHash,
    };
    try {
      await store.set(`order:${orderId}`, JSON.stringify(order), ORDER_TTL);
      // indeks balik: invoice sayabayar → order CekTag (dipakai webhook)
      if (inv.invoiceId) {
        await store.set(`sbinvoice:${inv.invoiceId}`, orderId, ORDER_TTL);
      }
      await store.lpush(
        "orders:recent",
        JSON.stringify({ orderId, phone, amount: inv.amountToPay, status: "PENDING", at: order.createdAt })
      );
      await store.ltrim("orders:recent", 100);
    } catch (e) {
      // kalau penyimpanan gagal setelah invoice dibuat: jangan kasih QR ke user
      // (invoice yatim tanpa record = duit nyangkut). Invoice expired sendiri 30 mnt.
      console.error("[cektag] gagal simpan order", orderId, e);
      return NextResponse.json(
        { code: "server_error", message: "Gagal bikin pesanan. Coba lagi." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      orderId,
      amount: inv.amount,
      amountToPay: inv.amountToPay,
      uniqueCode: inv.uniqueCode,
      qrUrl,
      paymentUrl: inv.paymentUrl,
      expiresAt: inv.expiresAt,
    });
  } catch (e: any) {
    return NextResponse.json(
      { code: "order_failed", message: e?.message || "Gagal membuat order pembayaran." },
      { status: 502 }
    );
  }
}
