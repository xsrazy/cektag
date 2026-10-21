import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "../../components/SiteChrome";
import { UPDATED_AT } from "../../lib/site";

export const metadata: Metadata = {
  title: "Syarat Penggunaan : CekTag",
  description: "Syarat penggunaan layanan CekTag.",
};

export default function Syarat() {
  return (
    <div>
      <div className="bg-mesh" />
      <div className="bg-grid" />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-10 pt-14">
        <h1 className="fade-up font-display text-3xl font-bold text-white sm:text-4xl">
          Syarat <span className="grad-text">Penggunaan</span>
        </h1>
        <p className="fade-up fade-up-1 mt-3 text-sm text-white/45">Terakhir diperbarui: {UPDATED_AT}</p>

        <div className="prose-legal fade-up fade-up-2 mt-6">
          <h2>1. Layanan</h2>
          <p>
            CekTag menyediakan tampilan tag GetContact sebuah nomer telepon untuk
            penggunaan personal yang wajar. Layanan berbayar: Rp 2.000 per cek via QRIS.
          </p>

          <h2>2. Larangan</h2>
          <ul>
            <li><strong>Dilarang scraping massal</strong>: mengambil data dalam jumlah besar via bot, script, atau otomasi apa pun.</li>
            <li><strong>Dilarang doxxing / pelecehan</strong>: menggunakan hasil cek untuk menyebar data pribadi, mengancam, atau mempermalukan orang lain.</li>
            <li><strong>Dilarang mengakali rate limit</strong>: termasuk rotasi VPN/proxy untuk melewati batas pemakaian wajar.</li>
          </ul>
          <p>Pelanggaran berujung pemblokiran permanen tanpa pemberitahuan.</p>

          <h2>3. Batasan tanggung jawab</h2>
          <p>
            Data tag berasal dari crowdsource GetContact dan <strong>bisa tidak akurat</strong>.
            CekTag tidak menjamin kebenaran data dan tidak bertanggung jawab atas
            keputusan yang Anda ambil berdasarkan hasil cek. Layanan diberikan "apa adanya"
            dan bisa berubah atau berhenti sewaktu-waktu.
          </p>

          <h2>4. Perubahan</h2>
          <p>
            Syarat ini bisa diperbarui kapan saja. Penggunaan berkelanjutan setelah
            perubahan berarti Anda menyetujuinya.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
