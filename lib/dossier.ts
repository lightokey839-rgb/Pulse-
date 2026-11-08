import { evidenceHash } from "./evidence";
import { isNoRoute, jupiterSwapUrl, searchTokens, sellQuote, USDC_MINT, type JupToken } from "./jupiter";
import { calculateRisk, type RiskInput } from "./risk-engine";
import { getHolders, getMint, type MintInfo } from "./rpc";
import type { Dossier, Evidence, LadderRung, RadarToken } from "./types";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const explorer = (address: string) => `https://explorer.solana.com/address/${address}`;
export const LADDER_SIZES = [100, 1000, 10000] as const;
// Above this, the "dev" wallet is almost certainly a launchpad's own deployer, not an individual.
const PLATFORM_SIGNER_LAUNCHES = 20_000;

export async function resolveToken(query: string): Promise<JupToken | { id: string } | null> {
  const q = query.trim();
  if (!q) return null;
  const { value } = await searchTokens(q).catch(() => ({ value: [] as JupToken[] }));
  if (BASE58.test(q)) return value.find((t) => t.id === q) ?? { id: q };
  const norm = (s: string) => s.replace(/^\$/, "").toLowerCase();
  const target = norm(q);
  // Copycat tickers are common: prefer verified, then deepest liquidity.
  const rank = (a: JupToken, b: JupToken) => Number(Boolean(b.isVerified)) - Number(Boolean(a.isVerified)) || (b.liquidity ?? 0) - (a.liquidity ?? 0);
  const exact = value.filter((t) => norm(t.symbol) === target || norm(t.name) === target).sort(rank);
  return exact[0] ?? [...value].sort(rank)[0] ?? null;
}

const isFull = (t: JupToken | { id: string }): t is JupToken => "symbol" in t;

function ageHoursOf(t: JupToken): number | null {
  const created = t.firstPool?.createdAt ?? t.createdAt;
  if (!created) return null;
  const ms = Date.now() - Date.parse(created);
  return Number.isFinite(ms) ? Math.max(0, ms / 3_600_000) : null;
}

export async function buildDossier(found: JupToken | { id: string }): Promise<Dossier> {
  const mint = found.id;
  const observedAt = new Date().toISOString();
  const trace: Dossier["trace"] = [];
  const evidence: Evidence[] = [];
  const ev = (e: Omit<Evidence, "observedAt">) => {
    evidence.push({ ...e, observedAt });
    return e.id;
  };
  const timed = async <T>(step: string, source: string, fn: () => Promise<T>): Promise<T | null> => {
    const t0 = Date.now();
    try {
      const out = await fn();
      trace.push({ step, source, ms: Date.now() - t0, status: "ok" });
      return out;
    } catch {
      trace.push({ step, source, ms: Date.now() - t0, status: "unavailable" });
      return null;
    }
  };

  const tok: JupToken | null = isFull(found) ? found : await timed("Token metadata", "Jupiter · tokens/v2/search", async () => {
    const { value } = await searchTokens(mint);
    const t = value.find((x) => x.id === mint);
    if (!t) throw new Error("not indexed");
    return t;
  });
  if (isFull(found)) trace.push({ step: "Token metadata", source: "Jupiter · tokens/v2", ms: 0, status: "ok" });

  const mintInfo: MintInfo | null = await timed("Mint authorities & extensions", "RPC · getAccountInfo(jsonParsed)", async () => {
    const m = await getMint(mint);
    if (!m) throw new Error("not a mint");
    return m;
  });

  const input: RiskInput = {
    mintAuthorityActive: null,
    freezeAuthorityActive: null,
    extensions: null,
    holders: null,
    exit: null,
    liquidityToFdv: null,
    ageHours: null,
    identity: null,
    creatorLaunches: null,
    creatorHolding: null,
  };
  const disagreements: string[] = [];
  const verdictNotes: string[] = [];

  // Authorities: chain first, Jupiter only when the chain read failed.
  if (mintInfo) {
    const e1 = ev({ id: "E1", label: "Mint authority", value: mintInfo.mintAuthority ?? "none", source: "rpc", method: "getAccountInfo(jsonParsed)", explorerUrl: explorer(mint) });
    const e2 = ev({ id: "E2", label: "Freeze authority", value: mintInfo.freezeAuthority ?? "none", source: "rpc", method: "getAccountInfo(jsonParsed)", explorerUrl: explorer(mint) });
    const e3 = ev({
      id: "E3",
      label: "Token program & extensions",
      value: `${mintInfo.program}${mintInfo.extensions.length ? `: ${mintInfo.extensions.map((x) => x.extension).join(", ")}` : ", no extensions"}`,
      source: "rpc",
      method: "getAccountInfo(jsonParsed)",
      explorerUrl: explorer(mint),
    });
    input.mintAuthorityActive = { value: mintInfo.mintAuthority !== null, source: "rpc", evidenceIds: [e1] };
    input.freezeAuthorityActive = { value: mintInfo.freezeAuthority !== null, source: "rpc", evidenceIds: [e2] };
    input.extensions = { value: mintInfo.extensions, source: "rpc", evidenceIds: [e3] };
    if (tok?.audit?.mintAuthorityDisabled !== undefined && tok.audit.mintAuthorityDisabled === (mintInfo.mintAuthority !== null))
      disagreements.push("Jupiter and the chain disagree on mint authority — using the chain.");
    if (tok?.audit?.freezeAuthorityDisabled !== undefined && tok.audit.freezeAuthorityDisabled === (mintInfo.freezeAuthority !== null))
      disagreements.push("Jupiter and the chain disagree on freeze authority — using the chain.");
  } else if (tok?.audit) {
    if (tok.audit.mintAuthorityDisabled !== undefined) {
      const e1 = ev({ id: "E1", label: "Mint authority (Jupiter audit)", value: tok.audit.mintAuthorityDisabled ? "disabled" : "active", source: "jupiter", method: "tokens/v2 audit.mintAuthorityDisabled" });
      input.mintAuthorityActive = { value: !tok.audit.mintAuthorityDisabled, source: "jupiter", evidenceIds: [e1] };
    }
    if (tok.audit.freezeAuthorityDisabled !== undefined) {
      const e2 = ev({ id: "E2", label: "Freeze authority (Jupiter audit)", value: tok.audit.freezeAuthorityDisabled ? "disabled" : "active", source: "jupiter", method: "tokens/v2 audit.freezeAuthorityDisabled" });
      input.freezeAuthorityActive = { value: !tok.audit.freezeAuthorityDisabled, source: "jupiter", evidenceIds: [e2] };
    }
  }

  // Holders: resolve owners on chain; fall back to Jupiter's figure (may include pools).
  const holders = mintInfo ? await timed("Holder owners resolved", "RPC · getTokenLargestAccounts + getMultipleAccounts", () => getHolders(mint, mintInfo.supply)) : null;
  if (holders && holders.walletsResolved > 0) {
    const e4 = ev({
      id: "E4",
      label: "Holder concentration (owners resolved)",
      value: `top wallet ${(holders.topWalletShare * 100).toFixed(1)}%, top 10 wallets ${(holders.topTenWalletShare * 100).toFixed(1)}%, program-controlled ${(holders.programControlledShare * 100).toFixed(1)}% (heuristic)`,
      source: "derived",
      method: "getTokenLargestAccounts → getMultipleAccounts owner classification",
    });
    input.holders = { value: { topWallet: holders.topWalletShare, topTen: holders.topTenWalletShare, method: "rpc" }, source: "derived", evidenceIds: [e4] };
  } else if (tok?.audit?.topHoldersPercentage !== undefined) {
    const e4 = ev({ id: "E4", label: "Top holders share (Jupiter, may include pools)", value: `${tok.audit.topHoldersPercentage.toFixed(1)}%`, source: "jupiter", method: "tokens/v2 audit.topHoldersPercentage" });
    input.holders = { value: { topWallet: 0, topTen: tok.audit.topHoldersPercentage / 100, method: "jupiter" }, source: "jupiter", evidenceIds: [e4] };
  }

  // Exit Ladder: sell quotes into USDC at three sizes, serially (rate limits).
  const ladder: LadderRung[] = [];
  const ladderIds = ["E5", "E6", "E7"];
  const decimals = mintInfo?.decimals ?? tok?.decimals;
  if (mint === USDC_MINT) {
    // Selling USDC into USDC is not meaningful; leave the factor unknown.
  } else if (tok?.usdPrice && decimals !== undefined) {
    const t0 = Date.now();
    let anyRoute = false;
    let noRouteSeen = false;
    let exceedsSupply = false;
    for (const [idx, size] of LADDER_SIZES.entries()) {
      const id = ladderIds[idx];
      if (noRouteSeen) {
        ladder.push({ sizeUsd: size, status: "no route", evidenceId: id });
        ev({ id, label: `Sell $${size.toLocaleString("en-US")} → USDC`, value: "no route (smaller size had none)", source: "jupiter", method: "swap/v2/order" });
        continue;
      }
      const raw = BigInt(Math.round((size / tok.usdPrice) * 10 ** Math.min(decimals, 9))) * BigInt(10 ** Math.max(0, decimals - 9));
      if (mintInfo && raw > BigInt(mintInfo.supply)) {
        // The sell is bigger than every token in existence is worth at the current price.
        noRouteSeen = true;
        exceedsSupply = true;
        ladder.push({ sizeUsd: size, status: "no route", evidenceId: id });
        ev({ id, label: `Sell $${size.toLocaleString("en-US")} → USDC`, value: "no route: size exceeds the value of the entire supply", source: "derived", method: "usdPrice × supply" });
        continue;
      }
      try {
        const { value: q } = await sellQuote(mint, raw);
        const outputUsd = Number(q.outAmount) / 1e6;
        const impactPct = Math.max(0, -Number(q.priceImpactPct ?? 0) * 100);
        const route = (q.routePlan ?? []).map((r) => r.swapInfo?.label).filter(Boolean).join(" → ");
        anyRoute = anyRoute || outputUsd > 0;
        if (!(outputUsd > 0)) throw Object.assign(new Error("zero out"), { noRoute: true });
        ladder.push({ sizeUsd: size, status: "quoted", outputUsd, impactPct, feeBps: q.feeBps, router: q.router, route, evidenceId: id });
        ev({ id, label: `Sell $${size.toLocaleString("en-US")} → USDC`, value: `out $${outputUsd.toFixed(2)}, impact ${impactPct.toFixed(2)}%`, source: "jupiter", method: `swap/v2/order (${q.router ?? "router"})` });
      } catch (err) {
        const noRoute = isNoRoute(err) || (err as { noRoute?: boolean }).noRoute === true;
        if (noRoute) noRouteSeen = true;
        ladder.push({ sizeUsd: size, status: noRoute ? "no route" : "unavailable", evidenceId: id });
        ev({ id, label: `Sell $${size.toLocaleString("en-US")} → USDC`, value: noRoute ? "no route found" : "quote unavailable", source: "jupiter", method: "swap/v2/order" });
      }
    }
    const allUnavailable = ladder.every((r) => r.status === "unavailable");
    trace.push({ step: "Exit routes measured", source: "Jupiter · swap/v2/order ×3", ms: Date.now() - t0, status: allUnavailable ? "unavailable" : "ok" });
    // Launchpad tokens still on their bonding curve are not routable through Jupiter yet; sells go
    // through the launchpad itself. That is not the same as "no exit", so it is reported, not scored.
    const onCurve = !anyRoute && !exceedsSupply && Boolean(tok.launchpad) && ladder.some((r) => r.status === "no route");
    if (onCurve) {
      ladder.forEach((r) => {
        r.status = "curve only";
        r.evidenceId = "E5";
      });
      ev({ id: "E5", label: "Exit route", value: `no Jupiter route; likely still on the ${tok.launchpad} bonding curve (heuristic) — sells go through the launchpad`, source: "derived", method: "swap/v2/order + launchpad" });
      evidence.splice(0, evidence.length, ...evidence.filter((e) => !(["E5", "E6", "E7"].includes(e.id) && e.method !== "swap/v2/order + launchpad")));
      verdictNotes.push(`Exit liquidity: not measurable while on the ${tok.launchpad} bonding curve`);
    } else if (!allUnavailable) {
      const k = ladder.find((r) => r.sizeUsd === 1000);
      const noRoute = !anyRoute && ladder.some((r) => r.status === "no route");
      input.exit = {
        value: { noRoute, impactAt1000: k?.status === "quoted" ? (k.impactPct ?? 0) / 100 : null },
        source: "jupiter",
        evidenceIds: noRoute ? ["E5"] : ["E6"],
      };
    }
  } else {
    trace.push({ step: "Exit routes measured", source: "Jupiter · no reference price", ms: 0, status: "unavailable" });
  }

  if (tok) {
    if (tok.liquidity !== undefined && tok.fdv) {
      const id = ev({ id: "E8", label: "Liquidity / FDV", value: `liquidity $${Math.round(tok.liquidity).toLocaleString("en-US")}, FDV $${Math.round(tok.fdv).toLocaleString("en-US")}, ratio ${((tok.liquidity / tok.fdv) * 100).toFixed(2)}%`, source: "jupiter", method: "tokens/v2" });
      input.liquidityToFdv = { value: tok.liquidity / tok.fdv, source: "jupiter", evidenceIds: [id] };
    }
    const age = ageHoursOf(tok);
    if (age !== null) {
      // Store the fixed creation time (not the moving age) so the evidence hash stays reproducible.
      const id = ev({ id: "E9", label: "First pool created", value: tok.firstPool?.createdAt ?? tok.createdAt ?? null, source: "jupiter", method: "tokens/v2 firstPool.createdAt" });
      input.ageHours = { value: age, source: "jupiter", evidenceIds: [id] };
    }
    const identity = tok.audit?.isSus ? "suspicious" : tok.isVerified ? "verified" : "unverified";
    const e10 = ev({ id: "E10", label: "Identity", value: `${identity}${tok.organicScoreLabel ? `, organic score ${tok.organicScoreLabel}` : ""}`, source: "jupiter", method: "tokens/v2 isVerified / audit.isSus" });
    input.identity = { value: identity, source: "jupiter", evidenceIds: [e10] };
    if (tok.audit?.devMints !== undefined && tok.audit.devMints >= PLATFORM_SIGNER_LAUNCHES) {
      ev({ id: "E11", label: "Creator launch history", value: `${tok.audit.devMints} launches from this deployer — likely a launchpad signer, not a person; not scored`, source: "jupiter", method: "tokens/v2 audit.devMints", explorerUrl: tok.dev ? explorer(tok.dev) : undefined });
    } else if (tok.audit?.devMints !== undefined) {
      const e11 = ev({
        id: "E11",
        label: "Creator launch history",
        value: `${tok.audit.devMints} tokens launched${tok.audit.devMigrations !== undefined ? `, ${tok.audit.devMigrations} graduated` : ""}`,
        source: "jupiter",
        method: "tokens/v2 audit.devMints / devMigrations",
        explorerUrl: tok.dev ? explorer(tok.dev) : undefined,
      });
      input.creatorLaunches = { value: { mints: tok.audit.devMints, migrations: tok.audit.devMigrations ?? null }, source: "jupiter", evidenceIds: [e11] };
    }
    if (tok.audit?.devBalancePercentage !== undefined) {
      const e12 = ev({ id: "E12", label: "Creator holding", value: `${tok.audit.devBalancePercentage.toFixed(2)}%`, source: "jupiter", method: "tokens/v2 audit.devBalancePercentage", explorerUrl: tok.dev ? explorer(tok.dev) : undefined });
      input.creatorHolding = { value: tok.audit.devBalancePercentage, source: "jupiter", evidenceIds: [e12] };
    }
  }

  const verdict = calculateRisk(input);
  verdict.disagreements = disagreements;
  if (verdictNotes.length) verdict.unknowns = [...verdict.unknowns.filter((u) => !u.startsWith("Exit liquidity")), ...verdictNotes];
  const anyLive = trace.some((t) => t.status === "ok") && (mintInfo !== null || tok !== null);

  return {
    mint,
    name: tok?.name ?? "Unknown token",
    symbol: tok?.symbol ?? "?",
    icon: tok?.icon,
    launchpad: tok?.launchpad,
    tokenProgram: mintInfo?.program ?? tok?.tokenProgram,
    mode: anyLive ? "LIVE" : "UNAVAILABLE",
    observedAt,
    evidenceHash: evidenceHash(evidence),
    evidence,
    verdict,
    ladder,
    trace,
    jupiterUrl: jupiterSwapUrl(mint),
  };
}

export function toRadar(t: JupToken): RadarToken {
  const quick: RadarToken["quick"] = [];
  const a = t.audit ?? {};
  if (a.isSus) quick.push({ label: "Flagged", tone: "bad" });
  if (a.mintAuthorityDisabled === false) quick.push({ label: "Mint active", tone: "bad" });
  if (a.freezeAuthorityDisabled === false) quick.push({ label: "Freeze active", tone: "bad" });
  if (a.devMints !== undefined && a.devMints >= 10 && a.devMints < PLATFORM_SIGNER_LAUNCHES) quick.push({ label: `Creator: ${a.devMints} launches`, tone: a.devMints >= 50 ? "bad" : "warn" });
  if (a.devBalancePercentage !== undefined && a.devBalancePercentage > 10) quick.push({ label: `Creator holds ${a.devBalancePercentage.toFixed(0)}%`, tone: "warn" });
  if (a.topHoldersPercentage !== undefined && a.topHoldersPercentage > 50) quick.push({ label: `Top holders ${a.topHoldersPercentage.toFixed(0)}%`, tone: "warn" });
  if (t.isVerified) quick.push({ label: "Verified", tone: "ok" });
  if (a.mintAuthorityDisabled && a.freezeAuthorityDisabled && !quick.some((q) => q.tone === "bad")) quick.push({ label: "Authorities off", tone: "ok" });
  const age = ageHoursOf(t);
  return {
    mint: t.id,
    name: t.name,
    symbol: t.symbol,
    icon: t.icon,
    launchpad: t.launchpad,
    ageMinutes: age === null ? null : Math.round(age * 60),
    mcap: t.mcap,
    liquidity: t.liquidity,
    holderCount: t.holderCount,
    priceChange1h: t.stats1h?.priceChange,
    organicScoreLabel: t.organicScoreLabel,
    creatorLaunches: a.devMints !== undefined && a.devMints < PLATFORM_SIGNER_LAUNCHES ? a.devMints : undefined,
    authoritiesOff: a.mintAuthorityDisabled === true && a.freezeAuthorityDisabled === true,
    quick,
  };
}
