import crypto from "crypto";

const API_BASE = "https://api.sayabayar.com/v1";

export interface SayabayarInvoice {
  invoiceId: string;      // id invoice di sayabayar (untuk cek status & webhook)
  invoiceNumber: string;  // nomor invoice tampil (INV-...)
  amount: number;         // nominal dasar (2000)
  uniqueCode: number;     // kode unik (mis. 94)
  amountToPay: number;    // total yang dibayar customer (amount + uniqueCode)
  qrImageUrl: string | null;
  qrPayload: string | null;
  paymentUrl: string | null;
  status: string;
  expiresAt: string | null;
}

function apiKey(): string {
  const k = process.env.SAYABAYAR_API_KEY;
  if (!k) throw new Error("SAYABAYAR_API_KEY belum dikonfigurasi");
  return k;
}

/** Bikin invoice QRIS di sayabayar.com. Response 201 → data invoice. */
export async function createSayabayarInvoice(
  amount: number,
  orderId: string,
  phone: string
): Promise<SayabayarInvoice> {
  const r = await fetch(`${API_BASE}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-Key": apiKey(),
    },
    body: JSON.stringify({
      amount,
      payment_method: "qris",
      description: `CekTag ${orderId}`,
      customer_phone: phone,
      expires_in_hours: 0.5,
      callback_url: "https://cektag.web.id/api/webhook/sayabayar",
    }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success || !j.data) {
    throw new Error(j.message || `Sayabayar API error (${r.status})`);
  }
  const d = j.data;
  const ch = d.payment_channel || {};
  return {
    invoiceId: String(d.id || ""),
    invoiceNumber: String(d.invoice_number || orderId),
    amount: Number(d.amount ?? amount),
    uniqueCode: Number(d.unique_code ?? ch.unique_code ?? 0),
    amountToPay: Number(d.amount_to_pay ?? ch.amount_to_pay ?? amount),
    qrImageUrl: d.qr_image_url || null,
    // string QRIS ada di data.payment_channel.qris_string (tidak ada qr_payload/qr_image_url)
    qrPayload: ch.qris_string || d.qr_payload || null,
    paymentUrl: d.payment_url || null,
    status: String(d.status || "pending"),
    expiresAt: d.expired_at || d.expires_at || ch.expired_at || null,
  };
}

/** Cek status invoice langsung ke sayabayar.com (fallback kalau webhook kelewat). */
export async function checkSayabayarStatus(invoiceId: string): Promise<{
  status: string;
  amountToPay: number | null;
}> {
  const r = await fetch(`${API_BASE}/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: { Accept: "application/json", "X-API-Key": apiKey() },
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success || !j.data) throw new Error("Gagal cek status invoice");
  const d = j.data;
  return {
    status: String(d.status || "").toLowerCase(),
    amountToPay: d.amount_to_pay != null ? Number(d.amount_to_pay) : null,
  };
}

/**
 * Verifikasi webhook sayabayar.com.
 * Header "X-Webhook-Signature" = HMAC-SHA256 (hex) dari RAW body memakai webhook secret.
 */
export function verifySayabayarSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.SAYABAYAR_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Normalisasi status sayabayar → PAID / EXPIRED / PENDING. */
export function normalizeSayabayarStatus(s: string): "PAID" | "EXPIRED" | "PENDING" {
  const v = s.toLowerCase();
  if (v === "paid") return "PAID";
  if (v === "expired" || v === "cancelled" || v === "canceled") return "EXPIRED";
  return "PENDING";
}

/**
 * Cocokkan total bayar dari payload webhook dengan nominal order.
 * Format field webhook sayabayar belum 100% pasti (dokumentasi minim),
 * jadi kumpulkan SEMUA kandidat "total bayar" yang masuk akal dari payload
 * (berbagai penamaan field + kombinasi amount+unique_code), lalu terima
 * kalau SALAH SATU persis sama dengan nominal yang diharapkan.
 * Syarat equality yang persis menjaga sifat anti-tamper: kurang bayar
 * sekecil apa pun tetap ditolak. (Signature HMAC tetap diverifikasi dulu
 * di route webhook sebelum fungsi ini dipakai.)
 */
export function paidTotalMatches(
  data: any,
  expected: number
): { ok: boolean; candidates: number[] } {
  const d = data || {};
  const cands = new Set<number>();
  const push = (v: any) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) cands.add(n);
  };
  for (const k of [
    "amount_to_pay",
    "amount_unique",
    "total_amount",
    "paid_amount",
    "total",
    "amount",
  ]) {
    push(d[k]);
  }
  const base = Number(d.amount);
  const uniq = Number(d.unique_code ?? d.uniqueCode);
  if (Number.isFinite(base) && base > 0 && Number.isFinite(uniq) && uniq >= 0) {
    cands.add(base + uniq);
  }
  const candidates = [...cands];
  return { ok: candidates.includes(expected), candidates };
}
