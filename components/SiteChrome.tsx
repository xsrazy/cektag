export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="3" y="3" width="34" height="34" rx="11" fill="#a78bfa" opacity="0.14" />
      <rect x="3" y="3" width="34" height="34" rx="11" stroke="#a78bfa" strokeWidth="2" opacity="0.55" />
      <g stroke="#a78bfa" strokeWidth="3.6" strokeLinecap="round">
        <path d="M16.5 10 L14.2 30" />
        <path d="M25.8 10 L23.5 30" />
        <path d="M10 16.5 H30" />
        <path d="M10 23.5 H30" />
      </g>
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07070f]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
        <a href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Cek<span className="grad-text">Tag</span>
          </span>
        </a>
        <div className="flex items-center gap-3">
          <span className="badge-free">
            <span className="dot" />
            RP 2.000 / CEK
          </span>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const cols: { h: string; links: { t: string; href: string }[] }[] = [
    {
      h: "Layanan",
      links: [
        { t: "Harga", href: "/harga" },
        { t: "Cara Kerja", href: "/#cara-kerja" },
        { t: "Cek Nomer", href: "/" },
      ],
    },
    {
      h: "Legal",
      links: [
        { t: "FAQ", href: "/#faq" },
        { t: "Kebijakan Privasi", href: "/privasi" },
        { t: "Syarat & Ketentuan", href: "/syarat" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.06] mt-20">
      <div className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="flex h-8 items-center gap-2.5">
              <Logo size={30} />
              <div className="font-display text-lg font-bold text-white">
                Cek<span className="grad-text">Tag</span>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
              CekTag adalah web buat ngeliat tag GetContact sebuah nomer HP.
              Intinya, buat ngejawab rasa penasaran "ini nomer siapa sih?".
              Layanan berbayar per cek, tanpa daftar dan tanpa install apapun.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {["Tanpa daftar", "Tanpa install", "Hasil instan"].map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/65"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-12 sm:gap-16">
            {cols.map((c) => (
              <div key={c.h} className="min-w-0">
                <h4 className="mb-4 flex h-8 items-center text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                  {c.h}
                </h4>
                <ul className="space-y-3">
                  {c.links.map((l) => (
                    <li key={l.t}>
                      <a href={l.href} className="break-all text-sm text-white/60 transition-colors hover:text-white">
                        {l.t}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
