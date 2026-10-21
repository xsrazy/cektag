// Normalisasi + validasi nomor HP Indonesia.

export function normalizePhone(input: string): string | null {
  let d = input.replace(/[^\d]/g, "");
  // buang prefix 00 internasional
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("62")) {
    // sudah format internasional
  } else if (d.startsWith("0")) {
    d = "62" + d.slice(1);
  } else if (d.length >= 9 && d.length <= 13) {
    // tanpa prefix sama sekali, anggap nomor lokal
    d = "62" + d;
  } else {
    return null;
  }
  if (!/^62[1-9]\d{7,13}$/.test(d)) return null;
  if (d.length < 10 || d.length > 16) return null;
  // tolak nomor layanan / darurat
  const svc = ["112", "110", "113", "115", "118", "119", "1500", "14000", "14080", "0800"];
  for (const s of svc) {
    if (d === "62" + s || d.startsWith("62" + s)) return null;
  }
  return d;
}

export function formatPhoneIntl(d: string): string {
  // 62812xxxxxxx -> +62 812-xxxx-xxxx (tampilan)
  const rest = d.slice(2);
  if (rest.length <= 4) return "+" + d;
  if (rest.length <= 8) return `+62 ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7, 11)}`;
}

export function hashPhone(phone: string): string {
  // sha256 via WebCrypto (async) — versi sync sederhana pakai djb2 x2 + salt
  // untuk log; bukan untuk keamanan kriptografis.
  const s = "cektag$" + phone;
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < s.length; i++) {
    h1 = ((h1 << 5) + h1 + s.charCodeAt(i)) >>> 0;
    h2 = ((h2 << 5) + h2 + s.charCodeAt(i + 1 || 0)) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
}
