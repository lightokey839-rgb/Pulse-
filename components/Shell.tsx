"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { parseIntent } from "@/lib/intent";
import Ticker from "./Ticker";
import { useWatchlist } from "./useWatchlist";

const GROUPS = [
  {
    label: null,
    items: [
      { href: "/", label: "Home", icon: "⌂", hint: "New launches, live" },
      { href: "/trending", label: "Trending", icon: "↗", hint: "Top tokens, last hour" },
      { href: "/watchlist", label: "Watchlist", icon: "☆", hint: "Saved in this browser" },
    ],
  },
  {
    label: "SCREENS",
    items: [
      { href: "/?filter=serial", label: "Serial launchers", icon: "⚠", hint: "Creators with 50+ launches" },
      { href: "/?filter=clean", label: "Fewer flags", icon: "◇", hint: "Authorities off, new creator" },
    ],
  },
  {
    label: "ON-CHAIN",
    items: [{ href: "/ledger", label: "Receipts ledger", icon: "⌁", hint: "Verdicts anchored on Solana" }],
  },
  {
    label: "LEARN",
    items: [{ href: "/methodology", label: "How it works", icon: "◈", hint: "Score, AI checks, sources" }],
  },
];

type Health = { services: { rpc: string; jupiter: string; ai: string; attestor?: string } };

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [ask, setAsk] = useState("");
  const [askNote, setAskNote] = useState("");
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [href, setHref] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { items } = useWatchlist();

  useEffect(() => {
    setOpen(false);
    setHref(window.location.pathname + window.location.search);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(to: string) {
    setHref(to);
    router.push(to);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setSearch("");
    searchRef.current?.blur();
    go(`/token/${encodeURIComponent(q)}`);
  }

  function onAsk(e: FormEvent) {
    e.preventDefault();
    const intent = parseIntent(ask);
    if (!intent) return;
    setAskNote(`→ ${intent.label}`);
    setAsk("");
    go(intent.href);
    setTimeout(() => setAskNote(""), 3500);
  }

  const isActive = (to: string) => (to.includes("?") ? href === to : to === "/" ? href === "/" : pathname.startsWith(to));
  const tone = (s?: string) => (!s ? "muted" : /keyed|enabled/.test(s) ? "ok" : "warn");

  return (
    <div className={`app2 ${open ? "nav-open" : ""}`}>
      <header className="topbar2">
        <button className="menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "✕" : "☰"}</button>
        <Link href="/" className="logo">
          <span className="logo-mark" aria-hidden><span /></span>
          <span className="logo-word">Pulse</span>
          <span className="net-badge"><i />SOLANA</span>
        </Link>
        <form className="top-search" onSubmit={onSearch} role="search">
          <span aria-hidden>⌕</span>
          <input ref={searchRef} aria-label="Search a ticker or paste a mint" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a ticker or paste a mint…" />
          <kbd>Ctrl K</kbd>
        </form>
        <div className="top-actions">
          <span className="live-pill" title={health ? `RPC: ${health.services.rpc}\nJupiter: ${health.services.jupiter}\nAI: ${health.services.ai}` : "Checking data sources"}>
            <i className={health ? "ok" : "muted"} />LIVE
          </span>
          <Link href="/methodology" className="icon-btn" aria-label="How it works" title="How it works">◈</Link>
          <Link href="/watchlist" className="icon-btn" aria-label="Watchlist" title="Watchlist">
            ☆{items.length > 0 && <span className="dot-count">{items.length}</span>}
          </Link>
        </div>
      </header>

      <Ticker />

      <div className="body2">
        <aside className="sidebar2" aria-label="Main navigation">
          {GROUPS.map((g) => (
            <nav className="side-nav" key={g.label ?? "main"}>
              {g.label && <span className="side-label">{g.label}</span>}
              {g.items.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setHref(n.href)} className={isActive(n.href) ? "on" : ""} aria-current={isActive(n.href) ? "page" : undefined}>
                  <span className="nav-icon" aria-hidden>{n.icon}</span>
                  <span className="nav-text">{n.label}<small>{n.hint}</small></span>
                  {n.href === "/watchlist" && items.length > 0 && <span className="nav-count">{items.length}</span>}
                </Link>
              ))}
            </nav>
          ))}

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
            <span><i className={health ? "ok" : "muted"} /> Solana mainnet</span>
            <span title={health?.services.rpc}><i className={tone(health?.services.rpc)} /> RPC {health ? (/keyed/.test(health.services.rpc) ? "· keyed" : "· public") : ""}</span>
            <span title={health?.services.jupiter}><i className={tone(health?.services.jupiter)} /> Jupiter {health ? (/keyed/.test(health.services.jupiter) ? "· keyed" : "· keyless") : ""}</span>
            <span title={health?.services.ai}><i className={tone(health?.services.ai)} /> AI analyst {health ? (/enabled/.test(health.services.ai) ? "· on" : "· rule-based") : ""}</span>
            <span title={health?.services.attestor}><i className={!health ? "muted" : /^ready/.test(health.services.attestor ?? "") ? "ok" : "warn"} /> Receipts {health ? (/^ready/.test(health.services.attestor ?? "") ? `· ${health.services.attestor?.split(" ")[2] ?? "on"}` : "· off") : ""}</span>
          </div>
          <p className="side-foot">Pulse never holds funds or executes trades. You sign every move on Jupiter. Not financial advice.</p>
        </aside>

        <div className="scrim" onClick={() => setOpen(false)} aria-hidden />
        <main className="main2">{children}</main>
      </div>

      <form className="askbar" onSubmit={onAsk}>
        <span className="ask-mode" title="Requests are matched by keywords, so this works without an AI key">Keyword</span>
        <input aria-label="Ask Pulse" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={askNote || "Ask Pulse: “check WIF”, “show serial launchers”, “what's trending?”"} />
        <button type="submit" aria-label="Send" disabled={!ask.trim()}>➤</button>
      </form>
    </div>
  );
}
