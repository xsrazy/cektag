"use client";

import { useState } from "react";

const ITEMS = [
  {
    q: "Apa itu tag GetContact?",
    a: "Tag adalah nama/julukan yang diberikan orang lain saat menyimpan sebuah nomer di kontak HP mereka. GetContact mengumpulkan data ini dari jutaan penggunanya, jadi kamu bisa lihat gimana orang-orang menamai sebuah nomer.",
  },
  {
    q: "Datanya dari mana? Akurat nggak?",
    a: "Dari database publik GetContact. Akurasinya tergantung data crowdsource. Bisa tepat banget, bisa juga ngaco kalau yang nyimpen kontaknya iseng. Buat gambaran aja, jangan dijadiin patokan.",
  },
  {
    q: "Berapa harganya?",
    a: "Rp 2.000 per cek, bayar via QRIS. Tanpa daftar, tanpa langganan, bayar cuma pas mau cek aja.",
  },
  {
    q: "Apakah nomer yang saya cek disimpan?",
    a: "Tidak. Setiap pengecekan langsung nembak ke GetContact secara real-time dan hasilnya tidak kami simpan. Di log kami, nomer HP dan IP hanya disimpan dalam bentuk hash (acak), tidak bisa dibaca balik. Detailnya ada di halaman Privasi.",
  },
];

export default function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="mx-auto mt-20 max-w-3xl scroll-mt-24" id="faq">
      <h2 className="fade-up font-display mb-2 text-center text-2xl font-bold text-white sm:text-3xl">
        Sering <span className="grad-text">ditanyain</span>
      </h2>
      <p className="fade-up fade-up-1 mb-8 text-center text-sm text-white/50">
        Yang perlu kamu tau sebelum ngecek.
      </p>
      <div className="glass fade-up fade-up-2 px-5 sm:px-8">
        {ITEMS.map((it, i) => {
          const open = openIdx === i;
          return (
            <div key={i} className="faq-item">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 py-[18px] text-left font-semibold text-white"
              >
                <span>{it.q}</span>
                <svg
                  className={`arrow shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div
                className="grid transition-all duration-300 ease-in-out"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="faq-body">{it.a}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
