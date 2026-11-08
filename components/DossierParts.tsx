"use client";
// Presentational pieces of the token page: step checklist, AI brief, receipt card.
import Link from "next/link";
import { useEffect, useState } from "react";
import { bandTone, short } from "@/lib/format";
import { BAND_CODE, parseReceiptMemo } from "@/lib/receipt";
import type { Band } from "@/lib/types";

// Rebuilds the on-chain memo text from a parsed ledger entry (same fields, same order).
export function memoFromLedger(r: { cluster: string; subject?: string; method?: string; mint: string; score: number; band: string; confidence: number; hash16: string; time: number }) {
  return `pulse/1 c=${r.cluster} n=${r.subject ?? "mainnet"} v=${r.method ?? "pulse-risk/2"} m=${r.mint} s=${r.score} b=${BAND_CODE[r.band as Band] ?? "I"} k=${r.confidence.toFixed(2)} h=${r.hash16} t=${r.time}`;
}
import type { AiBrief, Dossier } from "@/lib/types";

/* ---------- Dev-only state forcing: /token/X?mock=steps-slow etc. ---------- */
export function useMock(): string {
  const [mock, setMock] = useState("");
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    setMock(new URLSearchParams(window.location.search).get("mock") ?? "");
  }, []);
  return mock;
}

/* ---------- Steps ---------- */
export type StepState = "done" | "running" | "fallback" | "failed";
export type Step = { name: string; source: string; state: StepState; reason?: string; ms?: number };

export const STEP_DEFS: [string, string][] = [
  ["Token metadata", "Jupiter · tokens/v2"],
  ["Mint authorities & extensions", "Solana RPC · getAccountInfo"],
  ["Holder owners resolved", "Solana RPC · getTokenLargestAccounts"],
  ["Exit routes measured", "Jupiter · swap/v2/order ×3"],
  ["Creator history", "Jupiter · audit"],
];

// Turns the server trace + evidence into honest per-step states.
export function stepsFromDossier(d: Dossier): Step[] {
  const t = (name: string) => d.trace.find((x) => x.step === name);
  const ev = (id: string) => d.evidence.find((e) => e.id === id);
  const steps: Step[] = [];
  const meta = t("Token metadata");
  steps.push(
    meta?.status === "unavailable"
      ? { name: STEP_DEFS[0][0], source: STEP_DEFS[0][1], state: "fallback", reason: "Not indexed by Jupiter yet; using chain data only.", ms: meta.ms }
      : { name: STEP_DEFS[0][0], source: STEP_DEFS[0][1], state: "done", ms: meta?.ms },
  );
  const mint = t("Mint authorities & extensions");
  steps.push(
    mint?.status === "ok"
      ? { name: STEP_DEFS[1][0], source: STEP_DEFS[1][1], state: "done", ms: mint.ms }
      : ev("E1")
        ? { name: STEP_DEFS[1][0], source: STEP_DEFS[1][1], state: "fallback", reason: "Solana RPC didn't answer; using Jupiter's audit flags.", ms: mint?.ms }
        : { name: STEP_DEFS[1][0], source: STEP_DEFS[1][1], state: "failed", reason: "Couldn't read the mint from Solana RPC.", ms: mint?.ms },
  );
  const holders = t("Holder owners resolved");
  const e4 = ev("E4");
  steps.push(
    holders?.status === "ok" && e4?.source === "derived"
      ? { name: STEP_DEFS[2][0], source: STEP_DEFS[2][1], state: "done", ms: holders.ms }
      : e4
        ? { name: STEP_DEFS[2][0], source: STEP_DEFS[2][1], state: "fallback", reason: "Using Jupiter's holder figure; owners not resolved (needs a keyed RPC).", ms: holders?.ms }
        : { name: STEP_DEFS[2][0], source: STEP_DEFS[2][1], state: "fallback", reason: "Holder data not available for this token.", ms: holders?.ms },
  );
  const exit = t("Exit routes measured");
  const curve = d.ladder.some((r) => r.status === "curve only");
  steps.push(
    exit?.status === "ok"
      ? curve
        ? { name: STEP_DEFS[3][0], source: STEP_DEFS[3][1], state: "fallback", reason: "Still on its bonding curve; Jupiter can't route it yet.", ms: exit.ms }
        : { name: STEP_DEFS[3][0], source: STEP_DEFS[3][1], state: "done", ms: exit.ms }
      : d.ladder.length === 0 && exit?.source.includes("no reference price")
        ? { name: STEP_DEFS[3][0], source: STEP_DEFS[3][1], state: "fallback", reason: "No reference price, so sell sizes can't be set." }
        : { name: STEP_DEFS[3][0], source: STEP_DEFS[3][1], state: "failed", reason: "Jupiter didn't return quotes (likely rate-limited).", ms: exit?.ms },
  );
  steps.push(
    ev("E11")
      ? { name: STEP_DEFS[4][0], source: STEP_DEFS[4][1], state: "done" }
      : { name: STEP_DEFS[4][0], source: STEP_DEFS[4][1], state: "fallback", reason: "Jupiter has no creator data for this token." },
  );
  return steps;
}

const MARK: Record<StepState, string> = { done: "✓", running: "", fallback: "◐", failed: "✕" };

export function StepList({ steps, onRetry, slow, elapsed }: { steps: Step[]; onRetry?: () => void; slow?: boolean; elapsed?: number }) {
  return (
    <div className="steps-list" aria-live="polite">
      {steps.map((s) => (
        <div className={`step-row ${s.state}`} key={s.name}>
          <span className={`step-mark ${s.state}`} aria-label={s.state}>{s.state === "running" ? <span className="spinner" /> : MARK[s.state]}</span>
          <div className="step-body">
            <strong>{s.name}</strong>
            <span className="trace-meta">{s.source}</span>
            {s.reason && <span className={`step-reason ${s.state}`}>{s.reason}</span>}
          </div>
          <span className="step-time">{s.state === "running" ? `${elapsed ?? 0}s` : s.ms !== undefined ? `${(s.ms / 1000).toFixed(1)}s` : ""}</span>
          {s.state === "failed" && onRetry && <button className="secondary-button step-retry" onClick={onRetry}>RETRY</button>}
        </div>
      ))}
      {slow && (
        <div className="slow-note" role="status">
          Taking longer than usual. Jupiter may be rate-limiting.
          {onRetry && <button className="secondary-button" onClick={onRetry}>RETRY</button>}
        </div>
      )}
    </div>
  );
}

/* ---------- AI brief ---------- */
const CANT_TELL = [
  "Where the price goes next, or whether anyone will buy.",
  "The team's intentions or anything said off-chain.",
  "Whether a low score makes a token safe — it only means fewer warning signs were found.",
];

export function BriefPanel({ brief, loading, dossier, onCite }: { brief: AiBrief | null; loading: boolean; dossier: Dossier; onCite: (id: string) => void }) {
  const v = dossier.verdict;
  const clear = v.factors.filter((f) => f.severity === 0);
  const notMeasured = v.unknowns.map((u) => {
    const i = u.indexOf(":");
    return i > 0 ? { name: u.slice(0, i), reason: u.slice(i + 1).trim().replace(/^data unavailable$/, "data source didn't respond or has no data") } : { name: u, reason: "" };
  });
  const ai = brief?.label === "AI analyst (verified)";
  const checked = brief ? brief.findings.length + brief.removedClaims : 0;
  // The rule-based summary lists checked-and-clear factors as "No signal from"; that list is shown below instead.
  const summary = brief ? (ai ? brief.summary : brief.summary.replace(/\s*No signal from:[^.]*\.?/, "").trim()) : "";
  const chip = (id: string) => (
    <button key={id} className="ev-chip" onClick={() => onCite(id)} aria-label={`Show evidence ${id}`}>{id}</button>
  );

  return (
    <article className="panel brief-panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">AI BRIEF</div>
          <h3>{brief ? (ai ? "Evidence-bound analysis" : "Rule-based explanation") : loading ? "Analysing evidence…" : "Brief unavailable"}</h3>
        </div>
        {brief &&
          (ai ? (
            <span className="badge ai" title="Written by an AI model from the evidence ledger only; every claim was machine-checked before display.">AI · verified</span>
          ) : (
            <span className="badge neutral" title="This deployment explains the score with fixed rules instead of an AI model. Same evidence, same checks.">Rule-based</span>
          ))}
      </div>
      {brief && ai && (
        <p className="verifier-line">
          {checked} claim{checked === 1 ? "" : "s"} checked · {brief.removedClaims} removed{brief.removedClaims ? " (unsupported by evidence)" : ""}
          {brief.model ? ` · ${brief.model}` : ""}
        </p>
      )}
      {loading && !brief && <div className="skeleton-text tall"><span /><span /><span /><span /><span /></div>}
      {!loading && !brief && <p className="muted">The brief couldn&apos;t be generated right now. The score and evidence below are unaffected.</p>}
      {brief && (
        <>
          {summary && <p className="summary">{summary}</p>}

          <h4 className="brief-h">What we found</h4>
          {brief.findings.length === 0 && <p className="muted small">No factor raised a warning signal.</p>}
          {brief.findings.map((f) => (
            <div className="finding" key={f.headline + f.evidenceIds.join()}>
              <span className={`severity ${f.severity}`} aria-label={`${f.severity} severity`} />
              <div>
                <strong>{f.headline}</strong>
                <p>{f.explanation.replace(/\s*\[E\d+\]/g, "")}</p>
                <div className="citations">{f.evidenceIds.map(chip)}</div>
              </div>
            </div>
          ))}

          {clear.length > 0 && (
            <>
              <h4 className="brief-h ok">Checked and clear</h4>
              <ul className="clear-list">
                {clear.map((f) => (
                  <li key={f.name}>
                    <span className="ok">✓</span> <span>{f.name}: <span className="muted">{f.value}</span></span> {f.evidenceIds.map(chip)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {notMeasured.length > 0 && (
            <>
              <h4 className="brief-h warn">Not measured</h4>
              <ul className="clear-list">
                {notMeasured.map((n) => (
                  <li key={n.name}>
                    <span className="warn">◐</span> <span>{n.name}{n.reason && <span className="muted">: {n.reason}</span>}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h4 className="brief-h">What this can&apos;t tell you</h4>
          <ul className="cant-list">{CANT_TELL.map((c) => <li key={c}>{c}</li>)}</ul>
          {brief.removedClaims > 0 && !ai && <p className="fineprint warn-text">{brief.removedClaims} unverifiable claim{brief.removedClaims > 1 ? "s" : ""} removed by the verifier.</p>}
          <p className="beginner"><span className="label">FOR NEW TRADERS</span>{brief.beginnerNote}</p>
        </>
      )}
    </article>
  );
}

/* ---------- Receipt card ---------- */
export type ReceiptResult = { signature: string; memo: string; explorerUrl: string; cluster: string; status: string; evidenceHash: string; reused?: boolean; note?: string };
export type ReceiptUi =
  | { kind: "idle" }
  | { kind: "anchoring" }
  | { kind: "success"; r: ReceiptResult }
  | { kind: "existing"; r: ReceiptResult }
  | { kind: "error"; title: string; detail: string };

const BAND_WORD: Record<string, string> = { L: "Low signals", M: "Moderate", E: "Elevated", H: "High", I: "Insufficient data" };

export function receiptError(status: number, message: string, cluster = "devnet"): ReceiptUi {
  const net = cluster === "mainnet-beta" ? "mainnet" : cluster;
  if (/no attestor key/i.test(message)) return { kind: "error", title: "Receipts are switched off here", detail: "This deployment has no receipt wallet configured, so nothing can be written to Solana." };
  if (/needs|fund/i.test(message))
    return { kind: "error", title: `Receipt wallet needs ${net} SOL`, detail: net === "devnet" ? "The wallet that pays for receipts is empty. It can be topped up for free from the Solana devnet faucet." : "The wallet that pays for receipts is empty. It needs a small top-up of SOL to keep writing receipts." };
  if (status === 429) return { kind: "error", title: "Too many receipts just now", detail: "Receipts are limited to a few per minute. Wait a moment, then retry." };
  if (/changed|unavailable|recompute/i.test(message) && status === 502) return { kind: "error", title: "Couldn't recompute the verdict", detail: "Market data sources didn't respond, so Pulse won't anchor a score it can't re-check. Retry in a few seconds." };
  return { kind: "error", title: `Couldn't reach Solana ${net}`, detail: "The transaction wasn't sent. Nothing was written. Retry in a few seconds." };
}

function DecodedMemo({ r }: { r: ReceiptResult }) {
  const p = parseReceiptMemo(r.memo);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(r.signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div className="receipt-box">
      {p && (
        <dl className="memo-grid">
          <div><dt>Score</dt><dd className={bandTone(p.band)}>{p.score}/100 · {BAND_WORD[p.band[0]] ?? p.band}</dd></div>
          <div><dt>Confidence</dt><dd>{Math.round(p.confidence * 100)}%</dd></div>
          <div><dt>Token network</dt><dd>Solana {p.subject ?? "mainnet"}</dd></div>
          <div><dt>Receipt network</dt><dd>Solana {p.cluster}</dd></div>
          <div><dt>Written</dt><dd>{new Date(p.time * 1000).toLocaleString()}</dd></div>
          <div><dt>Evidence hash</dt><dd className="mono">{p.hash16}…</dd></div>
        </dl>
      )}
      <div className="sig-row">
        <span className="label">SIGNATURE</span>
        <code className="mono sig">{short(r.signature)}</code>
        <button className="secondary-button" onClick={copy}>{copied ? "COPIED" : "COPY"}</button>
      </div>
      <div className="receipt-actions">
        <a className="primary-button" href={r.explorerUrl} target="_blank" rel="noopener noreferrer">VIEW ON EXPLORER ↗</a>
        <Link className="secondary-button" href={`/ledger?sig=${r.signature}`}>OPEN IN LEDGER</Link>
      </div>
      <details className="raw-memo"><summary>Raw memo on chain</summary><code className="memo">{r.memo}</code></details>
    </div>
  );
}

export function ReceiptCard({ ui, cluster, onAnchor }: { ui: ReceiptUi; cluster: string; onAnchor: () => void }) {
  return (
    <article className="panel receipt-panel" id="receipt" aria-live="polite">
      <div className="panel-head">
        <div>
          <div className="section-kicker">ON-CHAIN RECEIPT <span className="chip">SOLANA {cluster.toUpperCase()}</span></div>
          <h3>
            {ui.kind === "success" ? "Anchored on Solana" : ui.kind === "existing" ? "Already anchored" : ui.kind === "anchoring" ? "Writing to Solana…" : "Anchor this verdict on Solana"}
          </h3>
          <p className="small receipt-lede">A receipt proves what Pulse said and when, not that it was right.</p>
        </div>
        {(ui.kind === "idle" || ui.kind === "anchoring") && (
          <button className="primary-button anchor-btn" onClick={onAnchor} disabled={ui.kind === "anchoring"}>
            {ui.kind === "anchoring" ? <><span className="spinner dark" /> WRITING…</> : "ANCHOR ON SOLANA ↗"}
          </button>
        )}
      </div>
      {ui.kind === "idle" && <p className="small muted">Writes one Memo transaction with the score, band, confidence and evidence hash. Anyone can read it back and verify it.</p>}
      {ui.kind === "anchoring" && <p className="small">Writing to Solana {cluster}… this usually confirms in a few seconds.</p>}
      {ui.kind === "error" && (
        <div className="receipt-error" role="alert">
          <strong>{ui.title}</strong>
          <p>{ui.detail}</p>
          <button className="secondary-button" onClick={onAnchor}>RETRY</button>
        </div>
      )}
      {ui.kind === "existing" && <p className="small muted">This exact evidence was already anchored, so no new transaction was needed.</p>}
      {(ui.kind === "success" || ui.kind === "existing") && (
        <>
          {ui.r.note && <p className="fineprint warn-text">{ui.r.note}</p>}
          <DecodedMemo r={ui.r} />
        </>
      )}
    </article>
  );
}
