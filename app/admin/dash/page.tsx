"use client";

import { useEffect, useState } from "react";

interface Account {
  index: number;
  status: string;
  usedToday: number;
  quota: { remaining: number | null; limit: number | null; renew: string | null };
}
interface Data {
  day: string;
  checks: number;
  apiHits: number;
  accounts: Account[];
  top: { member: string; score: number }[];
  logs: any[];
  reports: any[];
  flagged: { phone: string; info: any }[];
  frozenCount: number;
  frozen: string[];
  orders?: any[];
}

// format ISO timestamp ke WIB (GMT+7)
function wib(iso?: string, withSec = false): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSec ? { second: "2-digit" } : {}),
    hour12: false,
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}-${p("month")} ${p("hour")}:${p("minute")}${withSec ? ":" + p("second") : ""}`;
}

export default function AdminDash() {
  const [data, setData] = useState<Data | null>(null);  const [err, setErr] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState<number | null>(null);
  // mode test: link order test yang baru dibuat (tanpa bayar)
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [creatingTest, setCreatingTest] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/admin/data");
      const j = await r.json();
      if (!r.ok || !j.ok) {
        if (r.status === 401) {
          window.location.href = window.location.pathname.replace(/\/dash\/?$/, "");
          return;
        }
        setErr("Gagal memuat data.");
        return;
      }
      setData(j);
    } catch {
      setErr("Jaringan bermasalah.");
    }
  }

  useEffect(() => { load(); }, []);

  // tiap ada notif, scroll ke atas di mobile biar notifnya kelihatan
  useEffect(() => {
    if (msg && window.matchMedia("(max-width: 640px)").matches) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [msg]);

  async function testAccount(idx: number) {
    setTesting(idx);
    try {
      const r = await fetch("/api/admin/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: idx }),
      });
      const j = await r.json();
      setMsg(j.ok ? (j.alive ? `Akun ${idx}: TERHUBUNG (sisa ${j.quota.remaining ?? "?"}/${j.quota.limit ?? "?"})` : `Akun ${idx}: TIDAK MERESPON`) : "Gagal tes.");
    } catch { setMsg("Gagal tes."); }
    finally { setTesting(null); }
  }

  async function action(act: string) {
    if (!phone.trim()) { setMsg("Isi nomor dulu."); return; }
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, phone: phone.trim() }),
      });
      const j = await r.json();
      setMsg(j.message || (j.ok ? "OK" : "Gagal"));
      if (j.ok) { setPhone(""); load(); }
    } catch { setMsg("Gagal."); }
  }

  async function unfreezePhone(pn: string) {
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unfreeze", phone: pn }),
      });
      const j = await r.json();
      setMsg(j.message || (j.ok ? "OK" : "Gagal"));
      if (j.ok) load();
    } catch { setMsg("Gagal."); }
  }

  // Mode test: bikin order LUNAS tanpa bayar buat nomer di input, khusus ngetes.
  // Hanya bisa dibuat dari admin yang login; hasilnya dibuka lewat link khusus.
  async function createTestOrder() {
    if (!phone.trim()) { setMsg("Isi nomor dulu."); return; }
    setCreatingTest(true);
    setTestUrl(null);
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_test_order", phone: phone.trim() }),
      });
      const j = await r.json();
      if (j.ok && j.testUrl) {
        setTestUrl(j.testUrl);
        setMsg(`Order test ${j.orderId} dibuat.`);
        load();
      } else {
        setMsg(j.message || "Gagal bikin order test.");
      }
    } catch { setMsg("Gagal."); }
    finally { setCreatingTest(false); }
  }

  async function delReport(idx: number) {
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "del_report", index: idx }),
      });
      const j = await r.json();
      setMsg(j.message || (j.ok ? "OK" : "Gagal"));
      if (j.ok) load();
    } catch { setMsg("Gagal."); }
  }

  async function delOrder(idx: number) {
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "del_order", index: idx }),
      });
      const j = await r.json();
      setMsg(j.message || (j.ok ? "OK" : "Gagal"));
      if (j.ok) load();
    } catch { setMsg("Gagal."); }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (err) return <div className="p-10 text-center text-red-300">{err}</div>;
  if (!data) return <div className="p-10 text-center text-white/50">Memuat dashboard...</div>;

  return (
    <div>
      <div className="bg-mesh" />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Dashboard <span className="grad-text">CekTag</span></h1>
            <p className="text-sm text-white/45">{data.day} • refresh otomatis tiap buka halaman</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="btn-ghost px-4 py-2 text-sm text-white/80">Refresh</button>
            <button onClick={logout} className="btn-ghost px-4 py-2 text-sm text-white/80">Keluar</button>
          </div>
        </div>

        {msg && (
          <div className="mb-6 rounded-2xl border border-indigo-400/25 bg-indigo-500/10 px-5 py-3.5 text-sm text-indigo-200">
            {msg}
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Cek hari ini", data.checks],
            ["Akun aktif", data.accounts.filter((a) => a.status === "ok").length + "/" + data.accounts.length],
            ["Nomor di-flag", data.flagged.length],
            ["Nomer di-freeze", data.frozenCount ?? 0],
          ].map(([label, val], i) => (
            <div key={i} className="glass p-5">
              <div className="stat-num">{String(val)}</div>
              <div className="mt-1 text-[13px] text-white/50">{label}</div>
            </div>
          ))}
        </div>

        {/* ACCOUNTS */}
        <h2 className="mb-4 mt-10 text-lg font-bold text-white">Akun GetContact</h2>
        <div className="glass overflow-x-auto p-2">
          <table className="admin-table">
            <thead>
              <tr><th>Akun</th><th>Status</th><th>Terpakai hari ini</th><th>Sisa kuota (API)</th><th>Renew</th><th></th></tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.index}>
                  <td className="font-bold text-white">#{a.index}</td>
                  <td><span className={`status-${a.status}`}>{a.status.toUpperCase()}</span></td>
                  <td className="text-white/75">{a.usedToday}</td>
                  <td className="text-white/75">{a.quota.remaining ?? "?"} / {a.quota.limit ?? "?"}</td>
                  <td className="text-white/50 text-xs">{a.quota.renew || "-"}</td>
                  <td>
                    <button
                      onClick={() => testAccount(a.index)}
                      disabled={testing === a.index}
                      className="btn-ghost px-3 py-1.5 text-xs text-white/80"
                    >
                      {testing === a.index ? "..." : "Tes koneksi"}
                    </button>
                  </td>
                </tr>
              ))}
              {data.accounts.length === 0 && (
                <tr><td colSpan={6} className="text-center text-white/45">
                  Belum ada akun dikonfigurasi. Isi GTC_TOKEN_1..5 + GTC_FINAL_KEY_1..5 di env Vercel.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* TOP NUMBERS */}
          <div>
            <h2 className="mb-4 text-lg font-bold text-white">Nomor paling sering dicek</h2>
            <div className="glass p-2">
              <table className="admin-table">
                <thead><tr><th>Nomor</th><th>Cek</th></tr></thead>
                <tbody>
                  {data.top.map((t) => (
                    <tr key={t.member}><td className="font-mono text-white/85">{t.member}</td><td className="text-white/75">{t.score}x</td></tr>
                  ))}
                  {data.top.length === 0 && <tr><td colSpan={2} className="text-center text-white/40">Belum ada data.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* FLAGGED */}
          <div>
            <h2 className="mb-4 text-lg font-bold text-white">Nomor ter-flag (stalking)</h2>
            <div className="glass p-2">
              <table className="admin-table">
                <thead><tr><th>Nomor</th><th>Alasan</th></tr></thead>
                <tbody>
                  {data.flagged.map((f) => (
                    <tr key={f.phone}><td className="font-mono text-white/85">{f.phone}</td><td className="text-amber-300 text-xs">{f.info?.reason} • {wib(f.info?.at)}</td></tr>
                  ))}
                  {data.flagged.length === 0 && <tr><td colSpan={2} className="text-center text-white/40">Bersih.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <h2 className="mb-4 mt-10 text-lg font-bold text-white">Masukin Nomer</h2>
        <div className="glass flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="62812xxxxxxx"
            className="input-glow flex-1 px-4 py-3 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => action("freeze")} className="btn-ghost px-4 py-2.5 text-sm text-amber-200/90">Freeze 30 hari</button>
            <button onClick={() => action("unfreeze")} className="btn-ghost px-4 py-2.5 text-sm text-emerald-200/90">Unfreeze</button>
            <button onClick={createTestOrder} disabled={creatingTest} className="btn-ghost px-4 py-2.5 text-sm text-sky-200/90 disabled:opacity-50">
              {creatingTest ? "Bikin..." : "Cek Nomer"}
            </button>
          </div>
        </div>
        {testUrl && (
          <div className="glass mt-4 border-sky-400/25 p-5">
            <p className="mb-2 text-sm font-semibold text-sky-200">Link test siap — buka buat ngetes alur tanpa bayar:</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 break-all rounded-lg bg-black/30 px-3 py-2.5 font-mono text-[12px] text-sky-100/90">{testUrl}</code>
              <div className="flex gap-2">
                <a href={testUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-4 py-2.5 text-sm">Buka</a>
                <button
                  type="button"
                  onClick={() => { try { navigator.clipboard.writeText(testUrl); setMsg("Link test disalin."); } catch { /* abaikan */ } }}
                  className="btn-ghost px-4 py-2.5 text-sm text-white/70"
                >
                  Salin
                </button>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-white/40">Order test kedaluwarsa 60 menit. Hasilnya ditandai badge “mode test” dan tidak masuk statistik.</p>
          </div>
        )}
        {(data.frozen?.length ?? 0) > 0 && (
          <div className="glass mt-4 p-5">
            <p className="mb-3 text-sm font-semibold text-white/60">Nomer yang lagi dibekuin ({data.frozen.length})</p>
            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2">
              {data.frozen.map((fn) => (
                <span key={fn} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 font-mono text-[13px] text-white/80">
                  {fn}
                  <button
                    onClick={() => unfreezePhone(fn)}
                    className="text-emerald-300/80 hover:text-emerald-200 text-xs font-sans font-semibold"
                    title="Buka bekunya"
                  >
                    Buka
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS */}
        <h2 className="mb-4 mt-10 text-lg font-bold text-white">Order pembayaran ({data.orders?.length || 0})</h2>
        <div className="glass overflow-x-auto p-2">
          <table className="admin-table">
            <thead><tr><th>Waktu</th><th>ID Pesanan</th><th>Nomer</th><th>Nominal</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data.orders || []).map((o: any, i: number) => (
                <tr key={i}>
                  <td className="font-mono text-xs text-white/55">{wib(o.at)}</td>
                  <td className="font-mono text-xs text-white/70">{o.orderId}</td>
                  <td className="font-mono text-xs text-white/70">{o.phone}</td>
                  <td className="text-white/75">Rp {Number(o.amount || 0).toLocaleString("id-ID")}</td>
                  <td className="text-xs">
                    <span className={
                      o.status === "PAID" ? "text-emerald-300" :
                      o.status === "PENDING" ? "text-amber-300" :
                      o.status === "EXPIRED" ? "text-red-300/70" : "text-white/45"
                    }>{o.status}</span>
                    {o.test && (
                      <span className="ml-1.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">test</span>
                    )}
                  </td>
                  <td>
                    <button onClick={() => delOrder(i)} className="btn-ghost px-3 py-1.5 text-xs text-red-300/90">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {(data.orders || []).length === 0 && <tr><td colSpan={6} className="text-center text-white/40">Belum ada.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* LOGS */}
        <h2 className="mb-4 mt-10 text-lg font-bold text-white">Log terakhir (50)</h2>
        <div className="glass overflow-x-auto p-2">
          <table className="admin-table">
            <thead><tr><th>Waktu</th><th>Nomer</th><th>Akun</th><th>Ms</th><th>Note</th></tr></thead>
            <tbody>
              {data.logs.map((l, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs text-white/55">{wib(l.ts, true).slice(6)}</td>
                  <td className="font-mono text-xs text-white/70">{l.phone}</td>
                  <td className="text-white/75">{l.account === -1 ? "-" : "#" + l.account}</td>
                  <td className="text-white/55">{l.ms}</td>
                  <td className="text-xs text-white/45">{l.note}</td>
                </tr>
              ))}
              {data.logs.length === 0 && <tr><td colSpan={6} className="text-center text-white/40">Belum ada.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* REPORTS */}
        {data.reports.length > 0 && (
          <>
            <h2 className="mb-4 mt-10 text-lg font-bold text-white">Laporan user ({data.reports.length})</h2>
            <div className="glass p-2">
              <table className="admin-table">
                <thead><tr><th>Waktu</th><th>Nomer</th><th>Jenis</th><th></th></tr></thead>
                <tbody>
                  {data.reports.map((r, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs text-white/55">{wib(r.ts)}</td>
                      <td className="font-mono text-xs text-white/70">{r.phone}</td>
                      <td className="text-white/75">{r.type}</td>
                      <td>
                        <button onClick={() => delReport(i)} className="btn-ghost px-3 py-1.5 text-xs text-red-300/90">
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
