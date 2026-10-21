"use client";

const METHODS = [
  "BCA", "BRI", "Mandiri", "BNI", "CIMB Niaga", "Danamon",
  "Permata", "BTN", "BSI",
  "GoPay", "OVO", "DANA", "ShopeePay", "LinkAja", "QRIS",
];

export default function PayMarquee() {
  const row = [...METHODS, ...METHODS];
  return (
    <section className="mx-auto mt-20 max-w-5xl overflow-hidden">
      <p className="fade-up mb-6 text-center text-xs font-bold uppercase tracking-[0.22em] text-white/35">
        Didukung banyak metode pembayaran
      </p>
      <div className="fade-up fade-up-1 mb-8 flex justify-center">
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/55">
          segera hadir
        </span>
      </div>
      <div className="marquee-mask fade-up fade-up-1">
        <div className="marquee-track">
          {row.map((m, i) => (
            <span key={i} className="marquee-item font-display">
              {m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
