"use client";
import Link from "next/link";
import { DragEvent, useCallback, useEffect, useState } from "react";
import type { LedgerReceipt } from "@/components/DossierView";
import { canonicalEvidence, sha256Hex } from "@/lib/canonical";
import { bandTone, short } from "@/lib/format";

type Ledger = { cluster: string; configured: boolean; attestor?: string; attestorUrl?: string; balanceSol?: number | null; receipts: LedgerReceipt[]; error?: string };
type Result = { state: "verified" | "mismatch" | "invalid"; computed?: string; onchain: string; message: string };
const CACHE_KEY = "pulse.ledger.last";

function ago(unix: number) {
  const s = Math.max(0, Date.now() / 1000 - unix);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function localBundle(hash16: string): { symbol?: string; text: string } | null {
  try {
    const raw = localStorage.getItem(`pulse.bundle.${hash16}`);
    if (!raw) return null;
    const b = JSON.parse(raw);
    return { symbol: b.symbol, text: JSON.stringify({ evidence: b.evidence }, null, 2) };
  } catch {
    return null;
  }
}

function Verifier({ r, autoOpen }: { r: LedgerReceipt; autoOpen: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [tampered, setTampered] = useState(false);

  useEffect(() => {
    if (!open || text) return;
    const b = localBundle(r.hash16);
    if (b) setText(b.text);
  }, [open, text, r.hash16]);

  async function verify(json = text) {
    try {
      const parsed = JSON.parse(json);
      const evidence = Array.isArray(parsed) ? parsed : parsed.evidence;
      if (!Array.isArray(evidence)) throw new Error("no evidence array");
      const hash = await sha256Hex(canonicalEvidence(evidence));
      const ok = hash.slice(0, 16) === r.hash16;
      setResult({ state: ok ? "verified" : "mismatch", computed: hash.slice(0, 16), onchain: r.hash16, message: ok ? "Evidence hash matches the receipt." : "This evidence is not what was anchored." });
    } catch {
      setResult({ state: "invalid", onchain: r.hash16, message: "That isn't a Pulse evidence file. Use DOWNLOAD JSON on the token page." });
    }
  }

  // Demo: change one value in the displayed evidence and re-verify.
  function tamper() {
    try {
      const parsed = JSON.parse(text);
      const evidence = Array.isArray(parsed) ? parsed : parsed.evidence;
      const target = evidence.find((e: { value: unknown }) => typeof e.value === "string" || typeof e.value === "number") ?? evidence[0];
      target.value = typeof target.value === "number" ? target.value + 1 : `${String(target.value)} (edited)`;
      const next = JSON.stringify(Array.isArray(parsed) ? evidence : { ...parsed, evidence }, null, 2);
      setText(next);
      setTampered(true);
      void verify(next);
    } catch {
      /* invalid json: verify shows the message */
    }
  }

  async function onDrop(e: DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const t = await f.text();
      setText(t);
      setTampered(false);
      void verify(t);
    }
  }

  async function onFile(file?: File) {
    if (!file) return;
    const t = await file.text();
    setText(t);
    setTampered(false);
    void verify(t);
  }

  if (!open) return <button className="secondary-button" onClick={() => setOpen(true)}>VERIFY</button>;
  return (
    <div className="verifier">
      <label className="small" htmlFor={`ev-${r.signature}`}>Evidence JSON — drop the downloaded file, paste it, or use the copy saved in this browser</label>
      <textarea
        id={`ev-${r.signature}`}
        className="ev-input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        placeholder='{"evidence": [ … ]}'
        spellCheck={false}
        rows={6}
      />
      <div className="verifier-actions">
        <button className="primary-button" onClick={() => void verify()} disabled={!text.trim()}>VERIFY</button>
        <label className="secondary-button upload">CHOOSE FILE<input type="file" accept="application/json,.json" onChange={(e) => void onFile(e.target.files?.[0])} /></label>
        {result?.state === "verified" && !tampered && <button className="secondary-button tamper" onClick={tamper}>TAMPER DEMO: EDIT ONE VALUE</button>}
        {tampered && (
          <button
            className="secondary-button"
            onClick={() => {
              setText("");
              setTampered(false);
              setResult(null);
            }}
          >
            RESET
          </button>
        )}
      </div>
      {!text && <p className="small muted">No copy of this evidence is saved in this browser. Open the token, press DOWNLOAD JSON, then drop the file here.</p>}
      {result && (
        <div className={`verify-result ${result.state}`} role="status">
          <strong>{result.state === "verified" ? "✓ VERIFIED" : result.state === "mismatch" ? "✕ MISMATCH" : "? NOT A PULSE FILE"}</strong>
          <span>{result.message}</span>
          {result.computed && (
            <span className="mono hash-compare">
              computed {result.computed} · on chain {result.onchain}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function LedgerPage() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [cached, setCached] = useState(false);
  const [focusSig, setFocusSig] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLedger(null);
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((b: Ledger) => {
        if (b.error) throw new Error(b.error);
        setLedger(b);
        setCached(false);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), ledger: b }));
        } catch {
          /* storage blocked */
        }
      })
      .catch((e) => {
        // Fall back to the last good copy from this browser, clearly labelled.
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const c = JSON.parse(raw);
            setLedger({ ...c.ledger, error: `Couldn't reach Solana ${c.ledger.cluster} just now. Showing the copy saved ${ago(c.at / 1000)}.` });
            setCached(true);
            return;
          }
        } catch {
          /* ignore */
        }
        setLedger({ cluster: "devnet", configured: true, receipts: [], error: String((e as Error).message || "Couldn't read the ledger.") });
      });
  }, []);

  useEffect(() => {
    load();
    setFocusSig(new URLSearchParams(window.location.search).get("sig"));
  }, [load]);

  useEffect(() => {
    if (!ledger) return;
    const map: Record<string, string> = {};
    ledger.receipts.forEach((r) => {
      const b = localBundle(r.hash16);
      if (b?.symbol) map[r.mint] = b.symbol;
    });
    setSymbols(map);
    if (focusSig) setTimeout(() => document.getElementById(`rc-${focusSig}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
  }, [ledger, focusSig]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">{cached ? "CACHED" : "READ LIVE FROM SOLANA"} {ledger ? ledger.cluster.toUpperCase() : ""}</div>
          <h1>Receipts ledger</h1>
          <p className="lede">Every verdict Pulse anchors is a Memo transaction on Solana. This page reads them from the receipt wallet&apos;s on-chain history (no database). Verify recomputes the evidence hash in your browser and compares it with the chain.</p>
        </div>
        {ledger?.attestor && (
          <div className="page-meta">
            <a href={ledger.attestorUrl} target="_blank" rel="noopener noreferrer" className="chip">WALLET {short(ledger.attestor)} ↗</a>
          </div>
        )}
      </header>

      {!ledger && <div className="receipt-list">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="receipt-item skeleton" style={{ height: 96 }} />)}</div>}

      {ledger?.error && (
        <div className="panel state-panel" role="alert">
          <h3>{cached ? <><span className="chip demo">CACHED</span> Showing a saved copy</> : "Couldn't read the ledger"}</h3>
          <p>{ledger.error}</p>
          <div className="state-actions"><button className="primary-button" onClick={load}>RETRY</button></div>
        </div>
      )}

      {ledger && !ledger.configured && (
        <div className="panel state-panel">
          <h3>Receipts aren&apos;t switched on here</h3>
          <p>This deployment has no receipt wallet, so there&apos;s nothing to read yet.</p>
        </div>
      )}

      {ledger?.configured && !ledger.error && ledger.receipts.length === 0 && (
        <div className="panel state-panel">
          <h3>No receipts yet</h3>
          <p>Open any token and press Anchor on Solana. The receipt appears here within seconds.</p>
          <div className="state-actions"><Link className="primary-button" href="/">FIND A TOKEN →</Link></div>
        </div>
      )}

      {ledger && ledger.receipts.length > 0 && (
        <>
          <div className="toolbar">
            <span className="muted mono">{ledger.receipts.length} receipt{ledger.receipts.length === 1 ? "" : "s"} on Solana {ledger.cluster}</span>
            <button className="secondary-button" onClick={load}>REFRESH ↻</button>
          </div>
          <div className="receipt-list">
            {ledger.receipts.map((r) => (
              <article key={r.signature} id={`rc-${r.signature}`} className={`receipt-item ${focusSig === r.signature ? "focus" : ""}`}>
                <div className="receipt-main">
                  <Link href={`/token/${r.mint}`} className="receipt-token">
                    <strong>{symbols[r.mint] ?? short(r.mint)}</strong>
                    {symbols[r.mint] && <span className="mono muted">{short(r.mint)}</span>}
                  </Link>
                  <span className={`band-chip ${bandTone(r.band)}`}>{r.score} · {r.band}</span>
                  <span className="mono small">conf {Math.round(r.confidence * 100)}%</span>
                  <span className="small muted" title={new Date(r.time * 1000).toLocaleString()}>{ago(r.time)}</span>
                  <a className="inline-link small" href={r.explorerUrl} target="_blank" rel="noopener noreferrer">Explorer ↗</a>
                </div>
                <Verifier r={r} autoOpen={focusSig === r.signature} />
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
