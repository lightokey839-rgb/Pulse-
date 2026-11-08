// Solana JSON-RPC reads. The chain is the source of truth; Jupiter only corroborates.
import { cached } from "./cache";

const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

export const rpcUrl = () => process.env.SOLANA_RPC_URL || PUBLIC_RPC;
export const rpcIsKeyed = () => Boolean(process.env.SOLANA_RPC_URL) && process.env.SOLANA_RPC_URL !== PUBLIC_RPC;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RPC ${method} HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message}`);
  return body.result as T;
}

export type MintExtension = { extension: string; state?: Record<string, unknown> };
export type MintInfo = {
  program: string; // "spl-token" | "spl-token-2022"
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: string;
  decimals: number;
  extensions: MintExtension[];
};

type ParsedAccount = { owner: string; data: { program?: string; parsed?: { type: string; info: Record<string, unknown> } } | string[] } | null;

export async function getMint(mint: string): Promise<MintInfo | null> {
  const { value } = await cached(`rpc:mint:${mint}`, 20_000, () =>
    rpc<{ value: ParsedAccount }>("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]),
  );
  const acc = value.value;
  if (!acc || Array.isArray(acc.data) || acc.data.parsed?.type !== "mint") return null;
  const info = acc.data.parsed.info as {
    mintAuthority: string | null;
    freezeAuthority: string | null;
    supply: string;
    decimals: number;
    extensions?: MintExtension[];
  };
  return {
    program: acc.data.program ?? "unknown",
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
    supply: info.supply,
    decimals: info.decimals,
    extensions: info.extensions ?? [],
  };
}

export type HolderSummary = {
  topWalletShare: number; // 0-1, largest single wallet
  topTenWalletShare: number; // 0-1, top ten wallets combined
  programControlledShare: number; // 0-1, pools/curves/vaults (heuristic)
  walletsResolved: number;
};

// Resolves the 20 largest token accounts to their owners, then classifies each owner:
// an owner account held by a program other than the System Program is "program-controlled (heuristic)".
export async function getHolders(mint: string, supplyRaw: string): Promise<HolderSummary> {
  const { value } = await cached(`rpc:holders:${mint}`, 30_000, async () => {
    const largest = await rpc<{ value: { address: string; amount: string }[] }>("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
    const accounts = largest.value.slice(0, 20);
    if (accounts.length === 0) return { topWalletShare: 0, topTenWalletShare: 0, programControlledShare: 0, walletsResolved: 0 };
    const tokenAccs = await rpc<{ value: ParsedAccount[] }>("getMultipleAccounts", [accounts.map((a) => a.address), { encoding: "jsonParsed" }]);
    const owners = tokenAccs.value.map((acc) => (acc && !Array.isArray(acc.data) ? (acc.data.parsed?.info.owner as string | undefined) : undefined));
    const uniqueOwners = [...new Set(owners.filter((o): o is string => Boolean(o)))];
    const ownerAccs = await rpc<{ value: ParsedAccount[] }>("getMultipleAccounts", [uniqueOwners, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }]);
    const programOwned = new Set(uniqueOwners.filter((o, i) => ownerAccs.value[i] && ownerAccs.value[i]!.owner !== SYSTEM_PROGRAM));

    const supply = Number(BigInt(supplyRaw)) || 1;
    const byWallet = new Map<string, number>();
    let programAmount = 0;
    accounts.forEach((a, i) => {
      const owner = owners[i];
      const amt = Number(BigInt(a.amount));
      if (!owner) return;
      if (programOwned.has(owner)) programAmount += amt;
      else byWallet.set(owner, (byWallet.get(owner) ?? 0) + amt);
    });
    const wallets = [...byWallet.values()].sort((a, b) => b - a);
    return {
      topWalletShare: (wallets[0] ?? 0) / supply,
      topTenWalletShare: wallets.slice(0, 10).reduce((s, v) => s + v, 0) / supply,
      programControlledShare: programAmount / supply,
      walletsResolved: wallets.length,
    };
  });
  return value;
}
