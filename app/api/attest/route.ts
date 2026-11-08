import { AttestError, writeReceipt } from "@/lib/attest";
import { attestCluster, attestorAddress, attestRpc, explorerTx } from "@/lib/attest-config";
import { cached, clientIp, rateLimited } from "@/lib/cache";
import { parseReceiptMemo } from "@/lib/receipt";
import { buildDossier, resolveToken } from "@/lib/dossier";
import type { Band } from "@/lib/types";
import { checkSeal } from "@/lib/verdict-seal";
import { recallVerdict, receiptFor, rememberReceipt, rememberVerdict } from "@/lib/verdict-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Anchors a verdict on Solana. The score written is always one this server computed.
export async function POST(request: Request) {
  if (rateLimited(`attest:${clientIp(request)}`, 5, 60_000)) return Response.json({ error: "Too many receipts — wait a minute." }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as {
    mint?: string;
    evidenceHash?: string;
    sealed?: { score: number; band: Band; confidence: number; issuedAt: number; seal: string };
  };
  const mint = String(body.mint ?? "");
  const hash = String(body.evidenceHash ?? "");
  if (!MINT.test(mint) || !/^[0-9a-f]{64}$/.test(hash)) return Response.json({ error: "Missing mint or evidence hash." }, { status: 400 });

  const existing = receiptFor(hash);
  if (existing) return Response.json({ ...existing, evidenceHash: hash, reused: true });

  let verdict = recallVerdict(hash);
  // A valid seal proves this server computed exactly these values, even on another instance.
  const s = body.sealed;
  if (!verdict && s && checkSeal({ mint, score: Number(s.score), band: s.band, confidence: Number(s.confidence), hash, issuedAt: Number(s.issuedAt) }, String(s.seal))) {
    verdict = { mint, score: Number(s.score), band: s.band, confidence: Number(s.confidence), hash, at: Number(s.issuedAt) };
  }
  let note: string | undefined;
  if (!verdict || verdict.mint !== mint) {
    // Not computed by this instance: recompute from live data rather than trust the client.
    const found = await resolveToken(mint).catch(() => ({ id: mint }));
    if (!found) return Response.json({ error: "Token not found." }, { status: 404 });
    const d = await buildDossier(found);
    if (d.mode === "UNAVAILABLE") return Response.json({ error: "Data sources unavailable; cannot recompute the verdict to anchor." }, { status: 502 });
    verdict = { mint: d.mint, score: d.verdict.score, band: d.verdict.band, confidence: d.verdict.confidence, hash: d.evidenceHash, at: Date.now() };
    rememberVerdict(verdict);
    if (d.evidenceHash !== hash) note = "Chain or market data changed since you loaded this page, so the receipt anchors the fresh verdict.";
    const again = receiptFor(verdict.hash);
    if (again) return Response.json({ ...again, evidenceHash: verdict.hash, reused: true, note });
  }

  // Idempotent across server instances: if this mint + evidence hash is already on chain, reuse it.
  try {
    const address = attestorAddress();
    if (address) {
      const { value: sigs } = await cached(`ledger:${attestCluster()}:${address}`, 8_000, () =>
        attestRpc<{ signature: string; err: unknown; memo: string | null }[]>("getSignaturesForAddress", [address, { limit: 100, commitment: "confirmed" }]),
      );
      const hit = sigs.find((s) => {
        const p = !s.err ? parseReceiptMemo(s.memo) : null;
        return p && p.mint === verdict!.mint && p.hash16 === verdict!.hash.slice(0, 16);
      });
      if (hit?.memo) {
        const reused = { signature: hit.signature, memo: hit.memo.replace(/^\[\d+\]\s*/, ""), explorerUrl: explorerTx(hit.signature), cluster: attestCluster(), status: "confirmed" };
        rememberReceipt(verdict.hash, reused);
        return Response.json({ ...reused, evidenceHash: verdict.hash, reused: true, note });
      }
    }
  } catch {
    /* ledger read failed: fall through and write */
  }

  try {
    const r = await writeReceipt({ mint: verdict.mint, score: verdict.score, band: verdict.band, confidence: verdict.confidence, hash16: verdict.hash.slice(0, 16) });
    rememberReceipt(verdict.hash, r);
    return Response.json({ ...r, evidenceHash: verdict.hash, score: verdict.score, band: verdict.band, note });
  } catch (e) {
    const status = e instanceof AttestError ? e.status : 502;
    return Response.json({ error: e instanceof AttestError ? e.message : "Receipt unavailable: the transaction could not be sent." }, { status });
  }
}
