import type { Evidence } from "./types";

export const EXAMPLES = [
  { mint: "So11111111111111111111111111111111111111112", name: "Wrapped SOL", symbol: "SOL" },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", name: "USD Coin", symbol: "USDC" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6s8oH7s5Z5aNfQbR", name: "Bonk", symbol: "BONK" },
];

export function snapshotFor(query: string) {
  const found = EXAMPLES.find((item) => item.mint.toLowerCase() === query.trim().toLowerCase() || item.symbol.toLowerCase() === query.trim().toLowerCase());
  return found ?? { mint: query.trim() || EXAMPLES[0].mint, name: "Example token", symbol: "EXAMPLE" };
}

export function demoEvidence(now: string, mint: string): Evidence[] {
  return [
    { id: "E1", label: "Mint authority", value: false, source: "rpc", method: "getAccountInfo(jsonParsed)", observedAt: now, explorerUrl: `https://explorer.solana.com/address/${mint}?cluster=devnet` },
    { id: "E2", label: "Freeze authority", value: false, source: "rpc", method: "getAccountInfo(jsonParsed)", observedAt: now },
    { id: "E3", label: "Token program extensions", value: "None detected", source: "rpc", method: "getAccountInfo(jsonParsed)", observedAt: now },
    { id: "E4", label: "Holder concentration", value: "14% top wallet / 41% top 10", source: "rpc", method: "getTokenLargestAccounts + getMultipleAccounts", observedAt: now },
    { id: "E5", label: "Exit impact at $1,000", value: "1.8%", source: "jupiter", method: "swap/v2/order", observedAt: now },
    { id: "E6", label: "Liquidity / FDV", value: "4.4%", source: "jupiter", method: "tokens/v2/search", observedAt: now },
    { id: "E7", label: "Age and activity", value: "312 hours", source: "jupiter", method: "tokens/v2/search", observedAt: now },
    { id: "E8", label: "Identity", value: "unverified", source: "jupiter", method: "tokens/v2/search", observedAt: now },
  ];
}
