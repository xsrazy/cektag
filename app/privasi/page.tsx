import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "../../components/SiteChrome";
import { UPDATED_AT } from "../../lib/site";

export const metadata: Metadata = {
  title: "Kebijakan Privasi : CekTag",
  description: "Kebijakan privasi CekTag: data apa yang kami simpan dan bagaimana cara meminta takedown.",
};

export default function Privasi() {
  return (
    <div>
      <div className="bg-mesh" />
      <div className="bg-grid" />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-10 pt-14">
        <h1 className="fade-up font-display text-3xl font-bold text-white sm:text-4xl">
          Kebijakan <span className="grad-text">Privasi</span>
        </h1>
        <p className="fade-up fade-up-1 mt-3 text-sm text-white/45">Terakhir diperbarui: {UPDATED_AT}</p>

        <div className="prose-legal fade-up fade-up-2 mt-6">
          <h2>Data yang kami simpan</h2>
          <ul>
            <li><strong>Tanpa penyimpanan hasil:</strong> setiap cek langsung mengambil data terbaru dari GetContact secara real-time. Hasilnya tidak kami simpan di server.</li>
            <li><strong>Log admin:</strong> nomer yang dicek tercatat di log admin (hanya bisa dilihat admin) untuk jadi data dan membantu kalau ada yang butuh informasi. Alamat IP tetap kami simpan dalam bentuk hash satu arah (acak, tidak bisa dibaca balik). Tujuannya murni untuk rate limit dan deteksi penyalahgunaan.</li>
            <li><strong>Riwayat di perangkat Anda:</strong> 10 nomer terakhir yang Anda cek tersimpan di browser perangkat Anda sendiri (localStorage), tidak dikirim ke server kami.</li>
          </ul>

          <h2>Data yang TIDAK kami lakukan</h2>
          <ul>
            <li>Kami <strong>tidak menjual</strong> data ke pihak mana pun.</li>
            <li>Kami <strong>tidak menampilkan</strong> siapa yang mengecek nomer siapa ke publik.</li>
            <li>Kami <strong>tidak meminta</strong> data pribadi Anda. Tidak perlu daftar, tidak perlu login.</li>
          </ul>

          <h2>Sumber data</h2>
          <p>
            Tag yang ditampilkan berasal dari database publik GetContact (crowdsource dari
            pengguna mereka). CekTag adalah layanan independen dan <strong>tidak berafiliasi</strong> dengan
            GetContact. Keakuratan tag sepenuhnya tanggung jawab data crowdsource tersebut.
          </p>

          <h2>Takedown / keberatan</h2>
          <p>
            Kalau nomer Anda muncul di hasil pencarian dan Anda keberatan, data aslinya
            berasal dari GetContact. Penghapusan permanen harus dilakukan di sana:
          </p>
          <ul>
            <li>Buka aplikasi GetContact → profil Anda → kelola visibilitas/tag.</li>
            <li>Atau kunjungi <strong>getcontact.com/help/privacy</strong> untuk permintaan penghapusan data.</li>
          </ul>
          <p>
            Setelah dihapus dari GetContact, hasil cek berikutnya otomatis mengikuti data terbaru karena kami selalu mengambil langsung secara real-time.
            Untuk permintaan dipercepat, hubungi kami via email@cektag.web.id dengan subjek
            "Takedown Tag" + nomer yang dimaksud.
          </p>

          <h2>Keamanan</h2>
          <p>
            Halaman admin kami diproteksi password dan hanya bisa diakses pemilik layanan. Kredensial API
            disimpan terenkripsi sebagai environment variable dan tidak pernah terekspos ke publik.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
