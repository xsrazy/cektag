import type { Metadata } from "next";
import Checker from "../components/Checker";
import Faq from "../components/Faq";
import { SiteHeader, SiteFooter } from "../components/SiteChrome";
import { SearchIcon, DbIcon, TagIcon } from "../components/icons";
import TrustStats from "../components/TrustStats";
import PayMarquee from "../components/PayMarquee";

export const metadata: Metadata = {
  title: "CekTag: Deteksi Spam & Identitas Nomor Tak Dikenal",
  description:
    "Nomor tak dikenal ganggu atau bikin penasaran? Lihat tag GetContact-nya: ditandai spam/penipu atau justru kenalan. Sekali cek langsung tahu.",
};

const STEPS = [
  {
    icon: SearchIcon,
    t: "Masukin nomer",
    d: "Ketik nomer HP yang bikin penasaran. Format 08xx otomatis kami rapikan.",
  },
  {
    icon: DbIcon,
    t: "Kami cek ke GetContact",
    d: "Sistem mengambil data tag terbaru dari database GetContact dalam hitungan detik.",
  },
  {
    icon: TagIcon,
    t: "Lihat tag-nya",
    d: "Muncul daftar nama/julukan yang dipakai orang lain buat nyimpen nomer itu.",
  },
];

export default function Home() {
  return (
    <div>
      <div className="bg-mesh" />
      <div className="bg-grid" />
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-5">
        {/* HERO */}
        <section className="pb-10 pt-14 text-center sm:pt-20">
          <h1 className="fade-up fade-up-1 font-display mx-auto max-w-3xl text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-6xl">
            Nomer ga dikenal?
            <br />
            <span className="grad-text">Dicek dulu aja!</span>
          </h1>
          <p className="fade-up fade-up-2 mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/60 sm:text-base">
            Masukin nomernya, langsung keliatan gimana orang-orang
            nyimpen nomer itu di kontak mereka.
          </p>
          {/* SEO: deskripsi kaya keyword, tidak tampil visual */}
          <p className="sr-only">
            CekTag adalah web berbayar untuk cek tag GetContact sebuah nomor HP:
            cara cek nomor tidak dikenal, mengetahui identitas nomor penipu
            atau spam, tanpa daftar dan tanpa install aplikasi.
          </p>
        </section>

        {/* CHECKER */}
        <section className="mx-auto max-w-2xl">
          <Checker />
        </section>

        {/* STEPS */}
        <section id="cara-kerja" className="mx-auto mt-20 max-w-4xl scroll-mt-24">
          <h2 className="fade-up font-display mb-8 text-center text-2xl font-bold text-white sm:text-3xl">
            Gampang banget, <span className="grad-text">caranya</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={i} className={`glass fade-up fade-up-${i + 1} p-6`}>
                <div className="mb-3 flex items-center gap-4">
                  <div className="step-num shrink-0"><s.icon size={20} /></div>
                  <h3 className="font-bold text-white">{s.t}</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/55">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TRUST BAND */}
        <section className="glass fade-up mx-auto mt-16 max-w-4xl p-6 sm:p-8">
          <TrustStats />
        </section>

        <PayMarquee />

        <Faq />
      </main>

      <SiteFooter />
    </div>
  );
}
