"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useWatchlist } from "./useWatchlist";

const NAV = [
  { href: "/", label: "New launches", icon: "◉", hint: "Live launch feed" },
  { href: "/trending", label: "Trending", icon: "↗", hint: "Top tokens, last hour" },
  { href: "/watchlist", label: "Watchlist", icon: "☆", hint: "Saved in this browser" },
  { href: "/methodology", label: "How it works", icon: "◈", hint: "Score, AI checks, sources" },
];

type Health = { services: { rpc: string; jupiter: string; ai: string } };

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const { items } = useWatchlist();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setQuery("");
    router.push(`/token/${encodeURIComponent(q)}`);
  }

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const dot = (s?: string) => (!s ? "muted" : /keyed|enabled/.test(s) ? "ok" : "warn");

  return (
    <div className={`app ${open ? "nav-open" : ""}`}>
      <header className="mobilebar">
        <Link href="/" className="brand"><span className="pulse-dot" />PULSE</Link>
        <button className="menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "✕" : "☰"}</button>
      </header>

      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand side-brand">
          <span className="pulse-dot" />PULSE
          <small>MEMECOIN TERMINAL</small>
        </Link>

        <form className="side-search" onSubmit={onSearch} role="search">
          <span aria-hidden>⌕</span>
          <input aria-label="Search token by mint, symbol or name" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mint or symbol…" />
        </form>

        <nav className="side-nav">
          <span className="side-label">TERMINAL</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={active(n.href) ? "on" : ""} aria-current={active(n.href) ? "page" : undefined}>
              <span className="nav-icon" aria-hidden>{n.icon}</span>
              <span className="nav-text">
                {n.label}
                <small>{n.hint}</small>
              </span>
              {n.href === "/watchlist" && items.length > 0 && <span className="nav-count">{items.length}</span>}
            </Link>
          ))}
        </nav>

        {items.length > 0 && (
          <nav className="side-nav side-watch">
            <span className="side-label">WATCHING</span>
            {items.slice(0, 5).map((w) => (
              <Link key={w.mint} href={`/token/${w.mint}`} className={pathname === `/token/${w.mint}` ? "on" : ""}>
                <span className="nav-icon" aria-hidden>·</span>
                <span className="nav-text">{w.symbol}</span>
                {w.score !== undefined && <span className="nav-count">{w.score}</span>}
              </Link>
            ))}
          </nav>
        )}

        <div className="side-status">
          <span className="side-label">DATA SOURCES</span>
          <span><i className={dot(health ? "keyed" : undefined)} /> Solana mainnet</span>
          <span title={health?.services.rpc}><i className={dot(health?.services.rpc)} /> RPC {health ? (/keyed/.test(health.services.rpc) ? "· keyed" : "· public") : ""}</span>
          <span title={health?.services.jupiter}><i className={dot(health?.services.jupiter)} /> Jupiter {health ? (/keyed/.test(health.services.jupiter) ? "· keyed" : "· keyless") : ""}</span>
          <span title={health?.services.ai}><i className={dot(health?.services.ai)} /> AI analyst {health ? (/enabled/.test(health.services.ai) ? "· on" : "· rule-based") : ""}</span>
        </div>

        <p className="side-foot">Check before you sign. Pulse never holds funds or executes trades. Not financial advice.</p>
      </aside>

      <div className="scrim" onClick={() => setOpen(false)} aria-hidden />
      <main className="main">{children}</main>
    </div>
  );
}
