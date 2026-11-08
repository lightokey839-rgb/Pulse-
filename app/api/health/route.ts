import { aiEnabled, aiModel } from "@/lib/ai";
import { attestCluster, attestorAddress, attestorBalanceLamports } from "@/lib/attest-config";
import { jupiterMode } from "@/lib/jupiter";
import { rpcIsKeyed } from "@/lib/rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  const address = attestorAddress();
  const lamports = address ? await attestorBalanceLamports() : null;
  const attestor = !address
    ? "off — no attestor key"
    : lamports === null
      ? `${attestCluster()} · balance unknown`
      : lamports < 10_000
        ? `${attestCluster()} · needs funding`
        : `ready on ${attestCluster()} (${(lamports / 1e9).toFixed(4)} SOL)`;
  return Response.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    services: {
      rpc: rpcIsKeyed() ? "keyed provider" : "public mainnet RPC (holder lookups may be rate-limited)",
      jupiter: jupiterMode() === "keyed" ? "keyed (1 req/s)" : "keyless (0.5 req/s — slower ladders)",
      ai: aiEnabled() ? `enabled (${aiModel()})` : "off — rule-based explanations",
      attestor,
    },
    attestor: address ? { address, cluster: attestCluster(), balanceSol: lamports === null ? null : lamports / 1e9 } : null,
  });
}
