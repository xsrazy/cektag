import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "../../components/SiteChrome";
import { CheckIcon } from "../../components/icons";

export const metadata: Metadata = {
  title: "Harga : CekTag",
  description: "Harga CekTag: Rp 2.000 per cek via QRIS.",
};

export default function Harga() {
  return (
    <div>
      <div className="bg-mesh" />
      <div className="bg-grid" />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-10 pt-14">
        <h1 className="fade-up font-display text-center text-3xl font-bold text-white sm:text-4xl">
          Harga <span className="grad-text">CekTag</span>
        </h1>
        <p className="fade-up fade-up-1 mt-4 text-center text-white/60">
          Simpel: bayar cuma pas mau cek. Tanpa langganan, tanpa daftar.
        </p>

        <div className="mx-auto mt-10 max-w-md">
          <div className="glass fade-up fade-up-2 relative flex flex-col overflow-hidden p-7">
            <div className="absolute right-5 top-5">
              <span className="badge-free"><span className="dot" /> AKTIF</span>
            </div>
            <h2 className="text-xl font-extrabold text-white">Per Cek</h2>
            <div className="mt-3 flex items-end gap-1">
              <span className="font-display text-4xl font-bold text-white">Rp 2.000</span>
              <span className="pb-1 text-sm text-white/45">/cek</span>
            </div>
            <p className="mt-1 text-sm text-white/50">bayar via QRIS, hasil instan</p>
            <ul className="mt-6 space-y-2.5 text-sm text-white/70">
              {["Cek sepuasnya, bayar per cek", "Hasil real-time dari GetContact", "Tanpa langganan", "Tanpa daftar"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckIcon size={14} className="shrink-0 text-emerald-300" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-7">
              <a href="/" className="btn-primary block px-6 py-3.5 text-center text-sm">
                Cek Sekarang
              </a>
            </div>
          </div>
        </div>

        <p className="fade-up fade-up-4 mt-8 text-center text-sm text-white/40">
          Pembayaran via QRIS sudah aktif — scan, bayar, hasil langsung keluar.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
