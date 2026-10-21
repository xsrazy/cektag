# CekTag

**Live: https://cektag.xsrazy.web.id**

CekTag adalah layanan web untuk mengecek tag GetContact dari sebuah nomor HP: daftar nama atau julukan yang dipakai orang lain untuk menyimpan nomor itu di kontak mereka. Berguna untuk mengenali nomor tak dikenal dan mendeteksi indikasi spam. Setiap pengecekan berharga Rp 2.000, dibayar via QRIS, tanpa daftar dan tanpa langganan.

## Isi Web

- **Halaman utama:** form pengecekan nomor (format 08xx dirapikan otomatis), penjelasan cara kerja, dan FAQ.
- **Alur cek:** pengguna memasukkan nomor, membayar Rp 2.000 via QRIS, lalu sistem mengambil data tag terbaru dari GetContact secara real-time (di bawah 10 detik) dan menampilkan daftar tag-nya.
- **Halaman Privasi:** menjelaskan kebijakan data. Setiap pengecekan langsung ke GetContact dan hasilnya tidak disimpan; di log, nomor HP dan IP hanya dicatat dalam bentuk hash yang tidak bisa dibaca balik.
- **Panel admin:** login terlindungi untuk memantau transaksi dan penggunaan kuota GetContact.

Seperti tertulis di situsnya, akurasi tag bergantung pada data crowdsource GetContact, jadi hasil hanya gambaran, bukan patokan pasti.

## Frontend

- Next.js 14 (App Router) dengan React dan TypeScript.
- Halaman publik: beranda dengan form cek, halaman hasil, dan halaman privasi.
- Proteksi formulir memakai Cloudflare Turnstile.

## Backend

- API route Next.js untuk membuat invoice pembayaran, menerima webhook pembayaran, dan menembak API GetContact saat cek dijalankan.
- Pembayaran QRIS memakai gateway SayaBayar: invoice dibuat per pengecekan dan status dibayar dikonfirmasi lewat webhook.
- Kuota dan sesi pembayaran dicatat di Upstash Redis, dengan fallback penyimpanan in-memory.
- Kata sandi admin tersimpan sebagai hash bcrypt.
- File `.secrets.json` (kredensial lokal) tidak pernah masuk repo; file itu masuk `.gitignore`.
