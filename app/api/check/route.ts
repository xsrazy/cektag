import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, hashPhone } from "@/lib/phone";
import { store, todayKey, usingMemoryStore } from "@/lib/store";
import { checkTags, GtcError } from "@/lib/getcontact";
import { consumeApiHit } from "@/lib/ratelimit";
import { CHECK_PRICE } from "@/lib/pricing";

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
  // fail-closed: jangan proses cek kalau Redis tidak terhubung (state pecah antar instance)
  if (process.env.NODE_ENV === "production" && usingMemoryStore()) {
    return NextResponse.json(
      { code: "server_error", message: "Layanan sedang gangguan. Coba lagi nanti." },
      { status: 503 }
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body.phone || "");
    const fingerprint = String(body.fingerprint || "unknown").slice(0, 64);
    const ip = clientIp(req);
    const ipHash = hashPhone("ip$" + ip);
    const day = todayKey();

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json(
        { code: "invalid_phone", message: "Format nomer HP tidak valid. Contoh: 081234567890." },
        { status: 400 }
      );
    }

    // mode demo: nomer khusus buat preview tampilan hasil (tanpa bayar, tanpa API, tanpa log)
    // tetap di-throttle biar ga di-spam buat bandwidth/CPU
    if (phone === "6281200000000" || phone === "6281200000001") {
      const demoIpHash = hashPhone("ip$" + clientIp(req));
      const demoHits = await store.incr(`demothrottle:${demoIpHash}`, 3600);
      if (demoHits > 30) {
        return NextResponse.json(
          { code: "rate_limited", message: "Kebanyakan coba demo. Tunggu 1 jam ya." },
          { status: 429 }
        );
      }
    }
    if (phone === "6281200000000") {
      return NextResponse.json({
        tags: [
          "Budi Santoso",
          "Budi - Temen Kantor",
          "Pak Budi",
          "Budi Marketing",
          "Budi Hartono",
          "Mas Budi",
          "Budi (Sales)",
          "Budi - Alumni SMA",
        ],
        demo: true,
      });
    }

    // mode demo 2: preview tampilan nomer private/kosong (tanpa bayar, tanpa API, tanpa log)
    if (phone === "6281200000001") {
      return NextResponse.json({ tags: [], demo: true });
    }

    // freeze check (nomor dibekukan admin)
    if (await store.get(`frozen:${phone}`)) {
      return NextResponse.json(
        { code: "frozen", message: "Nomer ini sedang dibatasi pengecekannya." },
        { status: 403 }
      );
    }

    // MODE BERBAYAR: 1 order lunas = 1x cek
    const orderId = String(body.orderId || "").slice(0, 64);
    if (!orderId) {
      return NextResponse.json(
        {
          code: "payment_required",
          message: `Bayar dulu ${CHECK_PRICE.toLocaleString("id-ID")} buat ngecek nomer ini.`,
          price: CHECK_PRICE,
        },
        { status: 402 }
      );
    }
    const os = await store.get(`order:${orderId}`);
    if (!os) {
      return NextResponse.json(
        { code: "order_expired", message: "Pesanan kedaluwarsa atau tidak ditemukan. Bikin pesanan baru ya." },
        { status: 402 }
      );
    }
    const o = JSON.parse(os);
    if (o.phone !== phone) {
      return NextResponse.json(
        { code: "order_mismatch", message: "Pesanan ini dibuat buat nomer lain." },
        { status: 403 }
      );
    }
    if (o.status === "USED") {
      return NextResponse.json(
        { code: "order_used", message: "Pesanan ini sudah dipakai buat ngecek." },
        { status: 409 }
      );
    }
    if (o.status !== "PAID") {
      return NextResponse.json(
        {
          code: "order_unpaid",
          message: "Pesanan ini belum dibayar. Selesaikan pembayaran dulu ya.",
          price: CHECK_PRICE,
        },
        { status: 402 }
      );
    }
    // catatan: batesan harian dicabut per permintaan user (2026-10-16) —
    // kuota asli GetContact yang jadi patokan, dimonitor cron terpisah.

    // cegah 1 order dipakai 2x (atomic via incr). Klaim dilepas lagi kalau lookup gagal,
    // jadi order lunas ga hangus gara-gara GetContact error — user bisa coba lagi.
    const usedCount = await store.incr(`oconsume:${orderId}`, 3600);
    if (usedCount > 1) {
      return NextResponse.json(
        { code: "order_used", message: "Pesanan ini sudah dipakai buat ngecek." },
        { status: 409 }
      );
    }

    // selalu hit GetContact secara real-time (tanpa cache)
    const t0 = Date.now();
    try {
      const { tags, account, deletedTagCount } = await checkTags(phone);
      const ms = Date.now() - t0;
      await consumeApiHit();
      // lookup sukses → order resmi terpakai
      o.status = "USED";
      await store.set(`order:${orderId}`, JSON.stringify(o), 30 * 60);
      const isTest = o.test === true;
      if (!isTest) {
        await store.zincrby(`top:${day}`, phone);
        const numCount = await store.incr(`num:${phone}:${day}`, 48 * 3600);
        if (numCount === 4) {
          // flag stalking: 1 nomer dicek >3x sehari
          await store.set(`flag:${phone}`, JSON.stringify({ reason: "stalking", at: new Date().toISOString() }), 7 * 24 * 3600);
        }
        // statistik harian + total kumulatif
        await store.incr(`stats:${day}:checks`, 48 * 3600);
        await store.incr("stats:total:checks", 5 * 365 * 24 * 3600);
      }
      // lookup sukses = kuota masih ada → pastikan flag abis dicabut
      await store.del("gtc:quota:exhausted");
      // order sudah dipakai → hapus indeks paidorder biar ga ditawarin lagi
      if (o.ipHash) await store.del(`paidorder:${phone}:${o.ipHash}`);
      await logCheck(phone, ipHash, fingerprint, account, ms);
      // field `account` disembunyikan dari response (info infra, tidak dipakai UI)
      return NextResponse.json({ tags, deletedTagCount, ...(isTest ? { test: true } : {}) });
    } catch (e: any) {
      // lookup gagal → lepas klaim supaya order bisa dipakai coba lagi
      await store.del(`oconsume:${orderId}`);
      if (e instanceof GtcError && e.code === "no_accounts") {
        return NextResponse.json(
          { code: "not_configured", message: "Layanan belum dikonfigurasi. Coba lagi nanti." },
          { status: 503 }
        );
      }
      const msg = String(e?.message || "");
      // catat error ASLI di log server — pelajaran insiden 17 Okt 2026: dua 503
      // beruntun tanpa ada yang tahu penyebabnya karena errornya tidak di-log.
      console.error(`[cektag] lookup gagal order=${orderId} phone=${phone}:`, msg);
      // Bedakan kuota beneran habis vs gangguan sesaat — insiden 17 Okt 2026:
      // lookup gagal 2x padahal kuota sehat (75/80), tapi user dikasih pesan
      // "lagi rame" yang menyesatkan. Flag penolak order baru hanya dipasang
      // kalau memang sinyal kuota/limit dari GetContact (bukan timeout/500).
      // NOTE: cek berdasarkan PESAN error, bukan code — code "all_failed"
      // dipakai untuk semua jenis kegagalan lookup.
      const quotaIsh =
        e instanceof GtcError &&
        /kuota|quota|habis|exhausted|kena limit|limit exceeded/i.test(msg);
      if (quotaIsh) {
        // kalau GetContact nolak karena kuota/limit abis → pasang flag biar /api/order
        // otomatis nolak order baru (user ga bayar sia-sia). TTL pendek (15 mnt):
        // kalau cuma error transient, flag cepat hilang sendiri; kalau beneran abis,
        // check gagal berikutnya bakal pasang lagi. Flag dicabut pas lookup sukses.
        await store.set("gtc:quota:exhausted", "1", 15 * 60);
        await logCheck(phone, ipHash, fingerprint, -1, Date.now() - t0, "gtc_fail");
        return NextResponse.json(
          { code: "kuota_habis", message: "Duh, lagi rame banget yang ngecek nih.\nCoba lagi nanti aja, ya!" },
          { status: 503 }
        );
      }
      await logCheck(phone, ipHash, fingerprint, -1, Date.now() - t0, "gtc_fail");
      return NextResponse.json(
        {
          code: "lookup_failed",
          message: "Duh, koneksi ke GetContact lagi gangguan.\nCoba lagi ya, pembayaranmu aman dan ga hangus.",
        },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { code: "server_error", message: "Terjadi kesalahan. Coba lagi." },
      { status: 500 }
    );
  }
}

async function logCheck(
  phone: string, ipHash: string, fp: string,
  account: number, ms: number, note?: string
) {
  try {
    await store.lpush(
      `logs:${todayKey()}`,
      JSON.stringify({
        ts: new Date().toISOString(),
        phone: phone,
        ip: ipHash.slice(0, 12),
        fp: fp.slice(0, 12),
        account, cached: false, ms, note: note || "",
      })
    );
    await store.ltrim(`logs:${todayKey()}`, 500);
  } catch { /* abaikan */ }
}
