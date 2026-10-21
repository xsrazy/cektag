import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Gerbang admin: /admin langsung bisa dibuka (sesuai permintaan).
// ADMIN_PATH tetap didukung sebagai alias bila diisi path lain.
export function middleware(req: NextRequest) {
  const secret = process.env.ADMIN_PATH || "";
  const path = req.nextUrl.pathname;
  const res = NextResponse.next();

  // security headers
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");

  if (secret && secret !== "/admin" && (path === secret || path.startsWith(secret + "/"))) {
    const rest = path.slice(secret.length) || "/";
    const url = req.nextUrl.clone();
    url.pathname = "/admin" + (rest === "/" ? "" : rest);
    return NextResponse.rewrite(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
