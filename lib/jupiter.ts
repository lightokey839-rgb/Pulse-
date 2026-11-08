// Jupiter APIs, server-side only. Field names below were checked against live responses on 2026-11-07.
import { cached } from "./cache";

const BASE = "https://api.jup.ag";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type JupToken = {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  decimals: number;
  dev?: string;
  tokenProgram?: string;
  launchpad?: string;
  holderCount?: number;
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  liquidity?: number;
  isVerified?: boolean;
  organicScore?: number;
  organicScoreLabel?: string;
  createdAt?: string;
  firstPool?: { id: string; createdAt: string };
  stats1h?: { priceChange?: number };
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number; // 0-100, can include pool accounts
    devBalancePercentage?: number; // 0-100
    devMints?: number;
    devMigrations?: number;
    isSus?: boolean;
  };
  tags?: string[];
};

export type JupOrder = {
  outAmount: string;
  priceImpactPct?: string; // fraction, negative = loss
  priceImpact?: number; // percent
  feeBps?: number;
  router?: string;
  inUsdValue?: number;
  outUsdValue?: number;
  routePlan?: { swapInfo?: { label?: string } }[];
};

export class JupiterError extends Error {
  constructor(public status: number, public body: string) {
    super(`Jupiter ${status}: ${body.slice(0, 200)}`);
  }
}

// Keyless Jupiter allows about 0.5 requests/second; a free key allows 1/second.
let nextSlot = 0;
async function throttle() {
  const gap = process.env.JUPITER_API_KEY ? 1050 : 2050;
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + gap;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function jget<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await throttle();
    const headers: Record<string, string> = { accept: "application/json" };
    if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;
    const res = await fetch(BASE + path, { headers, signal: AbortSignal.timeout(9000), cache: "no-store" });
    if (res.status === 429 && attempt === 0) continue;
    const text = await res.text();
    if (!res.ok) throw new JupiterError(res.status, text);
    return JSON.parse(text) as T;
  }
  throw new JupiterError(429, "rate limited");
}

export const jupiterMode = () => (process.env.JUPITER_API_KEY ? "keyed" : "keyless");

export function recentTokens() {
  return cached("jup:recent", 15_000, () => jget<JupToken[]>("/tokens/v2/recent"));
}

export function trendingTokens() {
  return cached("jup:trending", 45_000, () => jget<JupToken[]>("/tokens/v2/toptrending/1h?limit=40"));
}

export function searchTokens(query: string) {
  const q = query.trim().slice(0, 64);
  return cached(`jup:search:${q.toLowerCase()}`, 30_000, () => jget<JupToken[]>(`/tokens/v2/search?query=${encodeURIComponent(q)}`));
}

export function sellQuote(mint: string, rawAmount: bigint) {
  return cached(`jup:order:${mint}:${rawAmount}`, 60_000, () =>
    jget<JupOrder>(`/swap/v2/order?inputMint=${mint}&outputMint=${USDC_MINT}&amount=${rawAmount.toString()}`),
  );
}

export function isNoRoute(err: unknown) {
  return err instanceof JupiterError && err.status >= 400 && err.status < 500 && /route|liquidity|failed to get quotes|no.*found/i.test(err.body);
}

export function jupiterSwapUrl(mint: string) {
  // Opens Jupiter's own swap page with this token selected. The user signs there; Pulse never executes swaps.
  return `https://jup.ag/swap?sell=${USDC_MINT}&buy=${mint}`;
}
