"use client";
// Fingerprint perangkat ringan (tanpa library eksternal).
// Dipakai sebagai lapis kedua rate limit selain IP (tahan ganti VPN).

function hashStr(s: string): string {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < s.length; i++) {
    h1 = ((h1 << 5) + h1 + s.charCodeAt(i)) >>> 0;
    h2 = ((h2 << 5) + h2 + s.charCodeAt(i)) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function canvasFp(): string {
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!ctx) return "nocanvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(10, 10, 60, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("cektag-fp", 12, 12);
    return c.toDataURL().slice(-64);
  } catch {
    return "err";
  }
}

export function getFingerprint(): string {
  try {
    const cached = localStorage.getItem("ct_fp");
    if (cached) return cached;
    const parts = [
      navigator.userAgent,
      navigator.language,
      String(screen.width) + "x" + screen.height + "x" + screen.colorDepth,
      String(new Date().getTimezoneOffset()),
      navigator.hardwareConcurrency || 0,
      navigator.platform,
      canvasFp(),
    ];
    const fp = hashStr(parts.join("|"));
    localStorage.setItem("ct_fp", fp);
    return fp;
  } catch {
    return "unknown";
  }
}
