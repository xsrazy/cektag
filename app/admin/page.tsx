"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // Turnstile anti brute-force
  const turnstileRef = useRef<HTMLDivElement>(null);
  const tsWidgetId = useRef<string | null>(null);
  const [tsToken, setTsToken] = useState<string | null>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return;
    const renderWidget = () => {
      const w = (window as any).turnstile;
      if (!w || !turnstileRef.current || tsWidgetId.current) return;
      tsWidgetId.current = w.render(turnstileRef.current, {
        sitekey: siteKey,
        callback: (t: string) => setTsToken(t),
        "expired-callback": () => setTsToken(null),
        "error-callback": () => setTsToken(null),
      });
    };
    if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      renderWidget();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = renderWidget;
    document.head.appendChild(s);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, turnstileToken: tsToken }),
      });
      const j = await r.json();
      if (j.ok) {
        router.push(window.location.pathname.replace(/\/?$/, "/dash"));
      } else {
        setErr(j.message || "Gagal login.");
      }
    } catch {
      setErr("Jaringan bermasalah.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="bg-mesh" />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <div className="glass fade-up p-8">
          <h1 className="text-xl font-extrabold text-white">
            Cek<span className="grad-text">Tag</span> Admin
          </h1>
          <p className="mt-1 text-sm text-white/50">Area terbatas. Masukkan password.</p>
          <form onSubmit={submit} className="mt-6">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password admin"
              className="input-glow w-full px-5 py-3.5"
              autoFocus
            />
            {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
            <div ref={turnstileRef} className="mt-4 flex justify-center" />
            <button type="submit" disabled={loading} className="btn-primary mt-4 w-full px-6 py-3.5 text-sm">
              {loading ? "Memeriksa..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
