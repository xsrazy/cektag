/**
 * Monitor kuota GetContact.
 * Dijalankan cron tiap jam. Cek sisa numberDetail semua akun,
 * cetak status JSON. Cron yang baca output ini buat kirim notif WA
 * kalau sisa <= 5 (peringatan) atau 0 (darurat).
 *
 * Flag gtc:quota:exhausted di Redis di-set/dicabut oleh webnya sendiri
 * (app/api/check) berdasarkan respon asli GetContact — lebih akurat.
 *
 * Env yang dibutuhkan: GTC_TOKEN_N, GTC_FINAL_KEY_N, GTC_DEVICE_ID_N (opsional).
 * TIDAK memakan jatah cek (pakai endpoint subscription, bukan number-detail).
 */
import { getAccounts, accountQuota } from "../lib/getcontact";

async function main() {
  const accs = getAccounts();
  let totalRemaining: number | null = 0;
  let totalLimit = 0;
  const perAccount: { index: number; remaining: number | null; limit: number | null }[] = [];

  for (const acc of accs) {
    const q = await accountQuota(acc);
    perAccount.push({ index: acc.index, remaining: q.remaining, limit: q.limit });
    if (q.remaining == null) {
      totalRemaining = null; // salah satu akun ga bisa dicek — jangan asal klaim abis
    } else if (totalRemaining != null) {
      totalRemaining += q.remaining;
    }
    if (q.limit) totalLimit += q.limit;
  }

  console.log(JSON.stringify({
    accounts: accs.length,
    totalRemaining,
    totalLimit,
    perAccount,
  }));
}

main().catch((e) => {
  console.error("quota-monitor error:", e?.message || e);
  process.exit(1);
});
