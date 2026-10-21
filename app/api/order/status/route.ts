import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { checkSayabayarStatus, normalizeSayabayarStatus } from "@/lib/sayabayar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update baris order yang sudah ada di "orders:recent" (cocokkan orderId),
 *  bukan nambah baris baru — biar 1 order = 1 baris di admin. */
async function updateOrderRow(orderId: string, patch: Record<string, any>) {
  const all = await store.lrange("orders:recent", 100);
  let found = false;
  const next = all.map((l) => {
    try {
      const o = JSON.parse(l);
      if (o.orderId === orderId) {
        found = true;
        return JSON.stringify({ ...o, ...patch });
      }
    } catch { /* baris rusak, biarkan */ }
    return l;
  });
  if (!found) {
    next.unshift(JSON.stringify({ orderId, ...patch, at: new Date().toISOString() }));
  }
  await store.del("orders:recent");
  for (const item of next.reverse()) await store.lpush("orders:recent", item);
  await store.ltrim("orders:recent", 100);
}

/** Poll status order. Kalau masih PENDING, coba fallback cek langsung ke sayabayar.com. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || "").slice(0, 64);
    if (!orderId) {
      return NextResponse.json({ code: "invalid_order", message: "ID Pesanan tidak valid." }, { status: 400 });
    }
    const s = await store.get(`order:${orderId}`);
    if (!s) {
      return NextResponse.json({ code: "order_expired", message: "Pesanan kedaluwarsa atau tidak ditemukan." }, { status: 404 });
    }
    const o = JSON.parse(s);

    // fallback: kalau masih PENDING, tanya langsung ke sayabayar.com (webhook mungkin kelewat).
    // Hasil remote di-cache 45 detik per orderId biar ga nembak API sayabayar tiap 3 detik.
    if (o.status === "PENDING" && process.env.SAYABAYAR_API_KEY && o.invoiceId) {
      const cached = await store.get(`sbcheck:${orderId}`);
      if (!cached) {
        try {
          const st = await checkSayabayarStatus(o.invoiceId);
          const norm = normalizeSayabayarStatus(st.status);
          if (norm !== "PENDING") {
            // cocokkan total bayar sebelum tandai lunas
            if (norm === "PAID" && st.amountToPay != null && o.amountToPay != null && st.amountToPay !== o.amountToPay) {
              // nominal ga cocok — biarkan PENDING, catat di baris yang sama
              await updateOrderRow(orderId, { phone: o.phone, amount: o.amountToPay, status: "AMOUNT_MISMATCH" });
            } else {
              o.status = norm;
              if (norm === "PAID") o.paidAt = new Date().toISOString();
              await store.set(`order:${orderId}`, JSON.stringify(o), 60 * 60);
              await updateOrderRow(orderId, {
                phone: o.phone, amount: o.amountToPay ?? o.amount, status: norm,
                at: norm === "PAID" ? o.paidAt : new Date().toISOString(),
              });
              // samakan dengan webhook: indeks order lunas (anti bayar 2x)
              if (norm === "PAID" && o.phone && o.ipHash) {
                await store.set(`paidorder:${o.phone}:${o.ipHash}`, orderId, 60 * 60);
              }
            }
          }
        } catch { /* abaikan, pakai status lokal */ }
        await store.set(`sbcheck:${orderId}`, "1", 45);
      }
    }

    return NextResponse.json({
      orderId,
      status: o.status,
      amount: o.amount,
      amountToPay: o.amountToPay ?? o.amount,
    });
  } catch {
    return NextResponse.json({ code: "server_error", message: "Terjadi kesalahan." }, { status: 500 });
  }
}
