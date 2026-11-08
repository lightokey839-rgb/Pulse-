"use client";
import { useEffect, useRef, useState } from "react";

type P = { usdPrice?: number; change24h?: number | null; mode: string };

const fmt = (p: number) => (p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 2 }) : p >= 1 ? p.toFixed(4) : p >= 0.0001 ? p.toFixed(6) : p.toPrecision(4));

// Live price strip: polls every 5s while the tab is visible; the "updated" counter ticks every second.
export default function LivePrice({ mint }: { mint: string }) {
  const [p, setP] = useState<P | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/price?mint=${mint}`, { cache: "no-store" });
        const b = (await r.json()) as P;
        if (!alive) return;
        if (typeof b.usdPrice === "number") {
          if (last.current !== null && b.usdPrice !== last.current) {
            setDir(b.usdPrice > last.current ? "up" : "down");
            setTimeout(() => setDir(null), 900);
          }
          last.current = b.usdPrice;
          setAt(Date.now());
        }
        setP(b);
      } catch {
        if (alive) setP((x) => ({ ...(x ?? {}), mode: "UNAVAILABLE" }));
      }
    };
    void load();
    const poll = setInterval(load, 5_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [mint]);

  const age = at ? Math.max(0, Math.round((now - at) / 1000)) : null;
  const label = !p ? "…" : p.mode === "UNAVAILABLE" ? "UNAVAILABLE" : age !== null && age > 15 ? "CACHED" : p.mode;
  return (
    <div className={`live-price ${dir ?? ""}`} aria-live="polite">
      <span className="label">PRICE</span>
      <strong className="mono price-val">{p?.usdPrice !== undefined ? `$${fmt(p.usdPrice)}` : "—"}</strong>
      {p?.change24h !== undefined && p?.change24h !== null && (
        <span className={`mono ${p.change24h >= 0 ? "ok" : "bad"}`}>{p.change24h >= 0 ? "+" : ""}{p.change24h.toFixed(2)}% 24h</span>
      )}
      <span className={`chip ${label === "LIVE" ? "" : "demo"}`}>{label}</span>
      <span className="muted small">{age === null ? "loading…" : `updated ${age}s ago · Jupiter`}</span>
    </div>
  );
}
