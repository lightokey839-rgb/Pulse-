// Pulse receipt memo: a compact, human-readable record written to Solana with the Memo program.
//   pulse/1 c=devnet m=<mint> s=<score> b=<band> k=<confidence> h=<first 16 hex of evidence hash> t=<unix>
import type { Band } from "./types";

export const BAND_CODE: Record<Band, string> = { "Low signals": "L", Moderate: "M", Elevated: "E", High: "H", "Insufficient data": "I" };
const CODE_BAND: Record<string, Band> = Object.fromEntries(Object.entries(BAND_CODE).map(([k, v]) => [v, k as Band]));

// cluster = where the receipt lives; subject = where the token lives; method = scoring version.
export type Receipt = { cluster: string; subject?: string; method?: string; mint: string; score: number; band: Band; confidence: number; hash16: string; time: number };

export function formatReceipt(r: Receipt): string {
  const memo = `pulse/1 c=${r.cluster} n=${r.subject ?? "mainnet"} v=${r.method ?? "pulse-risk/2"} m=${r.mint} s=${r.score} b=${BAND_CODE[r.band]} k=${r.confidence.toFixed(2)} h=${r.hash16} t=${r.time}`;
  if (Buffer.byteLength(memo, "utf8") > 300) throw new Error("memo too long");
  return memo;
}

// RPC returns memos as "[len] text", joined with "; " when a transaction has several.
export function parseReceiptMemo(raw: string | null | undefined): Receipt | null {
  if (!raw) return null;
  for (const part of raw.split(/;\s*/)) {
    const text = part.replace(/^\[\d+\]\s*/, "");
    if (!text.startsWith("pulse/1 ")) continue;
    const kv = Object.fromEntries(
      text
        .slice(8)
        .split(" ")
        .map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]),
    );
    const band = CODE_BAND[kv.b];
    if (!kv.m || !kv.h || !band || !/^[0-9a-f]{16}$/.test(kv.h)) continue;
    return { cluster: kv.c ?? "devnet", subject: kv.n ?? "mainnet", method: kv.v ?? "pulse-risk/2", mint: kv.m, score: Number(kv.s), band, confidence: Number(kv.k), hash16: kv.h, time: Number(kv.t) };
  }
  return null;
}
