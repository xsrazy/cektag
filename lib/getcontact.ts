// Klien API GetContact (unofficial) — round-robin 5 akun + failover.
// Protokol di-reverse-engineer dari klien publik (AES-ECB + HMAC-SHA256).

import { createCipheriv, createDecipheriv, createHash, createHmac } from "crypto";
import { store, todayKey, secsUntilMidnightWIB } from "./store";

const GTC_BASE = process.env.GTC_API_URL || "https://pbssrv-centralevents.com";
// Konstanta klien publik (bukan kredensial user) — dari hasil reverse-engineering.
const HMAC_KEY = "31426764382a642f3a6665497235466f3d236d5d785b722b4c657457442a495b494524324866782a2364292478587a78662d7a7b7578593f71703e2b7e365762";
const APP_VERSION = "8.4.0";
const ANDROID_OS = "android 9";

export interface GtcAccount {
  index: number; // 1..5
  token: string;
  finalKey: string;
  deviceId: string;
}

export class GtcError extends Error {
  code: string;
  constructor(code: string, msg: string) {
    super(msg);
    this.code = code;
  }
}

function aesAlg(keyHex: string): string {
  const len = Buffer.from(keyHex, "hex").length;
  if (len === 32) return "aes-256-ecb";
  if (len === 24) return "aes-192-ecb";
  return "aes-128-ecb";
}

function gtcEncrypt(plain: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const c = createCipheriv(aesAlg(keyHex), key, null);
  // autoPadding default true = PKCS7
  return Buffer.concat([c.update(plain, "utf8"), c.final()]).toString("base64");
}

function gtcDecrypt(b64: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const d = createDecipheriv(aesAlg(keyHex), key, null);
  return Buffer.concat([d.update(Buffer.from(b64, "base64")), d.final()]).toString("utf8");
}

function sign(ts: string, raw: string): string {
  const mac = createHmac("sha256", Buffer.from(HMAC_KEY, "hex"));
  mac.update(`${ts}-${raw}`, "utf8");
  return mac.digest("base64");
}

function deviceIdFor(token: string, index: number): string {
  // device ID asli dari registrasi (wajib — API mengikat token ke device ini).
  // fallback derivasi hanya untuk kompatibilitas lama.
  const env = process.env[`GTC_DEVICE_ID_${index}`];
  if (env) return env;
  return createHash("sha256").update("cektag$" + token).digest("hex").slice(0, 16);
}

export function getAccounts(): GtcAccount[] {
  const accs: GtcAccount[] = [];
  for (let i = 1; i <= 5; i++) {
    const token = process.env[`GTC_TOKEN_${i}`];
    const finalKey = process.env[`GTC_FINAL_KEY_${i}`];
    if (token && finalKey) {
      accs.push({ index: i, token, finalKey, deviceId: deviceIdFor(token, i) });
    }
  }
  return accs;
}

async function gtcCall(
  endpoint: string,
  payload: Record<string, unknown>,
  acc: GtcAccount,
  timeoutMs = 12000
): Promise<any> {
  const raw = JSON.stringify(payload);
  const ts = String(Date.now());
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-os": ANDROID_OS,
    "x-app-version": APP_VERSION,
    "x-client-device-id": acc.deviceId,
    "x-lang": "en_US",
    "x-req-timestamp": ts,
    "x-country-code": "id",
    "x-encrypted": "1",
    "x-req-signature": sign(ts, raw),
    "x-token": acc.token,
  };
  const body = JSON.stringify({ data: gtcEncrypt(raw, acc.finalKey) });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(GTC_BASE + endpoint, {
      method: "POST",
      headers,
      body,
      signal: ctrl.signal,
    });
    const parsed: any = await r.json();
    let data = parsed;
    if (parsed && typeof parsed.data === "string") {
      data = JSON.parse(gtcDecrypt(parsed.data, acc.finalKey));
    }
    return { http: r.status, data };
  } finally {
    clearTimeout(t);
  }
}

function dig(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

async function acctStatus(idx: number): Promise<string> {
  return (await store.get(`acct:${idx}:status`)) || "ok";
}
async function acctUsed(idx: number): Promise<number> {
  const v = await store.get(`acct:${idx}:used:${todayKey()}`);
  return v ? parseInt(v, 10) : 0;
}
async function markLimited(idx: number): Promise<void> {
  await store.set(`acct:${idx}:status`, "limited", secsUntilMidnightWIB());
}
async function markDead(idx: number): Promise<void> {
  await store.set(`acct:${idx}:status`, "dead", 24 * 3600);
}

export interface TagResult {
  tags: string[];
  account: number;
  deletedTagCount: number | null;
}

/** Cek tag 1 nomor. Round-robin + failover otomatis antar akun. */
export async function checkTags(phone: string): Promise<TagResult> {
  const accs = getAccounts();
  if (accs.length === 0) throw new GtcError("no_accounts", "Belum ada akun GetContact yang dikonfigurasi.");
  // catatan: batesan harian per akun dicabut per permintaan user (2026-10-16) —
  // kuota asli GetContact yang jadi patokan, dimonitor cron terpisah.

  const start = await store.incr("rr:counter", 86400);
  const order: GtcAccount[] = [];
  for (let k = 0; k < accs.length; k++) order.push(accs[(start + k) % accs.length]);

  let lastErr = "";
  for (const acc of order) {
    if ((await acctStatus(acc.index)) !== "ok") continue;
    try {
      const { http, data } = await gtcCall(
        "/v2.8/number-detail",
        { countryCode: "id", phoneNumber: phone, source: "profile", token: acc.token },
        acc
      );
      const metaCode = dig(data, "meta.httpStatusCode");
      if (http === 200 && metaCode === 200) {
        const tags = (dig(data, "result.tags") || [])
          .map((t: any) => (typeof t === "string" ? t : t.tag))
          .filter(Boolean);
        // jumlah tag yang dihapus pemilik nomer (kalau API ngasih field-nya)
        const delRaw =
          dig(data, "result.deletedTagCount") ??
          dig(data, "result.profile.deletedTagCount") ??
          dig(data, "result.tagDeletedCount") ??
          null;
        const deletedTagCount =
          typeof delRaw === "number" && delRaw >= 0 ? delRaw : null;
        await store.incr(`acct:${acc.index}:used:${todayKey()}`, 48 * 3600);
        return { tags, account: acc.index, deletedTagCount };
      }
      const errMsg = String(dig(data, "meta.errorMessage") || "");
      // "No result found" = GetContact tidak punya data untuk nomer ini.
      // Ini HASIL yang valid (bukan error): kembalikan tags kosong supaya UI
      // menampilkan panel "Ga ketemu tag-nya". Jangan markLimited/markDead —
      // akunnya sehat, cuma nomer ini yang ga ada datanya. (Insiden 17 Okt 2026:
      // nomer 085246913189 konsisten "No result found" di kedua akun, sementara
      // nomer lain normal — retry tidak akan pernah berhasil.)
      if (/no result found/i.test(errMsg)) {
        await store.incr(`acct:${acc.index}:used:${todayKey()}`, 48 * 3600);
        return { tags: [], account: acc.index, deletedTagCount: null };
      }
      if (http === 403 || /limit|quota|exceed|captcha/i.test(errMsg)) {
        await markLimited(acc.index);
        lastErr = `akun ${acc.index} kena limit`;
        continue;
      }
      if (http === 401 || /unauthor|invalid token/i.test(errMsg)) {
        await markDead(acc.index);
        lastErr = `akun ${acc.index} token bermasalah`;
        continue;
      }
      lastErr = `akun ${acc.index}: ${errMsg || "error " + http}`;
    } catch (e: any) {
      lastErr = `akun ${acc.index}: ${e?.name === "AbortError" ? "timeout" : "jaringan error"}`;
      continue;
    }
  }
  throw new GtcError("all_failed", lastErr || "Semua akun gagal / kuota habis.");
}

/** Sisa kuota 1 akun — TIDAK memakan jatah cek. Untuk admin & health check. */
export async function accountQuota(acc: GtcAccount): Promise<{ remaining: number | null; limit: number | null; renew: string | null }> {
  try {
    const { http, data } = await gtcCall("/v2.8/subscription", { token: acc.token }, acc, 10000);
    if (http !== 200) return { remaining: null, limit: null, renew: null };
    const usage = dig(data, "result.subscriptionInfo.usage.numberDetail") || {};
    return {
      remaining: usage.remainingCount ?? null,
      limit: usage.limit ?? null,
      renew: dig(data, "result.subscriptionInfo.renewDate") || null,
    };
  } catch {
    return { remaining: null, limit: null, renew: null };
  }
}

export async function accountOverview(): Promise<
  { index: number; status: string; usedToday: number; quota: { remaining: number | null; limit: number | null; renew: string | null } }[]
> {
  const accs = getAccounts();
  const out = [];
  for (const acc of accs) {
    out.push({
      index: acc.index,
      status: await acctStatus(acc.index),
      usedToday: await acctUsed(acc.index),
      quota: await accountQuota(acc),
    });
  }
  return out;
}
