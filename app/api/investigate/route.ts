import { evidenceHash } from "@/lib/evidence";
import { calculateRisk } from "@/lib/risk-engine";
import { demoEvidence, snapshotFor } from "@/lib/snapshots";
import type { Investigation } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const token = snapshotFor(body.query ?? "");
  const observedAt = new Date().toISOString();
  const evidence = demoEvidence(observedAt, token.mint);
  const verdict = calculateRisk({ mintAuthorityActive: false, freezeAuthorityActive: false, token2022Extension: null, topWalletShare: 0.14, topTenWalletShare: 0.41, exitImpactAt1000: 0.018, liquidityToFdv: 0.044, ageHours: 312, identity: "unverified" });
  const result: Investigation = { mint: token.mint, name: token.name, symbol: token.symbol, mode: "DEMO", observedAt, evidenceHash: evidenceHash(evidence), evidence, verdict, ai: { label: "Rule-based explanation", summary: "The recorded snapshot shows disabled authorities and a measured route at the tested $1,000 size. This is a limited demo snapshot, not a live assurance.", findings: [{ severity: "low", headline: "Authorities appear disabled", explanation: "The snapshot records no active mint or freeze authority [E1] [E2].", evidenceIds: ["E1", "E2"] }, { severity: "medium", headline: "Exit route has measurable impact", explanation: "The recorded $1,000 route shows 1.8% price impact [E5]. Quotes are point-in-time measurements.", evidenceIds: ["E5"] }], unknowns: ["This first build uses a recorded snapshot until a keyed RPC and Jupiter provider are configured."] }, exitLadder: [{ size: "$100", output: "$98.91", impact: "0.6%", status: "demo" }, { size: "$1,000", output: "$981.72", impact: "1.8%", status: "demo" }, { size: "$10,000", output: "$9,148.00", impact: "8.5%", status: "demo" }] };
  return Response.json(result);
}
