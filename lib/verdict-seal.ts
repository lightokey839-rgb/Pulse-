// Stateless proof that the server computed a verdict. The dossier route seals {mint, score, band,
// confidence, hash, issuedAt}; the attest route only anchors values whose seal checks out.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Band } from "./types";

export type SealedVerdict = { mint: string; score: number; band: Band; confidence: number; hash: string; issuedAt: number };
const MAX_AGE_MS = 30 * 60_000;

function key(): Buffer | null {
  const base = process.env.PULSE_SEAL_SECRET || process.env.ATTESTOR_SECRET_KEY;
  return base ? createHash("sha256").update(`pulse-seal/1:${base}`).digest() : null;
}

const payload = (v: SealedVerdict) => `${v.mint}|${v.score}|${v.band}|${v.confidence}|${v.hash}|${v.issuedAt}`;

export function sealVerdict(v: SealedVerdict): string | null {
  const k = key();
  return k ? createHmac("sha256", k).update(payload(v)).digest("hex") : null;
}

export function checkSeal(v: SealedVerdict, seal: string): boolean {
  const expected = sealVerdict(v);
  if (!expected || !/^[0-9a-f]{64}$/.test(seal)) return false;
  if (!(Date.now() - v.issuedAt < MAX_AGE_MS && v.issuedAt <= Date.now() + 60_000)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(seal, "hex"));
}
