// Verdicts the server computed, keyed by evidence hash, so receipts never trust client-sent scores.
// In-memory and best-effort; the attest route rebuilds the dossier when an entry is missing.
import type { Band } from "./types";

export type StoredVerdict = { mint: string; score: number; band: Band; confidence: number; hash: string; at: number };

const verdicts = new Map<string, StoredVerdict>();
const receipts = new Map<string, { signature: string; explorerUrl: string; memo: string; cluster: string; status: string }>();

export function rememberVerdict(v: Omit<StoredVerdict, "at">) {
  verdicts.set(v.hash, { ...v, at: Date.now() });
  if (verdicts.size > 1000) {
    const oldest = [...verdicts.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 200);
    oldest.forEach(([k]) => verdicts.delete(k));
  }
}

export const recallVerdict = (hash: string) => verdicts.get(hash);
export const receiptFor = (hash: string) => receipts.get(hash);
export const rememberReceipt = (hash: string, r: { signature: string; explorerUrl: string; memo: string; cluster: string; status: string }) => receipts.set(hash, r);
