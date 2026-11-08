// Deterministic risk engine. No AI, no I/O. Higher score = more risk signals.
import type { Band, RiskFactor, Source, Verdict } from "./types";

export type Obs<T> = { value: T; source: Source; evidenceIds: string[] } | null;
export type Extension = { extension: string; state?: Record<string, unknown> };

export type RiskInput = {
  mintAuthorityActive: Obs<boolean>;
  freezeAuthorityActive: Obs<boolean>;
  extensions: Obs<Extension[]>;
  holders: Obs<{ topWallet: number; topTen: number; method: "rpc" | "jupiter" }>; // shares 0-1
  exit: Obs<{ noRoute: boolean; impactAt1000: number | null }>; // impact as a fraction
  liquidityToFdv: Obs<number>; // fraction
  ageHours: Obs<number>;
  identity: Obs<"verified" | "unverified" | "suspicious">;
  creatorLaunches: Obs<{ mints: number; migrations: number | null }>;
  creatorHolding: Obs<number>; // percent 0-100
};

const RELIABILITY: Record<Source, number> = { rpc: 1, jupiter: 0.7, derived: 0.6 };

export function extensionSeverity(ext: Extension): number {
  const s = ext.state ?? {};
  switch (ext.extension) {
    case "permanentDelegate":
      return s.delegate ? 1 : 0;
    case "nonTransferable":
      return 1;
    case "defaultAccountState":
      return s.accountState === "frozen" ? 1 : 0;
    case "transferHook":
      return s.programId ? 0.7 : 0;
    case "pausableConfig":
      return 0.7;
    case "transferFeeConfig": {
      const fee = (s.newerTransferFee as { transferFeeBasisPoints?: number } | undefined)?.transferFeeBasisPoints ?? 0;
      return Math.min(1, fee / 1000);
    }
    case "mintCloseAuthority":
      return s.closeAuthority ? 0.3 : 0;
    default:
      return 0;
  }
}

const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

function bandFor(score: number, coverage: number): Band {
  if (coverage < 0.6) return "Insufficient data";
  // With limited data, a calm-looking score is not shown as reassurance.
  if (coverage < 0.8 && score < 50) return "Insufficient data";
  if (score >= 75) return "High";
  if (score >= 50) return "Elevated";
  if (score >= 25) return "Moderate";
  return "Low signals";
}

export function calculateRisk(input: RiskInput): Verdict {
  const factors: RiskFactor[] = [];
  const reliabilityByFactor: number[] = [];
  const unknowns: string[] = [];
  const add = (name: string, weight: number, obs: NonNullable<Obs<unknown>>, severity: number, value: string, reliability?: number) => {
    const sev = Math.max(0, Math.min(1, severity));
    factors.push({ name, weight, severity: Number(sev.toFixed(3)), contribution: Number((weight * sev).toFixed(3)), value, evidenceIds: obs.evidenceIds, source: obs.source });
    reliabilityByFactor.push(reliability ?? RELIABILITY[obs.source]);
  };
  const missing = (name: string) => unknowns.push(`${name}: data unavailable`);

  const m = input.mintAuthorityActive;
  if (m) add("Mint authority", 18, m, m.value ? 1 : 0, m.value ? "Active — supply can be increased" : "Disabled");
  else missing("Mint authority");

  const f = input.freezeAuthorityActive;
  if (f) add("Freeze authority", 10, f, f.value ? 0.8 : 0, f.value ? "Active — holder accounts can be frozen" : "Disabled");
  else missing("Freeze authority");

  const e = input.extensions;
  if (e) {
    const worst = e.value.reduce((acc, x) => (extensionSeverity(x) > acc.sev ? { sev: extensionSeverity(x), name: x.extension } : acc), { sev: 0, name: "" });
    add("Token-2022 extensions", 10, e, worst.sev, worst.sev > 0 ? worst.name : e.value.length ? `${e.value.length} benign (${e.value.map((x) => x.extension).join(", ")})` : "None");
  } else missing("Token extensions");

  const h = input.holders;
  if (h) {
    const { topWallet, topTen, method } = h.value;
    const top = topWallet > 0.5 ? 1 : topWallet > 0.2 ? 0.6 : topWallet > 0.1 ? 0.3 : 0;
    const ten = topTen > 0.8 ? 1 : topTen > 0.5 ? 0.6 : topTen > 0.3 ? 0.3 : 0;
    // Jupiter's top-holder figure can include pools, so it is capped and down-weighted.
    const sev = method === "rpc" ? Math.max(top, ten) : Math.min(0.5, ten);
    const value = method === "rpc" ? `Top wallet ${pct(topWallet)} · top 10 wallets ${pct(topTen)}` : `Top holders ${pct(topTen)} (Jupiter, may include pools)`;
    add("Holder concentration", 16, h, sev, value, method === "rpc" ? RELIABILITY.derived : 0.5);
  } else missing("Holder concentration");

  const x = input.exit;
  if (x) {
    const impact = x.value.impactAt1000;
    const sev = x.value.noRoute ? 1 : impact === null ? 0.5 : impact > 0.1 ? 0.9 : impact > 0.03 ? 0.5 : impact > 0.01 ? 0.2 : 0;
    add("Exit liquidity", 18, x, sev, x.value.noRoute ? "No sell route found" : impact === null ? "Partial routes only" : `${pct(impact, 2)} impact selling $1k`);
  } else missing("Exit liquidity");

  const l = input.liquidityToFdv;
  if (l) add("Liquidity vs valuation", 6, l, l.value < 0.005 ? 0.8 : l.value < 0.02 ? 0.4 : 0, `${pct(l.value, 2)} of FDV`);
  else missing("Liquidity vs valuation");

  const a = input.ageHours;
  if (a) add("Age", 4, a, a.value < 24 ? 0.7 : Math.max(0, 0.7 - (a.value - 24) / 480), a.value < 48 ? `${a.value.toFixed(1)} hours` : `${Math.round(a.value / 24)} days`);
  else missing("Age");

  const i = input.identity;
  if (i) add("Identity", 4, i, i.value === "suspicious" ? 1 : i.value === "unverified" ? 0.4 : 0, i.value === "suspicious" ? "Flagged suspicious by Jupiter" : i.value === "verified" ? "Verified on Jupiter" : "Unverified");
  else missing("Identity");

  const c = input.creatorLaunches;
  if (c) {
    const n = c.value.mints;
    // Serial launching (dozens of tokens, few graduating) is a common rug pattern.
    const sev = n >= 50 ? 1 : n >= 10 ? 0.7 : n >= 3 ? 0.4 : 0;
    add("Creator launch history", 8, c, sev, `${n >= 50 ? "Serial launcher — " : ""}${n} token${n === 1 ? "" : "s"} launched${c.value.migrations !== null ? `, ${c.value.migrations} graduated` : ""}`);
  } else missing("Creator launch history");

  const d = input.creatorHolding;
  if (d) add("Creator holding", 6, d, d.value > 20 ? 1 : d.value > 10 ? 0.6 : d.value > 5 ? 0.3 : 0, `${d.value.toFixed(2)}% of supply`);
  else missing("Creator holding");

  const knownWeight = factors.reduce((s, x) => s + x.weight, 0);
  const raw = knownWeight ? (100 * factors.reduce((s, x) => s + x.contribution, 0)) / knownWeight : 0;
  const criticalFlags = factors
    .filter(
      (x) =>
        (x.name === "Mint authority" && x.severity === 1) ||
        (x.name === "Freeze authority" && x.severity > 0) ||
        (x.name === "Token-2022 extensions" && x.severity === 1) ||
        (x.name === "Exit liquidity" && x.value === "No sell route found") ||
        (x.name === "Creator launch history" && x.severity === 1),
    )
    .map((x) => `${x.name}: ${x.value}`);
  // A showstopper cannot be averaged away.
  const score = Math.round(criticalFlags.length ? Math.max(raw, 50) : raw);
  const coverage = Number((knownWeight / 100).toFixed(2));
  const confidence = Number((factors.reduce((s, x, idx) => s + x.weight * reliabilityByFactor[idx], 0) / 100).toFixed(2));

  return {
    score,
    band: bandFor(score, coverage),
    limitedData: coverage < 0.8,
    confidence,
    coverage,
    factors,
    criticalFlags,
    unknowns,
    disagreements: [],
    methodVersion: "pulse-risk/2",
  };
}
