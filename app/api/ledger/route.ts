import { attestCluster, attestorAddress, attestorBalanceLamports, attestRpc, explorerAddress, explorerTx } from "@/lib/attest-config";
import { cached, clientIp, rateLimited } from "@/lib/cache";
import { parseReceiptMemo } from "@/lib/receipt";

export const dynamic = "force-dynamic";

type SigInfo = { signature: string; slot: number; blockTime: number | null; err: unknown; memo: string | null; confirmationStatus?: string };

// Receipts are read back from the chain (the attestor's transaction history), not from a database.
export async function GET(request: Request) {
  if (rateLimited(`ledger:${clientIp(request)}`, 30, 60_000)) return Response.json({ error: "Too many requests." }, { status: 429 });
  const address = attestorAddress();
  const cluster = attestCluster();
  if (!address) return Response.json({ cluster, configured: false, receipts: [] });
  const mint = new URL(request.url).searchParams.get("mint");
  try {
    const { value: sigs } = await cached(`ledger:${cluster}:${address}`, 8_000, () => attestRpc<SigInfo[]>("getSignaturesForAddress", [address, { limit: 100, commitment: "confirmed" }]));
    const receipts = sigs
      .filter((s) => !s.err)
      .map((s) => {
        const r = parseReceiptMemo(s.memo);
        return r ? { ...r, signature: s.signature, slot: s.slot, blockTime: s.blockTime, explorerUrl: explorerTx(s.signature), status: s.confirmationStatus ?? "confirmed" } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && (!mint || r.mint === mint));
    const balance = await attestorBalanceLamports();
    return Response.json({ cluster, configured: true, attestor: address, attestorUrl: explorerAddress(address), balanceSol: balance === null ? null : balance / 1e9, receipts });
  } catch (e) {
    return Response.json({ cluster, configured: true, attestor: address, error: `Could not read the ledger from ${cluster}: ${(e as Error).message}`, receipts: [] }, { status: 502 });
  }
}
