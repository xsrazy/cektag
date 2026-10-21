import { store, todayKey } from "./store";

// Default konservatif selaras kuota asli GetContact (40 numberDetail/bulan):
// - GLOBAL_API_CAP: max 5 hit API per hari
// - DAILY_LIMIT_PER_ACCOUNT (lib/getcontact.ts): max 3 hit per akun per hari
// Bisa dinaikkan via env GLOBAL_API_CAP / DAILY_LIMIT_PER_ACCOUNT kalau kuota nambah.
const GLOBAL_API_CAP = parseInt(process.env.GLOBAL_API_CAP || "5", 10);

/** Tameng terakhir: batasi total hit API per hari apapun yang terjadi. */
export async function apiCapReached(): Promise<boolean> {
  const used = parseInt((await store.get(`apihits:${todayKey()}`)) || "0", 10);
  return used >= GLOBAL_API_CAP;
}
export async function consumeApiHit(): Promise<void> {
  await store.incr(`apihits:${todayKey()}`, 48 * 3600);
}
