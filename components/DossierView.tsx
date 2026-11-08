"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bandTone, clock, short } from "@/lib/format";
import type { AiBrief, Dossier } from "@/lib/types";
import { useWatchlist } from "./useWatchlist";

type ReceiptResult = { signature: string; memo: string; explorerUrl: string; cluster: string; status: string; evidenceHash: string; reused?: boolean; note?: string };
export type LedgerReceipt = { mint: string; score: number; band: string; confidence: number; hash16: string; time: number; signature: string; explorerUrl: string; cluster: string };

const TIPS: Record<string, string> = {
  "Mint authority": "If active, someone can create new tokens at any time and dilute holders.",
  "Freeze authority": "If active, someone can freeze holders' token accounts so they cannot sell.",
  "Token-2022 extensions": "Extra token features. Some (permanent delegate, transfer hooks, fees) can take or block funds.",
  "Holder concentration": "How much supply the largest wallets hold. Pools and bonding curves are excluded when resolved on chain.",
  "Exit liquidity": "What a real sell would return right now, measured with live Jupiter quotes.",
  "Liquidity vs valuation": "Pool liquidity compared to fully diluted value. Thin liquidity means large price drops on sells.",
  Age: "Time since the first pool. Most rug pulls happen in the first hours.",
  Identity: "Jupiter verification status and suspicious-token flag.",
  "Creator launch history": "How many tokens the creator wallet has launched before. Serial launchers are a common rug pattern.",
  "Creator holding": "Share of supply still held by the creator wallet.",
};

const STEPS = [
  ["Token metadata", "Jupiter · tokens/v2"],
  ["Mint authorities & extensions", "RPC · getAccountInfo"],
  ["Holder owners resolved", "RPC · getTokenLargestAccounts"],
  ["Exit routes measured", "Jupiter · swap/v2/order ×3"],
  ["Creator history", "Jupiter · audit"],
];

export default function DossierView({ query }: { query: string }) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState("");
  const [brief, setBrief] = useState<AiBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const requestId = useRef(0);
  const { has, toggle, update } = useWatchlist();
  const [receipt, setReceipt] = useState<ReceiptResult | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [anchorError, setAnchorError] = useState("");
  const [history, setHistory] = useState<LedgerReceipt[]>([]);
  const [receiptCluster, setReceiptCluster] = useState("devnet");

  async function loadHistory(mint: string) {
    try {
      const b = await fetch(`/api/ledger?mint=${mint}`).then((r) => r.json());
      if (b.cluster) setReceiptCluster(b.cluster);
      setHistory(b.receipts ?? []);
    } catch {
      setHistory([]);
    }
  }

  async function anchor() {
    if (!dossier) return;
    setAnchoring(true);
    setAnchorError("");
    try {
      const res = await fetch("/api/attest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          mint: dossier.mint,
          evidenceHash: dossier.evidenceHash,
          sealed: dossier.seal ? { score: dossier.verdict.score, band: dossier.verdict.band, confidence: dossier.verdict.confidence, issuedAt: dossier.seal.issuedAt, seal: dossier.seal.value } : undefined,
        }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Receipt unavailable");
      setReceipt(body);
      if (body.cluster) setReceiptCluster(body.cluster);
      // Keep the evidence bundle locally so the Ledger page can verify this receipt.
      if (body.evidenceHash === dossier.evidenceHash) {
        try {
          localStorage.setItem(`pulse.bundle.${dossier.evidenceHash.slice(0, 16)}`, JSON.stringify({ mint: dossier.mint, symbol: dossier.symbol, evidenceHash: dossier.evidenceHash, evidence: dossier.evidence }));
        } catch {
          /* storage blocked */
        }
      }
      setTimeout(() => void loadHistory(dossier.mint), 2500);
    } catch (e) {
      setAnchorError((e as Error).message);
    } finally {
      setAnchoring(false);
    }
  }

  useEffect(() => {
    const id = ++requestId.current;
    setDossier(null);
    setBrief(null);
    setError("");
    setReceipt(null);
    setAnchorError("");
    setHistory([]);
    (async () => {
      try {
        const res = await fetch("/api/dossier", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
        const body = await res.json();
        if (id !== requestId.current) return;
        if (!res.ok) throw new Error(body.error ?? "Investigation failed");
        const d = body as Dossier;
        setDossier(d);
        document.title = `${d.symbol} — ${d.verdict.band} · Pulse`;
        // Keep the URL shareable: a symbol search lands on the canonical mint URL.
        if (query !== d.mint) window.history.replaceState(null, "", `/token/${d.mint}`);
        update(d.mint, { score: d.verdict.score, band: d.verdict.band });
        void loadHistory(d.mint);
        setBriefLoading(true);
        const b = await fetch("/api/brief", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ evidence: d.evidence, verdict: d.verdict, name: d.name, symbol: d.symbol }),
        }).then((r) => r.json());
        if (id === requestId.current) setBrief(b.brief ?? null);
      } catch (e) {
        if (id === requestId.current) setError((e as Error).message);
      } finally {
        if (id === requestId.current) setBriefLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function cite(id: string) {
    setHighlight(id);
    document.getElementById(`ev-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlight(null), 2200);
  }

  function downloadEvidence() {
    if (!dossier) return;
    const bundle = { mint: dossier.mint, observedAt: dossier.observedAt, evidenceHash: dossier.evidenceHash, methodVersion: dossier.verdict.methodVersion, verdict: dossier.verdict, evidence: dossier.evidence };
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-${dossier.symbol}-${dossier.evidenceHash.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  if (error)
    return (
      <div className="page">
        <Link href="/" className="crumb">← Radar</Link>
        <div className="notice">{error}</div>
        <p className="muted">Try pasting the full mint address, or pick a token from the radar.</p>
      </div>
    );

  if (!dossier)
    return (
      <div className="page">
        <Link href="/" className="crumb">← Radar</Link>
        <div className="panel">
          <div className="section-kicker">INVESTIGATING {short(query)}</div>
          {STEPS.map(([s, src], i) => (
            <div className="trace" key={s} style={{ animationDelay: `${i * 0.7}s` }}>
              <span className="trace-mark pending">…</span>
              <div><strong>{s}</strong><span className="trace-meta">{src}</span></div>
            </div>
          ))}
          <p className="fineprint">Live quotes are rate-limited, so the full dossier takes a few seconds.</p>
        </div>
      </div>
    );

  const v = dossier.verdict;
  const watching = has(dossier.mint);
  const ok3 = dossier.ladder.filter((r) => r.status === "quoted" && (r.impactPct ?? 99) <= 3).map((r) => r.sizeUsd);
  const ok10 = dossier.ladder.filter((r) => r.status === "quoted" && (r.impactPct ?? 99) <= 10).map((r) => r.sizeUsd);

  return (
    <div className="page">
      <div className="crumb-row">
        <Link href="/" className="crumb">← Radar</Link>
        <div className="crumb-actions">
          <button className={`secondary-button ${watching ? "on" : ""}`} onClick={() => toggle({ mint: dossier.mint, symbol: dossier.symbol, name: dossier.name, icon: dossier.icon, score: v.score, band: v.band })}>
            {watching ? "★ WATCHING" : "☆ WATCH"}
          </button>
          <button className="secondary-button" onClick={copyLink}>{copied ? "LINK COPIED" : "COPY LINK"}</button>
        </div>
      </div>

      <div className="verdict">
        <div className="verdict-head">
          <div>
            <div className="section-kicker">
              VERDICT <span className="chip">{dossier.mode}</span>
              {dossier.launchpad && <span className="chip">{dossier.launchpad}</span>}
              <span className="muted">{clock(dossier.observedAt)}</span>
            </div>
            <h2>
              {dossier.icon && <img className="verdict-icon" src={dossier.icon} alt="" width={34} height={34} referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />}
              {dossier.name} <span>{dossier.symbol}</span>
            </h2>
            <a className="mint" href={`https://explorer.solana.com/address/${dossier.mint}`} target="_blank" rel="noopener noreferrer">{dossier.mint} ↗</a>
          </div>
          <div className={`score ${bandTone(v.band)}`}>
            <span>{v.band === "Insufficient data" ? "—" : v.score}</span>
            <small>/ 100 RISK</small>
          </div>
        </div>
        <div className="scorebar"><span style={{ width: `${v.band === "Insufficient data" ? 0 : v.score}%` }} /></div>
        <div className="verdict-meta">
          <div><span className="label">BAND</span><strong className={bandTone(v.band)}>{v.band}{v.limitedData && v.band !== "Insufficient data" ? " · limited data" : ""}</strong></div>
          <div><span className="label" title="How much of the signal came from direct chain reads versus third-party or heuristic data">CONFIDENCE</span><strong>{Math.round(v.confidence * 100)}%</strong></div>
          <div><span className="label" title="Share of factor weight that had data">COVERAGE</span><strong>{Math.round(v.coverage * 100)}%</strong></div>
        </div>
        {v.criticalFlags.length > 0 && <div className="flags">{v.criticalFlags.map((f) => <span key={f}>⚠ {f}</span>)}</div>}
        {v.disagreements.map((d) => <div className="disagree" key={d}>⇄ {d}</div>)}
        <p className="fineprint verdict-disclaimer">A lower score means fewer warning signs were found, not that a token is protected from loss. Not financial advice.</p>
      </div>

      <div className="two-col">
        <article className="panel">
          <div className="panel-head">
            <div>
              <div className="section-kicker">AI BRIEF</div>
              <h3>{brief ? brief.label : briefLoading ? "Analysing evidence…" : "Brief unavailable"}</h3>
            </div>
            {brief && <span className="chip">{brief.label === "Rule-based explanation" ? "NO LLM" : "CLAIMS CHECKED"}</span>}
          </div>
          {briefLoading && !brief && <div className="skeleton-text"><span /><span /><span /></div>}
          {brief && (
            <>
              <p className="summary">{brief.summary}</p>
              {brief.findings.map((f) => (
                <div className="finding" key={f.headline + f.evidenceIds.join()}>
                  <span className={`severity ${f.severity}`} />
                  <div>
                    <strong>{f.headline}</strong>
                    <p>{f.explanation.replace(/\s*\[E\d+\]/g, "")}</p>
                    <div className="citations">{f.evidenceIds.map((id) => <button key={id} onClick={() => cite(id)}>[{id}]</button>)}</div>
                  </div>
                </div>
              ))}
              {brief.removedClaims > 0 && <p className="fineprint warn-text">{brief.removedClaims} unverifiable claim{brief.removedClaims > 1 ? "s" : ""} removed by the verifier.</p>}
              {brief.note && <p className="fineprint">{brief.note}</p>}
              <p className="beginner"><span className="label">FOR NEW TRADERS</span>{brief.beginnerNote}</p>
            </>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <div className="section-kicker">EXIT LADDER</div>
              <h3>What a sell returns right now</h3>
            </div>
            <span className="chip">JUPITER · LIVE</span>
          </div>
          <div className="ladder">
            <div className="ladder-row head"><span>SELL</span><span>YOU GET</span><span>IMPACT</span></div>
            {dossier.ladder.length === 0 && <p className="fineprint">No reference price, so the ladder could not be sized.</p>}
            {dossier.ladder.map((r) => (
              <button className="ladder-row" key={r.sizeUsd} onClick={() => cite(r.evidenceId)} title={r.route ? `Route: ${r.route}` : undefined}>
                <strong>${r.sizeUsd.toLocaleString("en-US")}</strong>
                <span>{r.status === "quoted" ? `$${r.outputUsd!.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : r.status === "no route" ? "No route" : r.status === "curve only" ? "Curve only" : "Unavailable"}</span>
                <span className={`impact ${r.status !== "quoted" ? "bad" : (r.impactPct ?? 0) > 10 ? "bad" : (r.impactPct ?? 0) > 3 ? "warn" : "ok"}`}>{r.status === "quoted" ? `${r.impactPct!.toFixed(2)}%` : "—"}</span>
              </button>
            ))}
          </div>
          {dossier.ladder.some((r) => r.status === "curve only") && (
            <p className="fineprint warn-text">Still on the {dossier.launchpad} bonding curve (heuristic): Jupiter can't route it yet, so sells go through the launchpad and exit depth can't be measured here.</p>
          )}
          <p className="fineprint">
            Point-in-time quotes from Jupiter, not predictions. Exit capacity: {ok3.length ? `$${Math.max(...ok3).toLocaleString("en-US")}` : "none"} at ≤3% impact, {ok10.length ? `$${Math.max(...ok10).toLocaleString("en-US")}` : "none"} at ≤10%.
          </p>
          <div className="trade-box">
            <a className="primary-button" href={dossier.jupiterUrl} target="_blank" rel="noopener noreferrer">OPEN IN JUPITER ↗</a>
            <span className="fineprint">You trade and sign on Jupiter. Pulse never holds funds or executes swaps.</span>
          </div>
        </article>
      </div>

      <article className="panel factors">
        <div className="section-kicker">SCORE BREAKDOWN · {v.methodVersion} · <Link href="/methodology" className="inline-link">how scoring works</Link></div>
        <div className="factor-table">
          {v.factors.map((f) => (
            <div className="factor-row" key={f.name}>
              <span className="factor-name" title={TIPS[f.name]}>{f.name} <span className="tip">ⓘ</span></span>
              <span className="factor-value">{f.value}</span>
              <span className="factor-bar"><span style={{ width: `${f.severity * 100}%` }} className={f.severity >= 0.8 ? "bad" : f.severity >= 0.4 ? "warn" : "ok"} /></span>
              <span className="factor-weight">{f.contribution.toFixed(1)}/{f.weight}</span>
              <span className={`source ${f.source}`}>{f.evidenceIds.map((id) => <button key={id} onClick={() => cite(id)}>{id}</button>)} {f.source}</span>
            </div>
          ))}
          {v.unknowns.map((u) => <div className="factor-row unknown" key={u}><span className="factor-name">{u}</span></div>)}
        </div>
      </article>

      <article className="panel evidence-panel">
        <div className="panel-head">
          <div>
            <div className="section-kicker">EVIDENCE LEDGER</div>
            <h3>{dossier.evidence.length} observations</h3>
          </div>
          <button className="secondary-button" onClick={downloadEvidence}>DOWNLOAD JSON ↓</button>
        </div>
        <div className="evidence-table">
          {dossier.evidence.map((item) => (
            <div className={`evidence-row ${highlight === item.id ? "hl" : ""}`} id={`ev-${item.id}`} key={item.id}>
              <span className="evidence-id">{item.id}</span>
              <span><strong>{item.label}</strong><small>{item.method}</small></span>
              <span className="evidence-value">{String(item.value)}</span>
              <span className={`source ${item.source}`}>{item.explorerUrl ? <a href={item.explorerUrl} target="_blank" rel="noopener noreferrer">{item.source} ↗</a> : item.source}</span>
            </div>
          ))}
        </div>
        <div className="trace-strip">
          {dossier.trace.map((t) => <span key={t.step} className={t.status === "ok" ? "" : "bad"}>{t.status === "ok" ? "✓" : "✕"} {t.step} · {t.ms}ms</span>)}
        </div>
        <div className="hash-row">
          <span title="SHA-256 of the canonical evidence (values, not timestamps). Same chain state → same hash.">SHA-256 EVIDENCE HASH</span>
          <code>{dossier.evidenceHash}</code>
        </div>
      </article>

      <article className="panel receipt-panel" id="receipt">
        <div className="panel-head">
          <div>
            <div className="section-kicker">ON-CHAIN RECEIPT <span className="chip">SOLANA {receiptCluster.toUpperCase()}</span></div>
            <h3>Anchor this verdict on Solana</h3>
            <p className="muted small">Writes a Memo transaction with the score, band, confidence and the first 16 hex of the evidence hash. Anyone can read it back and check the evidence. A receipt proves what Pulse said and when, not that it was right.</p>
          </div>
          <button className="primary-button anchor-btn" onClick={anchor} disabled={anchoring || Boolean(receipt)}>
            {anchoring ? "WRITING TO SOLANA…" : receipt ? "✓ ANCHORED" : "ANCHOR ON SOLANA ↗"}
          </button>
        </div>
        {anchorError && <div className="notice inline-notice">{anchorError}</div>}
        {receipt && (
          <div className="receipt-box">
            <div><span className="label">TRANSACTION</span><a href={receipt.explorerUrl} target="_blank" rel="noopener noreferrer" className="mono inline-link">{short(receipt.signature)} ↗</a> <span className={`chip ${receipt.status === "confirmed" ? "" : "demo"}`}>{receipt.status.toUpperCase()}</span>{receipt.reused && <span className="muted small"> already anchored for this evidence</span>}</div>
            <div><span className="label">MEMO ON CHAIN</span><code className="memo">{receipt.memo}</code></div>
            {receipt.note && <p className="fineprint warn-text">{receipt.note}</p>}
            <p className="fineprint">The evidence bundle was saved in this browser so the <Link href="/ledger" className="inline-link">Ledger</Link> can verify it. You can also download it above.</p>
          </div>
        )}
        {history.length > 0 && (
          <div className="history">
            <span className="label">PREVIOUS RECEIPTS FOR THIS TOKEN (READ FROM CHAIN)</span>
            {history.slice(0, 5).map((h) => (
              <a key={h.signature} href={h.explorerUrl} target="_blank" rel="noopener noreferrer" className="history-row">
                <span className="mono">{new Date(h.time * 1000).toLocaleString()}</span>
                <span className={bandTone(h.band)}>{h.score}/100 · {h.band}</span>
                <span className="mono muted">h={h.hash16}</span>
                <span className="mono">{short(h.signature)} ↗</span>
              </a>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
