import type { RiskFactor, Verdict } from "./types";

const bandFor = (score: number, coverage: number): Verdict["band"] => {
  if (coverage < 0.6) return "Insufficient data";
  if (score < 25) return coverage < 0.8 ? "Insufficient data" : "Low signals";
  if (score < 50) return coverage < 0.8 ? "Insufficient data" : "Moderate";
  if (score < 75) return "Elevated";
  return "High";
};

export function calculateRisk(input: { mintAuthorityActive: boolean | null; freezeAuthorityActive: boolean | null; token2022Extension: string | null; topWalletShare: number | null; topTenWalletShare: number | null; exitImpactAt1000: number | null; liquidityToFdv: number | null; ageHours: number | null; identity: "verified" | "unverified" | "suspicious" | null }): Verdict {
  const factors: RiskFactor[] = [];
  const add = (name: string, weight: number, severity: number, value: string, evidenceIds: string[], source: RiskFactor["source"]) => factors.push({ name, weight, severity, contribution: weight * severity, value, evidenceIds, source });
  if (input.mintAuthorityActive !== null) add("Mint authority", 20, input.mintAuthorityActive ? 1 : 0, input.mintAuthorityActive ? "Active" : "Disabled", ["E1"], "LIVE");
  if (input.freezeAuthorityActive !== null) add("Freeze authority", 12, input.freezeAuthorityActive ? 0.8 : 0, input.freezeAuthorityActive ? "Active" : "Disabled", ["E2"], "LIVE");
  if (input.token2022Extension !== null) add("Token-2022 extensions", 12, input.token2022Extension === "PermanentDelegate" || input.token2022Extension === "NonTransferable" ? 1 : 0.7, input.token2022Extension, ["E3"], "LIVE");
  if (input.topWalletShare !== null && input.topTenWalletShare !== null) {
    const severity = Math.max(input.topWalletShare > 0.5 ? 1 : input.topWalletShare > 0.2 ? 0.5 : 0.1, input.topTenWalletShare > 0.8 ? 1 : input.topTenWalletShare > 0.5 ? 0.5 : 0.1);
    add("Holder concentration", 18, severity, `${Math.round(input.topWalletShare * 100)}% top wallet / ${Math.round(input.topTenWalletShare * 100)}% top 10`, ["E4"], "LIVE");
  }
  if (input.exitImpactAt1000 !== null) {
    const severity = input.exitImpactAt1000 < 0 ? 1 : input.exitImpactAt1000 > 0.1 ? 0.9 : input.exitImpactAt1000 > 0.03 ? 0.5 : input.exitImpactAt1000 > 0.01 ? 0.2 : 0;
    add("Exit liquidity", 20, severity, input.exitImpactAt1000 < 0 ? "No sell route found" : `${(input.exitImpactAt1000 * 100).toFixed(1)}% impact at $1k`, ["E5"], "DEMO");
  }
  if (input.liquidityToFdv !== null) add("Liquidity vs valuation", 8, input.liquidityToFdv < 0.005 ? 0.8 : input.liquidityToFdv < 0.02 ? 0.4 : 0, `${(input.liquidityToFdv * 100).toFixed(2)}%`, ["E6"], "DEMO");
  if (input.ageHours !== null) add("Age and activity", 5, input.ageHours < 24 ? 0.7 : Math.max(0, 0.7 - input.ageHours / 240), `${Math.round(input.ageHours)} hours`, ["E7"], "DEMO");
  if (input.identity !== null) add("Identity", 5, input.identity === "suspicious" ? 1 : input.identity === "unverified" ? 0.4 : 0, input.identity, ["E8"], "DEMO");
  const knownWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const score = Math.round((100 * factors.reduce((sum, factor) => sum + factor.contribution, 0)) / Math.max(knownWeight, 1));
  const criticalFlags = factors.filter((factor) => (factor.name === "Mint authority" && factor.severity === 1) || (factor.name === "Freeze authority" && factor.severity === 0.8) || (factor.name === "Exit liquidity" && factor.value === "No sell route found") || (factor.name === "Token-2022 extensions" && factor.severity === 1)).map((factor) => `${factor.name}: ${factor.value}`);
  const unknowns = [input.mintAuthorityActive, input.freezeAuthorityActive, input.exitImpactAt1000].some((value) => value === null) ? ["Some direct chain or route data is unavailable."] : [];
  return { score, band: bandFor(score, knownWeight / 100), confidence: Number((knownWeight / 100).toFixed(2)), coverage: Number((knownWeight / 100).toFixed(2)), factors, criticalFlags, unknowns, methodVersion: "pulse-risk/1" };
}
