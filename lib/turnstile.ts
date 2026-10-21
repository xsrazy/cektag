// Verifikasi Cloudflare Turnstile (server-side). Fail-closed: kalau
// TURNSTILE_SECRET_KEY tidak diset, verifikasi GAGAL (captcha wajib).

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false; // tidak dikonfigurasi -> tolak (fail-closed)
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const j: any = await r.json();
    return j.success === true;
  } catch {
    return false;
  }
}
