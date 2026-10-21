// Storage abstraction: Upstash Redis kalau env tersedia,
// fallback ke in-memory (per-instance) kalau tidak.

type ZEntry = { member: string; score: number };

class MemoryStore {
  private kv = new Map<string, { v: string; exp: number }>();
  private lists = new Map<string, string[]>();
  private zsets = new Map<string, Map<string, number>>();
  private sets = new Map<string, Set<string>>();

  private alive(key: string): boolean {
    const e = this.kv.get(key);
    if (!e) return false;
    if (e.exp && Date.now() > e.exp) { this.kv.delete(key); return false; }
    return true;
  }

  async incr(key: string, ttlSec: number): Promise<number> {
    // samakan dengan Redis: TTL hanya di-set sekali saat key dibuat (fixed window),
    // bukan di-refresh tiap panggil
    const e = this.kv.get(key);
    const expired = e && e.exp !== 0 && Date.now() > e.exp;
    const isNew = !e || expired;
    const cur = isNew ? 0 : parseInt(e!.v || "0", 10);
    const next = cur + 1;
    const exp = isNew ? Date.now() + ttlSec * 1000 : e!.exp;
    if (expired) this.kv.delete(key);
    this.kv.set(key, { v: String(next), exp });
    return next;
  }
  async get(key: string): Promise<string | null> {
    return this.alive(key) ? this.kv.get(key)!.v : null;
  }
  async set(key: string, v: string, ttlSec?: number): Promise<void> {
    this.kv.set(key, { v, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
  }
  async del(key: string): Promise<void> { this.kv.delete(key); }
  async lpush(key: string, v: string): Promise<void> {
    const l = this.lists.get(key) || [];
    l.unshift(v);
    this.lists.set(key, l);
  }
  async ltrim(key: string, max: number): Promise<void> {
    const l = this.lists.get(key) || [];
    this.lists.set(key, l.slice(0, max));
  }
  async lrange(key: string, n: number): Promise<string[]> {
    return (this.lists.get(key) || []).slice(0, n);
  }
  async zincrby(key: string, member: string): Promise<void> {
    const z = this.zsets.get(key) || new Map<string, number>();
    z.set(member, (z.get(member) || 0) + 1);
    this.zsets.set(key, z);
  }
  async zrevrange(key: string, n: number): Promise<ZEntry[]> {
    const z = this.zsets.get(key) || new Map<string, number>();
    return [...z.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([member, score]) => ({ member, score }));
  }
  async sadd(key: string, member: string): Promise<void> {
    const s = this.sets.get(key) || new Set<string>();
    s.add(member);
    this.sets.set(key, s);
  }
  async srem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member);
  }
  async scard(key: string): Promise<number> {
    return (this.sets.get(key) || new Set()).size;
  }
  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) || new Set())];
  }
}

let redis: any = null;
let mem: MemoryStore | null = null;

async function getRedis(): Promise<any | null> {
  if (redis) return redis;
  // Nama env dari integrasi Upstash di Vercel marketplace:
  // UPSTASH_REDIS_REST_KV_REST_API_URL + UPSTASH_REDIS_REST_KV_REST_API_TOKEN
  // (fallback ke nama generik UPSTASH_REDIS_REST_URL/TOKEN kalau diset manual)
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    // automaticDeserialization:false -> string in, string out (sama kayak MemoryStore).
    // Kalau true (default), "1" dibaca balik jadi number 1 dan checkSession (v === "1") selalu gagal.
    redis = new Redis({ url, token, automaticDeserialization: false });
    return redis;
  } catch {
    return null;
  }
}

function getMem(): MemoryStore {
  if (!mem) {
    mem = new MemoryStore();
    console.warn("[cektag] UPSTASH env missing — using in-memory store (not shared across instances)");
  }
  return mem;
}

export const store = {
  async incr(key: string, ttlSec: number): Promise<number> {
    const r = await getRedis();
    if (r) {
      const n: number = await r.incr(key);
      if (n === 1) await r.expire(key, ttlSec);
      return n;
    }
    return getMem().incr(key, ttlSec);
  },
  async get(key: string): Promise<string | null> {
    const r = await getRedis();
    if (r) return (await r.get(key)) as string | null;
    return getMem().get(key);
  },
  async set(key: string, v: string, ttlSec?: number): Promise<void> {
    const r = await getRedis();
    if (r) {
      if (ttlSec) await r.set(key, v, { ex: ttlSec });
      else await r.set(key, v);
      return;
    }
    return getMem().set(key, v, ttlSec);
  },
  async del(key: string): Promise<void> {
    const r = await getRedis();
    if (r) { await r.del(key); return; }
    return getMem().del(key);
  },
  async lpush(key: string, v: string): Promise<void> {
    const r = await getRedis();
    if (r) { await r.lpush(key, v); return; }
    return getMem().lpush(key, v);
  },
  async ltrim(key: string, max: number): Promise<void> {
    const r = await getRedis();
    if (r) { await r.ltrim(key, 0, max - 1); return; }
    return getMem().ltrim(key, max);
  },
  async lrange(key: string, n: number): Promise<string[]> {
    const r = await getRedis();
    if (r) return (await r.lrange(key, 0, n - 1)) as string[];
    return getMem().lrange(key, n);
  },
  async zincrby(key: string, member: string): Promise<void> {
    const r = await getRedis();
    if (r) { await r.zincrby(key, 1, member); return; }
    return getMem().zincrby(key, member);
  },
  async zrevrange(key: string, n: number): Promise<ZEntry[]> {
    const r = await getRedis();
    if (r) {
      const res = (await r.zrange(key, 0, n - 1, { rev: true, withScores: true })) as (string | number)[];
      const out: ZEntry[] = [];
      for (let i = 0; i < res.length; i += 2) out.push({ member: String(res[i]), score: Number(res[i + 1]) });
      return out;
    }
    return getMem().zrevrange(key, n);
  },
  async sadd(key: string, member: string): Promise<void> {
    const r = await getRedis();
    if (r) { await r.sadd(key, member); return; }
    return getMem().sadd(key, member);
  },
  async srem(key: string, member: string): Promise<void> {
    const r = await getRedis();
    if (r) { await r.srem(key, member); return; }
    return getMem().srem(key, member);
  },
  async scard(key: string): Promise<number> {
    const r = await getRedis();
    if (r) return (await r.scard(key)) as number;
    return getMem().scard(key);
  },
  async smembers(key: string): Promise<string[]> {
    const r = await getRedis();
    if (r) return (await r.smembers(key)) as string[];
    return getMem().smembers(key);
  },
};

export async function storageBackend(): Promise<"redis" | "memory"> {
  return (await getRedis()) ? "redis" : "memory";
}

export function secsUntilMidnightWIB(): number {
  const now = new Date();
  const wib = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
  const midnight = new Date(wib);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((midnight.getTime() - wib.getTime()) / 1000));
}

export function todayKey(): string {
  const now = new Date(Date.now() + (7 * 60 + new Date().getTimezoneOffset()) * 60000);
  return now.toISOString().slice(0, 10);
}

// kunci bulan WIB: "2026-10"
export function monthKey(): string {
  const now = new Date(Date.now() + (7 * 60 + new Date().getTimezoneOffset()) * 60000);
  return now.toISOString().slice(0, 7);
}

// detik sampai akhir bulan WIB
export function secsUntilMonthEndWIB(): number {
  const now = new Date();
  const wib = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
  const end = new Date(wib.getFullYear(), wib.getMonth() + 1, 1, 0, 0, 0, 0);
  return Math.max(60, Math.floor((end.getTime() - wib.getTime()) / 1000));
}

/** true kalau pakai in-memory store (env Upstash tidak diset). */
export function usingMemoryStore(): boolean {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  return !url || !token;
}
