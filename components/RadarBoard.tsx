"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { age, clock, usd } from "@/lib/format";
import type { RadarToken } from "@/lib/types";

type Feed = "new" | "trending";
type Filter = "all" | "clean" | "serial" | "flagged";

const COPY: Record<Feed, { kicker: string; title: string; lede: string; every: number }> = {
  new: { kicker: "LIVE · REFRESHES EVERY 20s", title: "New launches", lede: "Tokens minted in the last few minutes across pump.fun, Meteora, LaunchLab and more. Most launches here are created by repeat deployers. Open any token for the full dossier before you trade.", every: 20_000 },
  trending: { kicker: "LIVE · REFRESHES EVERY 60s", title: "Trending, last hour", lede: "Where volume is moving right now. Trending is not the same as low-risk: check the creator, holders and exit depth.", every: 60_000 },
};

export default function RadarBoard({ feed }: { feed: Feed }) {
  const [tokens, setTokens] = useState<RadarToken[] | null>(null);
  const [mode, setMode] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const copy = COPY[feed];

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/radar?feed=${feed}`);
      const body = await res.json();
      if (!body.tokens) throw new Error(body.error ?? "Feed unavailable");
      setTokens(body.tokens);
      setMode(body.mode);
      setObservedAt(body.observedAt);
      setError(body.mode === "UNAVAILABLE" ? "Jupiter feed unavailable right now. Retrying automatically." : "");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [feed]);

  useEffect(() => {
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), copy.every);
    return () => clearInterval(t);
  }, [load, copy.every]);

  const stats = useMemo(() => {
    if (!tokens?.length) return null;
    const serial = tokens.filter((t) => (t.creatorLaunches ?? 0) >= 50).length;
    const off = tokens.filter((t) => t.authoritiesOff).length;
    const flagged = tokens.filter((t) => t.quick.some((q) => q.tone === "bad")).length;
    const ages = tokens.map((t) => t.ageMinutes).filter((m): m is number => m !== null).sort((a, b) => a - b);
    return { n: tokens.length, serial, off, flagged, medianAge: ages.length ? ages[Math.floor(ages.length / 2)] : null };
  }, [tokens]);

  const shown = useMemo(() => {
    if (!tokens) return null;
    if (filter === "serial") return tokens.filter((t) => (t.creatorLaunches ?? 0) >= 50);
    if (filter === "flagged") return tokens.filter((t) => t.quick.some((q) => q.tone !== "ok"));
    if (filter === "clean") return tokens.filter((t) => t.authoritiesOff && (t.creatorLaunches ?? 0) < 10 && !t.quick.some((q) => q.tone !== "ok"));
    return tokens;
  }, [tokens, filter]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">{copy.kicker}</div>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
        </div>
        <div className="page-meta">
          {mode && <span className={`chip ${mode === "UNAVAILABLE" ? "demo" : ""}`}>{mode}</span>}
          {observedAt && <span className="muted mono">Jupiter · {clock(observedAt)}</span>}
        </div>
      </header>

      <section className="stat-grid" aria-label="Feed summary">
        <div className="stat"><span className="label">TOKENS IN FEED</span><strong>{stats?.n ?? "—"}</strong><small>{feed === "new" ? `median age ${age(stats?.medianAge ?? null)}` : "last hour"}</small></div>
        <div className="stat"><span className="label">SERIAL LAUNCHERS</span><strong className="bad">{stats ? `${stats.serial}` : "—"}</strong><small>creator launched 50+ tokens</small></div>
        <div className="stat"><span className="label">AUTHORITIES OFF</span><strong className="ok">{stats ? `${stats.off}` : "—"}</strong><small>mint and freeze disabled</small></div>
        <div className="stat"><span className="label">RED FLAGS</span><strong className="warn">{stats ? `${stats.flagged}` : "—"}</strong><small>serial launcher, live authority or flagged</small></div>
      </section>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Filter tokens">
          {(["all", "clean", "serial", "flagged"] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "clean" ? "Fewer flags" : f === "serial" ? "Serial launchers" : "Any warning"}
            </button>
          ))}
        </div>
        <span className="muted mono">Quick screen from Jupiter data. Open a token for the full check.</span>
      </div>

      {error && <div className="notice">{error}</div>}

      <div className="table" role="table" aria-label={copy.title}>
        <div className="tr th" role="row">
          <span role="columnheader">TOKEN</span>
          <span role="columnheader">AGE</span>
          <span role="columnheader">MCAP</span>
          <span role="columnheader">LIQUIDITY</span>
          <span role="columnheader">1H</span>
          <span role="columnheader">CREATOR</span>
          <span role="columnheader">SIGNALS</span>
        </div>
        {!shown && Array.from({ length: 10 }).map((_, i) => <div key={i} className="tr skeleton" />)}
        {shown?.map((t) => (
          <Link key={t.mint} href={`/token/${t.mint}`} className="tr" role="row">
            <span className="token-id" role="cell">
              {t.icon ? <img src={t.icon} alt="" width={30} height={30} loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <span className="token-blank" />}
              <span>
                <strong>{t.symbol}</strong>
                <small>{t.name.slice(0, 26)}{t.launchpad ? ` · ${t.launchpad}` : ""}</small>
              </span>
            </span>
            <span role="cell" className="mono" data-label="Age">{age(t.ageMinutes)}</span>
            <span role="cell" className="mono" data-label="Mcap">{usd(t.mcap)}</span>
            <span role="cell" className="mono" data-label="Liq">{usd(t.liquidity)}</span>
            <span role="cell" className={`mono ${t.priceChange1h === undefined ? "muted" : t.priceChange1h >= 0 ? "ok" : "bad"}`} data-label="1h">
              {t.priceChange1h === undefined ? "—" : `${t.priceChange1h >= 0 ? "+" : ""}${t.priceChange1h.toFixed(1)}%`}
            </span>
            <span role="cell" className={`mono ${(t.creatorLaunches ?? 0) >= 50 ? "bad" : (t.creatorLaunches ?? 0) >= 10 ? "warn" : ""}`} data-label="Creator">
              {t.creatorLaunches === undefined ? "—" : `${t.creatorLaunches.toLocaleString("en-US")} launch${t.creatorLaunches === 1 ? "" : "es"}`}
            </span>
            <span role="cell" className="radar-flags">
              {t.quick.slice(0, 3).map((q) => <span key={q.label} className={`flag ${q.tone}`}>{q.label}</span>)}
            </span>
          </Link>
        ))}
        {shown && shown.length === 0 && <p className="empty-row">No tokens match this filter right now.</p>}
      </div>
    </div>
  );
}
