# CekTag

**Live: https://cektag.xsrazy.web.id**

CekTag adalah layanan web untuk mengecek tag nama kontak sebuah nomor HP, yaitu nama-nama yang dipakai orang lain saat menyimpan nomor tersebut di kontak mereka (data berasal dari GetContact). Pengguna memasukkan nomor HP, membayar sekali cek, lalu melihat daftar tag yang melekat pada nomor itu. Layanan ini dipakai misalnya untuk memeriksa reputasi nomor penjual, nomor tidak dikenal, atau nomor sendiri.

## Isi Web

- **Halaman utama:** form cek nomor (komponen Checker), penjelasan layanan, marquee metode pembayaran, statistik kepercayaan (TrustStats) dan FAQ.
- **Halaman harga (/harga):** harga tetap **Rp 2.000 per satu kali cek**, tanpa langganan.
- **Halaman privasi (/privasi) dan syarat (/syarat):** kebijakan privasi dan syarat layanan.
- **Panel admin (/admin dan /admin/dash):** login admin, melihat data order dan cek, menjalankan aksi pengelolaan, dan mengetes koneksi API.

## Alur Pengguna

1. Pengguna memasukkan nomor HP di form cek.
2. Form dilindungi Cloudflare Turnstile (anti bot) dan rate limit.
3. Sistem membuat order, lalu menerbitkan invoice QRIS lewat gateway SayaBayar.
4. Pengguna membayar QRIS (bisa dari e-wallet atau mobile banking apa pun) dan status order dipantau otomatis.
5. Webhook pembayaran dari SayaBayar menandai order lunas, lalu cek dijalankan ke API GetContact.
6. Hasil berupa daftar tag nama kontak untuk nomor tersebut ditampilkan ke pengguna.

## Frontend

- Next.js 14 (App Router) dengan React 18 dan TypeScript.
- Styling memakai Tailwind CSS 3.
- Komponen utama ada di folder `components/`: Checker (form dan hasil cek), Faq, PayMarquee, SiteChrome (kerangka header dan footer), TrustStats, dan kumpulan ikon.
- Kode QR pembayaran digambar di sisi klien memakai library `qrcode`.
- SEO ditangani lewat `app/sitemap.ts` dan `app/robots.ts`, plus halaman 404 khusus.

## Backend

Backend berjalan sebagai Route Handlers Next.js di folder `app/api/`:

- `POST /api/check`: menjalankan proses cek untuk order yang sudah lunas.
- `/api/order` dan `/api/order/status`: membuat order dan mengecek statusnya (dipakai polling dari frontend).
- `/api/webhook/sayabayar`: menerima callback pembayaran dari SayaBayar.
- `/api/report`: laporan hasil untuk pengguna.
- `/api/stats` dan `/api/health`: statistik publik dan health check.
- `/api/cron/daily`: tugas harian terjadwal.
- `/api/admin/*`: login (password di-hash dengan bcrypt), data, action, test koneksi, dan logout untuk panel admin.

Logika bisnis dipisah rapi di folder `lib/`:

- `getcontact.ts`: klien API GetContact, sumber data tag nomor HP.
- `sayabayar.ts`: klien gateway SayaBayar untuk membuat invoice QRIS dan membaca string QRIS dari respons.
- `pricing.ts`: harga cek (Rp 2.000) dan format Rupiah.
- `store.ts`: lapisan penyimpanan order dan kuota. Memakai Upstash Redis bila env tersedia, dengan fallback penyimpanan in-memory.
- `ratelimit.ts`: pembatasan laju request per pengguna.
- `fingerprint.ts`: sidik jari perangkat untuk anti penyalahgunaan.
- `turnstile.ts`: verifikasi Cloudflare Turnstile di sisi server.
- `auth.ts`: autentikasi admin.

## Struktur Project

```
app/            Halaman (utama, harga, privasi, syarat, admin) dan route API
components/     Checker, Faq, PayMarquee, SiteChrome, TrustStats, ikon
lib/            Klien GetContact dan SayaBayar, pricing, store, keamanan
public/         Aset statis dan gambar OG
```

## Catatan

- Harga per cek dan seluruh format tampilan diatur terpusat di `lib/pricing.ts`.
- Kuota API GetContact terbatas per hari, karena itu rate limit dan pemantauan kuota adalah bagian penting dari backend.
