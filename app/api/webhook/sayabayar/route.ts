import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import {
  verifySayabayarSignature,
  normalizeSayabayarStatus,
  paidTotalMatches,
} from "@/lib/sayabayar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook sayabayar.com.
 * Event: invoice.paid / invoice.expired / invoice.cancelled
 * Header X-Webhook-Signature = HMAC-SHA256 hex dari raw body.
 */
/** Update baris order di "orders:recent" secara atomik: lpush baris baru di depan,
 *  admin/data melakukan dedup by orderId (ambil yang terbaru). Tidak ada del+rebuild
 *  sehingga dua webhook bersamaan tidak bisa saling menghapus. */
async function updateOrderRow(orderId: string, patch: Record<string, any>) {
  await store.lpush(
    "orders:recent",
    JSON.stringify({ orderId, ...patch, at: new Date().toISOString() })
  );
  await store.ltrim("orders:recent", 100);
}

/** Catat hasil akhir pemrosesan webhook — biar kegagalan berikutnya langsung ketauan
 *  penyebabnya tanpa nebak-nebak (pelajaran dari insiden 17 Okt 2026: webhook 200
 *  tapi order tidak jadi PAID dan tidak ada log yang menjelaskan kenapa). */
function logOutcome(invoiceId: string, orderId: string | null, outcome: string, extra?: Record<string, any>) {
  try {
    console.log(
      "[cektag] webhook sayabayar outcome:",
      JSON.stringify({ at: new Date().toISOString(), invoiceId, orderId, outcome, ...extra })
    );
  } catch { /* logging ga boleh ganggu flow */ }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let body: any = {};
  try { body = JSON.parse(raw); } catch {
    logOutcome("", null, "bad_payload");
    return NextResponse.json({ ok: false, code: "bad_payload" }, { status: 400 });
  }

  const event = String(body.event || req.headers.get("x-webhook-event") || "").toLowerCase();
  const data = body.data || {};
  const invoiceId = String(data.invoice_id || "");

  // --- diagnostik webhook: catat header signature yang masuk (nama + 8 char pertama aja,
  // tanpa nilai penuh), nama event, invoice id, dan field nominal apa adanya —
  // dipakai buat verifikasi format webhook sayabayar yang sebenarnya.
  try {
    const sigHeaders: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      const kl = k.toLowerCase();
      if (kl.includes("sign") || kl.includes("webhook") || kl.includes("signature")) {
        sigHeaders[k] = String(v).slice(0, 8) + "…";
      }
    });
    const diag = JSON.stringify({
      at: new Date().toISOString(),
      event,
      invoiceId,
      status: String(data.status || ""),
      sigHeaders,
      amounts: {
        amount: data.amount ?? null,
        amount_unique: data.amount_unique ?? null,
        amount_to_pay: data.amount_to_pay ?? null,
        unique_code: data.unique_code ?? data.uniqueCode ?? null,
      },
    });
    console.log("[cektag] webhook sayabayar:", diag);
    await store.lpush("webhook:log", diag);
    await store.ltrim("webhook:log", 50);
  } catch { /* diagnostik ga boleh ganggu flow */ }

  const sig = req.headers.get("x-webhook-signature");
  if (!verifySayabayarSignature(raw, sig)) {
    logOutcome(invoiceId, null, "bad_signature");
    return NextResponse.json({ ok: false, code: "bad_signature" }, { status: 401 });
  }

  if (!invoiceId) {
    logOutcome("", null, "no_invoice_id");
    return NextResponse.json({ ok: true, code: "no_invoice_id" });
  }

  // idempotensi: 1 event_id diproses 1x (pakai timestamp+invoice+event sebagai kunci)
  const eventKey = `sbevt:${invoiceId}:${event}:${String(body.timestamp || "")}`.slice(0, 120);
  const seen = await store.incr(eventKey, 24 * 3600);
  if (seen > 1) {
    logOutcome(invoiceId, null, "duplicate");
    return NextResponse.json({ ok: true, code: "duplicate" });
  }

  // petakan invoice sayabayar → order CekTag
  const orderId = await store.get(`sbinvoice:${invoiceId}`);
  if (!orderId) {
    logOutcome(invoiceId, null, "unknown_invoice");
    return NextResponse.json({ ok: true, code: "unknown_invoice" });
  }

  const status = normalizeSayabayarStatus(String(data.status || ""));

  try {
    const s = await store.get(`order:${orderId}`);
    if (s) {
      const o = JSON.parse(s);
      if (o.status === "PENDING") {
        // cocokkan total bayar dengan nominal order. Format field webhook sayabayar
        // belum pasti, jadi terima kalau SALAH SATU kandidat total persis sama
        // dengan amountToPay (kurang bayar tetap ditolak).
        const m = o.amountToPay != null
          ? paidTotalMatches(data, Number(o.amountToPay))
          : { ok: true, candidates: [] };
        if (!m.ok) {
          await updateOrderRow(orderId, {
            phone: o.phone, amount: o.amountToPay, status: "AMOUNT_MISMATCH",
          });
          logOutcome(invoiceId, orderId, "amount_mismatch", {
            expected: o.amountToPay, candidates: m.candidates,
          });
        } else if (status === "PAID" && (event === "invoice.paid" || event === "invoice_paid")) {
          o.status = "PAID";
          o.paidAt = new Date().toISOString();
          o.paidVia = String(data.payment_channel || "QRIS");
          await store.set(`order:${orderId}`, JSON.stringify(o), 30 * 60);
          await updateOrderRow(orderId, {
            phone: o.phone, amount: o.amountToPay ?? o.amount, status: "PAID", at: o.paidAt,
          });
          // indeks order lunas per nomer+IP — dipakai /api/order buat nawarin
          // "pakai pembayaran sebelumnya" biar user ga bayar 2x kalau halamannya
          // ke-reload/ke-tutup pas webhook datang (insiden 17 Okt 2026).
          if (o.phone && o.ipHash) {
            await store.set(`paidorder:${o.phone}:${o.ipHash}`, orderId, 60 * 60);
          }
          logOutcome(invoiceId, orderId, "paid");
        } else if (status === "EXPIRED") {
          o.status = "EXPIRED";
          await store.set(`order:${orderId}`, JSON.stringify(o), 30 * 60);
          await updateOrderRow(orderId, { phone: o.phone, amount: o.amountToPay ?? o.amount, status: "EXPIRED" });
          logOutcome(invoiceId, orderId, "expired");
        } else {
          logOutcome(invoiceId, orderId, "ignored", { event, status });
        }
      } else {
        logOutcome(invoiceId, orderId, "not_pending", { orderStatus: o.status });
      }
    } else {
      logOutcome(invoiceId, orderId, "order_missing");
    }
  } catch (e: any) {
    logOutcome(invoiceId, orderId, "error", { message: String(e?.message || e).slice(0, 200) });
  }

  return NextResponse.json({ ok: true });
}
