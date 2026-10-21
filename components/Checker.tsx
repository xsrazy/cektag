"use client";

import { useEffect, useRef, useState } from "react";
import { getFingerprint } from "../lib/fingerprint";
import { CHECK_PRICE, fmtRp } from "../lib/pricing";
import { HashIcon, SearchIcon, CopyIcon, CheckIcon } from "./icons";
import { Logo } from "./SiteChrome";

interface CheckResult {
  tags: string[];
  account?: number;
  demo?: boolean;
  test?: boolean;
  deletedTagCount?: number | null;
}

interface PayOrder {
  orderId: string;
  amount: number;
  amountToPay: number;
  uniqueCode: number;
  qrUrl: string | null;
  paymentUrl: string | null;
  expiresAt: string | null;
}

export default function Checker() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [order, setOrder] = useState<PayOrder | null>(null);
  // order yang sudah PAID tapi lookup-nya gagal — disimpan biar user bisa "Coba lagi" tanpa bayar ulang
  const [paidOrder, setPaidOrder] = useState<{ orderId: string; phone: string } | null>(null);
  // order LUNAS dari pembayaran sebelumnya yang belum dipakai (anti bayar 2x —
  // insiden 17 Okt 2026: user bayar 2x karena halaman ke-reload pas webhook datang)
  const [existingPaid, setExistingPaid] = useState<{ orderId: string; amountToPay: number; phone: string } | null>(null);
  // kalau true, /api/order dipaksa bikin invoice baru (lewati tawaran pakai pembayaran lama)
  const forceNewRef = useRef(false);
  // nomer yang hasil ceknya lagi tampil (dipisah dari input biar "Salin hasil" ga salah kalau user ngedit kolom)
  const [resultPhone, setResultPhone] = useState("");
  // jam sekarang (untuk countdown QR)
  const [nowTs, setNowTs] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);
  const loadTime = useRef(Date.now());
  const honeypot = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // orderId yang lookup-nya sudah dimulai — cegah dobel runCheck kalau poll tumpang tindih
  const checkStartedRef = useRef<string | null>(null);
  // Cloudflare Turnstile anti-spam
  const turnstileRef = useRef<HTMLDivElement>(null);
  const tsWidgetId = useRef<string | null>(null);
  const [tsToken, setTsToken] = useState<string | null>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return; // tidak dikonfigurasi -> lewati captcha
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

  function resetTurnstile() {
    setTsToken(null);
    try {
      const w = (window as any).turnstile;
      if (w && tsWidgetId.current) w.reset(tsWidgetId.current);
    } catch { /* abaikan */ }
  }

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("ct_history") || "[]");
      if (Array.isArray(h)) setHistory(h.slice(0, 10));
    } catch { /* abaikan */ }
    // mode test dari admin: link ?testOrder=CT-TEST-xxx&phone=628xx →
    // langsung jalanin cek pakai order test (tanpa bayar). URL dibersihkan
    // biar ga ke-trigger lagi pas reload.
    try {
      const q = new URLSearchParams(window.location.search);
      const tOrder = (q.get("testOrder") || "").slice(0, 64);
      const tPhone = (q.get("phone") || "").slice(0, 20);
      if (tOrder && tPhone) {
        window.history.replaceState(null, "", window.location.pathname);
        setPhone(tPhone);
        checkStartedRef.current = null;
        setPaidOrder({ orderId: tOrder, phone: tPhone });
        runCheck(tPhone, tOrder).then((ok) => { if (ok) setPaidOrder(null); });
      }
    } catch { /* abaikan */ }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function saveHistory(p: string) {
    try {
      const h = [p, ...history.filter((x) => x !== p)].slice(0, 10);
      setHistory(h);
      localStorage.setItem("ct_history", JSON.stringify(h));
    } catch { /* abaikan */ }
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // countdown QR: tick tiap detik selama panel order tampil
  useEffect(() => {
    if (!order || !order.expiresAt) return;
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order]);

  function fmtCountdown(iso: string | null): string {
    if (!iso || !nowTs) return "";
    const remain = Math.max(0, Math.floor((new Date(iso).getTime() - nowTs) / 1000));
    if (remain <= 0) return "QR kedaluwarsa";
    return `QR berlaku ${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, "0")}`;
  }

  async function runCheck(rawPhone: string, orderId?: string): Promise<boolean> {
    setLoading(true);
    setError("");
    setErrorCode("");
    setResult(null);
    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: rawPhone, fingerprint: getFingerprint(), orderId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.message || "Gagal mengecek. Coba lagi.");
        setErrorCode(j.code || "");
        return false;
      }
      setResult(j);
      setResultPhone(rawPhone);
      saveHistory(rawPhone);
      setReported(false);
      setCopied(false);
      return true;
    } catch {
      setError("Jaringan bermasalah. Coba lagi.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  // coba lagi pakai orderId yang sama (udah dibayar, jangan suruh bayar ulang)
  async function retryPaidCheck() {
    if (!paidOrder || loading) return;
    const ok = await runCheck(paidOrder.phone, paidOrder.orderId);
    if (ok) {
      setOrder(null);
      setPaidOrder(null);
    }
  }

  // order-nya udah USED (kepake) — retry ga akan pernah mempan.
  // buang order mati, balikin form ke awal biar user bikin pembayaran baru.
  function newPaymentAfterUsed() {
    setPaidOrder(null);
    setExistingPaid(null);
    setOrder(null);
    setError("");
    setErrorCode("");
    checkStartedRef.current = null;
    resetTurnstile();
  }

  async function pollOrderStatus(orderId: string, rawPhone: string) {
    // poll lain sudah memicu lookup buat order ini — jangan dobel
    if (checkStartedRef.current === orderId) return;
    try {
      const r = await fetch("/api/order/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const j = await r.json();
      if (j.status === "PAID") {
        // kunci sinkron SEBELUM await berikutnya: poll yang tumpang tindih bakal kepentok di cek atas
        checkStartedRef.current = orderId;
        stopPolling();
        // simpan orderId-nya dulu; setOrder(null) HANYA kalau lookup sukses
        setPaidOrder({ orderId, phone: rawPhone });
        const ok = await runCheck(rawPhone, orderId);
        if (ok) {
          setOrder(null);
          setPaidOrder(null);
        }
      } else if (j.status === "EXPIRED" || r.status === 404) {
        stopPolling();
        setOrder(null);
        setError("Pesanan kedaluwarsa. Bikin pesanan baru ya.");
      }
    } catch { /* abaikan, poll berikutnya */ }
  }

  async function createOrder(rawPhone: string) {
    setCreatingOrder(true);
    setError("");
    checkStartedRef.current = null; // order baru, kunci direset
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: rawPhone, turnstileToken: tsToken, forceNew: forceNewRef.current }),
      });
      const j = await r.json();
      forceNewRef.current = false;
      if (!r.ok) {
        setError(j.message || "Gagal membuat order pembayaran.");
        return;
      }
      if (j.demo) { runCheck(rawPhone); return; }
      // nomer ini udah pernah dibayar lunas dan belum dipakai — tawarin pakai itu dulu
      if (j.alreadyPaid) {
        setExistingPaid({ orderId: j.orderId, amountToPay: j.amountToPay ?? 0, phone: rawPhone });
        setError("");
        return;
      }
      const ord: PayOrder = {
        orderId: j.orderId,
        amount: j.amount,
        amountToPay: j.amountToPay ?? j.amount,
        uniqueCode: j.uniqueCode ?? 0,
        qrUrl: j.qrUrl,
        paymentUrl: j.paymentUrl,
        expiresAt: j.expiresAt ?? null,
      };
      setOrder(ord);
      setPaidOrder(null);
      stopPolling();
      pollRef.current = setInterval(() => pollOrderStatus(ord.orderId, rawPhone), 3000);
    } catch {
      setError("Jaringan bermasalah. Coba lagi.");
    } finally {
      resetTurnstile(); // token sekali pakai — reset biar klik berikutnya verifikasi ulang
      setCreatingOrder(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rawPhone = phone.trim();
    if (!rawPhone) { setError("Masukin nomer HP dulu."); return; }
    if (honeypot.current?.value) return; // bot ketangkap honeypot
    if (Date.now() - loadTime.current < 1200) {
      setError("Tunggu sebentar, lalu coba lagi.");
      return;
    }
    setError("");
    setErrorCode("");
    setResult(null);
    setPaidOrder(null);
    // nomer demo: preview gratis, langsung tampil
    const digits = rawPhone.replace(/\D/g, "");
    if (digits === "081200000000" || digits === "6281200000000" ||
        digits === "081200000001" || digits === "6281200000001") {
      runCheck(rawPhone);
      return;
    }
    // nomer demo buat preview pesan kuota abis
    if (digits === "081200000002" || digits === "6281200000002") {
      setError("Duh, lagi rame banget yang ngecek nih.\nCoba lagi nanti aja, ya!");
      return;
    }
    // captcha wajib sebelum bikin invoice (anti spam klik Cek)
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !tsToken) {
      setError("Selesaikan captcha dulu ya.");
      return;
    }
    createOrder(rawPhone);
  }

  function cancelOrder() {
    stopPolling();
    setOrder(null);
    setPaidOrder(null);
    setExistingPaid(null);
    checkStartedRef.current = null;
    resetTurnstile();
  }

  // pakai pembayaran lunas sebelumnya (tanpa bayar lagi)
  async function useExistingPaid() {
    if (!existingPaid || loading) return;
    const { orderId, phone: p } = existingPaid;
    setExistingPaid(null);
    checkStartedRef.current = null;
    setPaidOrder({ orderId, phone: p });
    const ok = await runCheck(p, orderId);
    if (ok) setPaidOrder(null);
  }

  // tolak tawaran, bikin order/invoice baru (captcha harus diselesaikan ulang)
  function newOrderInstead() {
    forceNewRef.current = true;
    setExistingPaid(null);
    setError("Oke, selesaikan captcha lagi terus klik Cek buat bikin pembayaran baru.");
  }

  function copyResult() {
    if (!result) return;
    const text = `Tag GetContact untuk ${resultPhone || phone.trim()}:\n` + result.tags.map((t, i) => `${i + 1}. ${t}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  async function reportWrong() {
    if (!result) return;
    const digits = (resultPhone || phone).replace(/\D/g, "");
    const isDemo = digits === "081200000000" || digits === "6281200000000" ||
      digits === "081200000001" || digits === "6281200000001";
    // nomer demo: tampilkan ucapan terima kasih aja, jangan kirim ke admin
    if (isDemo) {
      setReported(true);
      return;
    }
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), type: "salah" }),
      });
      setReported(true);
    } catch { /* abaikan */ }
  }

  const busy = loading || creatingOrder;

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className="glass fade-up fade-up-2 p-5 sm:p-7">
        {/* honeypot anti-bot */}
        <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off"
          style={{ position: "absolute", left: "-9999px", opacity: 0 }} aria-hidden="true" />
        <label htmlFor="phone" className="mb-2.5 block px-5 text-left text-sm font-semibold text-white/70">
          Masukin nomernya di sini!
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="cth: 0812-3456-7890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-glow flex-1 px-5 py-4 text-left text-lg font-semibold tracking-wide"
            disabled={busy || !!order}
          />
          <button type="submit" disabled={busy || !!order} className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 text-base sm:w-auto">
            <SearchIcon size={17} />
            {creatingOrder ? "Bikin QR..." : loading ? "Ngecek..." : "Cek Tag"}
          </button>
        </div>
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
          <div className="mt-4 flex justify-center">
            <div ref={turnstileRef} />
          </div>
        ) : null}

        <div className="mt-3.5 text-center text-[13px]">
          <button
            type="button"
            onClick={() => { stopPolling(); setPhone("081200000000"); setError(""); setResult(null); setOrder(null); setPaidOrder(null); setExistingPaid(null); }}
            className="text-white/45 underline decoration-dotted underline-offset-2 hover:text-white/75"
          >
            coba contoh gratis
          </button>
        </div>
      </form>

      {error && (
        <div className="fade-up mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-4 text-center text-sm font-medium whitespace-pre-line text-red-200 sm:whitespace-nowrap">
          <p>{error}</p>
          {paidOrder && errorCode !== "order_used" && (
            <button
              type="button"
              onClick={retryPaidCheck}
              disabled={loading}
              className="btn-primary mt-3 px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? "Ngecek..." : "Coba lagi (tanpa bayar ulang)"}
            </button>
          )}
          {paidOrder && errorCode === "order_used" && (
            <button
              type="button"
              onClick={newPaymentAfterUsed}
              disabled={loading}
              className="btn-primary mt-3 px-5 py-2.5 text-sm disabled:opacity-50"
            >
              Bikin pembayaran baru
            </button>
          )}
        </div>
      )}

      {existingPaid && !order && (
        <div className="glass fade-up mt-6 p-5 text-center sm:p-7">
          <h2 className="text-lg font-extrabold text-white">Udah pernah bayar, nih!</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
            Nomer <span className="font-bold text-white/85">{existingPaid.phone}</span> udah
            dibayar <span className="font-bold text-white/85">{fmtRp(existingPaid.amountToPay)}</span> dan
            pembayarannya masih berlaku, belum dipakai. Pakai aja, ga usah bayar lagi.
          </p>
          <p className="mt-1.5 text-[12px] text-white/35">ID Pesanan: {existingPaid.orderId}</p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={useExistingPaid}
              disabled={loading}
              className="btn-primary px-6 py-3 text-sm disabled:opacity-50"
            >
              {loading ? "Ngecek..." : "Pakai pembayaran ini"}
            </button>
            <button
              type="button"
              onClick={newOrderInstead}
              className="btn-ghost px-6 py-3 text-sm text-white/70"
            >
              Bikin pembayaran baru
            </button>
          </div>
        </div>
      )}

      {order && !result && (
        <div className="glass fade-up mt-6 p-5 text-center sm:p-7">
          <h2 className="text-lg font-extrabold text-white">
            Scan QR buat ngecek:
            <span className="grad-text mt-0.5 block text-xl">{phone.trim()}</span>
          </h2>
          <p className="mt-1.5 text-sm text-white/50">
            Bayar <span className="font-bold text-white/85">{fmtRp(order.amountToPay)}</span> untuk 1x pengecekan
          </p>
          {order.uniqueCode > 0 && (
            <p className="mt-1 text-[12px] text-white/35">
              Termasuk kode unik Rp {order.uniqueCode.toLocaleString("id-ID")} biar pembayaranmu ke-deteksi otomatis. Bayar pas ya, jangan dibuletin.
            </p>
          )}
          {order.qrUrl ? (
            <div className="mx-auto mt-5 w-fit">
              <div className="relative">
                <img
                  src={order.qrUrl}
                  alt="QRIS pembayaran"
                  className="h-56 w-56 rounded-2xl border border-white/10 bg-white p-3"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-2xl bg-white p-1.5 shadow-lg">
                    <Logo size={44} />
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-sm font-extrabold tracking-wide text-white/85">
                CekTag <span className="font-medium text-white/40">| www.cektag.web.id</span>
              </p>
            </div>
          ) : order.paymentUrl ? (
            <a
              href={order.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-5 inline-block px-6 py-3.5 text-sm"
            >
              Buka halaman pembayaran
            </a>
          ) : null}
          <div className="mt-5 flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-2.5 text-sm text-white/55">
              <div className="spinner spinner-sm" />
              <span className="font-semibold text-white/80">Menunggu Pembayaran</span>
            </div>
            <p className="text-[12px] text-white/40">otomatis lanjut kalau udah dibayar</p>
          </div>
          <p className="mt-2 text-[12px] text-white/35">ID Pesanan: {order.orderId}</p>
          {order.expiresAt && (
            <p className="mt-1 text-[12px] font-semibold text-amber-200/70">{fmtCountdown(order.expiresAt)}</p>
          )}
          <button
            type="button"
            onClick={cancelOrder}
            className="btn-ghost mt-4 w-full px-4 py-2.5 text-sm text-white/70"
          >
            Batal
          </button>
        </div>
      )}

      {loading && (
        <div className="glass fade-up mt-6 flex flex-col items-center gap-4 p-10">
          <div className="spinner" />
          <p className="text-sm text-white/60">Lagi ngecek ke GetContact, bentar ya...</p>
        </div>
      )}

      {result && !loading && (
        <div className="glass fade-up mt-6 p-5 sm:p-7">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-white">
              Hasil untuk <span className="grad-text">{resultPhone || phone.trim()}</span>
            </h2>
            {result.demo ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                contoh
              </span>
            ) : result.test ? (
              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-bold tracking-wider text-sky-300">
                Admin
              </span>
            ) : (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                real-time
              </span>
            )}
          </div>
          {result.tags.length > 0 ? (
            <>
              <p className="mb-5 text-sm text-white/50">
                {`Ketemu ${result.tags.length} tag. Gini orang-orang nyimpen nomer ini di kontak mereka:`}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {result.tags.map((t, i) => (
                  <span key={i} className="chip" style={{ animationDelay: `${Math.min(i * 0.05, 0.8)}s` }}>
                    <HashIcon size={13} className="shrink-0 text-fuchsia-300/90" />
                    {t}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="mb-5">
              <h3 className="grad-text text-base font-extrabold">Ga ketemu tag-nya</h3>
              <p className="mt-1 text-sm text-white/50">Nomer ini belum punya tag di GetContact.</p>
              <div className="mt-4 space-y-2.5">
                <div className="reason-card">
                  <p className="text-sm font-bold text-[#e0e7ff]">Nomer baru kayaknya</p>
                  <p className="mt-0.5 text-[13px] text-white/55">Belum ada jejak nomer ini di GetContact</p>
                </div>
                <div className="reason-card">
                  <p className="text-sm font-bold text-[#e0e7ff]">Privasi terlindungi</p>
                  <p className="mt-0.5 text-[13px] text-white/55">Pemiliknya mungkin nyembunyiin profil GetContact-nya</p>
                </div>
              </div>
              <p className="mt-3 text-[13px] text-white/40">Pencarian tetap anonim, pemilik nomer ga bakal tau nomernya dicari.</p>
            </div>
          )}
          {typeof result.deletedTagCount === "number" && result.deletedTagCount > 0 && (
            <p className="mt-4 text-[13px] text-white/40">
              {result.deletedTagCount} tag udah dihapus pemilik nomer ini, jadi ga keliatan di atas.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2.5 border-t border-white/[0.07] pt-5">
            <button onClick={copyResult} className="btn-ghost inline-flex items-center gap-2 px-4 py-2.5 text-sm text-white/85">
              {copied ? <><CheckIcon size={14} className="text-emerald-300" /> Tersalin!</> : <><CopyIcon size={14} /> Salin hasil</>}
            </button>
            <button
              onClick={() => { setResult(null); setPhone(""); setOrder(null); setPaidOrder(null); }}
              className="btn-ghost px-4 py-2.5 text-sm text-white/85"
            >
              Cek nomer lain
            </button>
            <button
              onClick={reportWrong}
              disabled={reported}
              className="ml-auto px-3 py-2.5 text-[13px] text-white/35 hover:text-white/70 disabled:opacity-60"
            >
              {reported ? "Makasih laporannya!" : "Hasilnya salah? Laporkan"}
            </button>
          </div>
        </div>
      )}

      {history.length > 0 && !loading && (
        <div className="mt-6">
          <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-white/35">
            Terakhir dicek di perangkat ini
          </p>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => (
              <button
                key={h}
                onClick={() => { stopPolling(); setPhone(h); setResult(null); setError(""); setOrder(null); setPaidOrder(null); }}
                className="btn-ghost px-3.5 py-2 text-[13px] text-white/70"
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
