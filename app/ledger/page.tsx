"use client";
import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import type { LedgerReceipt } from "@/components/DossierView";
import { canonicalEvidence, sha256Hex } from "@/lib/canonical";
import { bandTone, short } from "@/lib/format";

type Ledger = { cluster: string; configured: boolean; attestor?: string; attestorUrl?: string; balanceSol?: number | null; receipts: LedgerReceipt[]; error?: string };
type Check = { state: "match" | "mismatch" | "missing"; detail: string };

export default function LedgerPage() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/ledger")
      .then((r) => r.json())
      .then(setLedger)
      .catch(() => setLedger({ cluster: "devnet", configured: false, receipts: [], error: "Could not reach the ledger." }));
  }, []);
  useEffect(load, [load]);

  async function verifyBundle(r: LedgerReceipt, bundle: { evidence?: unknown[] } | null) {
    if (!bundle?.evidence) {
      setChecks((c) => ({ ...c, [r.signature]: { state: "missing", detail: "No evidence bundle for this receipt in this browser. Upload the JSON you downloaded from the token page." } }));
      setUploadFor(r.signature);
      return;
    }
    const hash = await sha256Hex(canonicalEvidence(bundle.evidence as Parameters<typeof canonicalEvidence>[0]));
    const ok = hash.slice(0, 16) === r.hash16;
    setChecks((c) => ({ ...c, [r.signature]: { state: ok ? "match" : "mismatch", detail: ok ? `Recomputed ${hash.slice(0, 16)}… matches the hash written on chain.` : `Recomputed ${hash.slice(0, 16)} ≠ on-chain ${r.hash16}. This evidence is not what was anchored.` } }));
  }

  function verify(r: LedgerReceipt) {
    let bundle = null;
    try {
      const raw = localStorage.getItem(`pulse.bundle.${r.hash16}`);
      bundle = raw ? JSON.parse(raw) : null;
    } catch {
      bundle = null;
    }
    void verifyBundle(r, bundle);
  }

  async function onUpload(r: LedgerReceipt, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      await verifyBundle(r, Array.isArray(parsed) ? { evidence: parsed } : parsed);
    } catch {
      setChecks((c) => ({ ...c, [r.signature]: { state: "mismatch", detail: "That file is not a Pulse evidence bundle." } }));
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">READ LIVE FROM SOLANA {ledger ? ledger.cluster.toUpperCase() : ""}</div>
          <h1>Receipts ledger</h1>
          <p className="lede">Every verdict Pulse anchors is a Memo transaction on Solana. This page reads them straight from the attestor wallet&apos;s history (no database) and lets anyone recompute the evidence hash to check that a verdict wasn&apos;t rewritten.</p>
        </div>
        {ledger?.attestor && (
          <div className="page-meta">
            <a href={ledger.attestorUrl} target="_blank" rel="noopener noreferrer" className="chip">ATTESTOR {short(ledger.attestor)} ↗</a>
            {ledger.balanceSol !== null && ledger.balanceSol !== undefined && <span className="muted mono">{ledger.balanceSol.toFixed(4)} SOL</span>}
          </div>
        )}
      </header>

      {!ledger && <div className="table">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="tr skeleton" />)}</div>}
      {ledger && !ledger.configured && (
        <div className="panel empty">
          <h3>No attestor configured</h3>
          <p className="muted">Receipts are off until the server has a funded attestor key. Run <code>node scripts/attestor.mjs new</code>, fund the address on faucet.solana.com, and set <code>ATTESTOR_SECRET_KEY</code>.</p>
        </div>
      )}
      {ledger?.error && <div className="notice">{ledger.error}</div>}
      {ledger?.configured && !ledger.error && ledger.receipts.length === 0 && (
        <div className="panel empty">
          <h3>No receipts yet</h3>
          <p className="muted">Open any token and press <strong>Anchor on Solana</strong>. The receipt will appear here within seconds.</p>
          <Link className="primary-button inline-btn" href="/">FIND A TOKEN →</Link>
        </div>
      )}

      {ledger && ledger.receipts.length > 0 && (
        <>
          <div className="toolbar">
            <span className="muted mono">{ledger.receipts.length} receipt{ledger.receipts.length === 1 ? "" : "s"} on chain</span>
            <button className="secondary-button" onClick={load}>REFRESH ↻</button>
          </div>
          <div className="table ledger-table" role="table" aria-label="Receipts">
            <div className="tr th" role="row">
              <span role="columnheader">TOKEN</span>
              <span role="columnheader">SCORE</span>
              <span role="columnheader">EVIDENCE HASH</span>
              <span role="columnheader">ANCHORED</span>
              <span role="columnheader">TRANSACTION</span>
              <span role="columnheader">VERIFY</span>
            </div>
            {ledger.receipts.map((r) => {
              const c = checks[r.signature];
              return (
                <div key={r.signature} className="ledger-item">
                  <div className="tr" role="row">
                    <Link href={`/token/${r.mint}`} className="mono inline-link" role="cell">{short(r.mint)}</Link>
                    <span role="cell" className={`mono ${bandTone(r.band)}`}>{r.score} · {r.band}</span>
                    <span role="cell" className="mono muted">{r.hash16}</span>
                    <span role="cell" className="mono">{new Date(r.time * 1000).toLocaleString()}</span>
                    <a role="cell" className="mono inline-link" href={r.explorerUrl} target="_blank" rel="noopener noreferrer">{short(r.signature)} ↗</a>
                    <span role="cell" className="row-actions">
                      <button className="secondary-button" onClick={() => verify(r)}>VERIFY</button>
                    </span>
                  </div>
                  {c && (
                    <div className={`verify-result ${c.state}`}>
                      <strong>{c.state === "match" ? "✓ MATCH" : c.state === "mismatch" ? "✕ MISMATCH" : "? NEED BUNDLE"}</strong> {c.detail}
                      {uploadFor === r.signature && c.state !== "match" && (
                        <label className="secondary-button upload">UPLOAD JSON<input type="file" accept="application/json,.json" onChange={(e) => void onUpload(r, e)} /></label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
