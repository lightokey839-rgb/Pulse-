"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { mint: string; symbol: string; price: number; change24h: number | null };

const fmt = (p: number) => (p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 2 }) : p >= 1 ? p.toFixed(3) : p >= 0.01 ? p.toFixed(4) : p.toPrecision(3));

export default function Ticker() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const load = () =>
      fetch("/api/ticker")
        .then((r) => r.json())
        .then((b) => b.items?.length && setItems(b.items))
        .catch(() => {});
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!items.length) return <div className="ticker" aria-hidden><div className="ticker-empty">Loading prices from Jupiter…</div></div>;
  const row = (key: string) =>
    items.map((i) => (
      <Link key={`${key}-${i.mint}`} href={`/token/${i.mint}`} className="tick" tabIndex={key === "b" ? -1 : undefined}>
        <span className="tick-sym">{i.symbol}</span>
        <span>${fmt(i.price)}</span>
        {i.change24h !== null && <span className={i.change24h >= 0 ? "ok" : "bad"}>{i.change24h >= 0 ? "+" : ""}{i.change24h.toFixed(2)}%</span>}
      </Link>
    ));
  return (
    <div className="ticker" aria-label="Trending verified tokens, 24h change">
      <div className="ticker-track">
        {row("a")}
        <span aria-hidden className="ticker-dup">{row("b")}</span>
      </div>
    </div>
  );
}
