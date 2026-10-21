// Auth admin: cookie httpOnly berisi token random yang disimpan di store (24 jam).

import { randomBytes, timingSafeEqual } from "crypto";
import { compare } from "bcryptjs";
import { store } from "./store";

const COOKIE = "ct_admin";
const TTL = 24 * 3600;

export async function verifyPassword(pw: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH || "";
  if (!hash || !pw) return false;
  try {
    return await compare(pw, hash);
  } catch {
    return false;
  }
}

export async function createSession(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await store.set(`adminsess:${token}`, "1", TTL);
  return token;
}

export async function checkSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const v = await store.get(`adminsess:${token}`);
  // bandingkan aman walau sederhana (token random 256-bit)
  return v === "1";
}

export async function destroySession(token: string): Promise<void> {
  await store.del(`adminsess:${token}`);
}

export function adminCookieHeader(token: string): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL}; Secure`;
}
export function clearCookieHeader(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}
export const ADMIN_COOKIE = COOKIE;

// constant-time string compare helper (dipakai di tempat lain bila perlu)
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
