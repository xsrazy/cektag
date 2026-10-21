# CekTag

**Live: https://cektag.xsrazy.web.id**

Layanan cek tag nomor HP: lihat label dan nama simpanan sebuah nomor dari data GetContact, langsung dari browser.

## Fitur

- Cek tag nomor HP dengan hasil real-time
- Pemesanan dan pembayaran otomatis (webhook pembayaran terverifikasi)
- Panel admin untuk mengelola order, kuota akun, dan laporan
- Proteksi anti-abuse: rate limit, fingerprint, dan verifikasi Turnstile

## Teknologi

Next.js (App Router, TypeScript) di Vercel. Kuota akun GetContact dipantau otomatis dan web menolak order baru secara otomatis saat jatah habis, supaya tidak ada pembeli yang membayar sia-sia. Kredensial dibaca dari environment variable, tidak ada kunci yang disimpan di repo ini.
