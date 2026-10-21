"use client";

import { useEffect, useState } from "react";

function fmt(n: number) {
  return n.toLocaleString("id-ID");
}

export default function TrustStats() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setTotal(typeof d.checksTotal === "number" ? d.checksTotal : 0))
      .catch(() => setTotal(0));
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      <div className="flex flex-col">
        <div className="flex h-12 items-center justify-center">
          <div className="stat-num">{total === null ? "…" : fmt(total)}</div>
        </div>
        <div className="mt-1 text-[13px] text-white/50">Nomer<br />dicek</div>
      </div>
      <div className="flex flex-col">
        <div className="flex h-12 items-center justify-center">
          <div className="stat-num whitespace-nowrap" style={{ fontSize: "clamp(20px, 4.5vw, 40px)" }}>Real-time</div>
        </div>
        <div className="mt-1 text-[13px] text-white/50">Dari<br />GetContact</div>
      </div>
      <div className="flex flex-col">
        <div className="flex h-12 items-center justify-center">
          <div className="stat-num whitespace-nowrap">&lt;10<span className="text-xl">dtk</span></div>
        </div>
        <div className="mt-1 text-[13px] text-white/50">Hasil<br />instan</div>
      </div>
    </div>
  );
}
