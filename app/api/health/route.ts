import { aiEnabled, aiModel } from "@/lib/ai";
import { jupiterMode } from "@/lib/jupiter";
import { rpcIsKeyed } from "@/lib/rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    services: {
      rpc: rpcIsKeyed() ? "keyed provider" : "public mainnet RPC (holder lookups may be rate-limited)",
      jupiter: jupiterMode() === "keyed" ? "keyed (1 req/s)" : "keyless (0.5 req/s — slower ladders)",
      ai: aiEnabled() ? `enabled (${aiModel()})` : "off — rule-based explanations",
    },
  });
}
