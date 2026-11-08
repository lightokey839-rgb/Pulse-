// Attestor configuration shared by the attest, ledger and health routes. Server-only.
export type Cluster = "devnet" | "mainnet-beta";

export const attestCluster = (): Cluster => (process.env.ATTEST_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet");

export function attestRpcUrl() {
  if (process.env.ATTEST_RPC_URL) return process.env.ATTEST_RPC_URL;
  if (attestCluster() === "mainnet-beta") return process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return "https://api.devnet.solana.com";
}

export function attestWsUrl() {
  if (process.env.ATTEST_WS_URL) return process.env.ATTEST_WS_URL;
  return attestRpcUrl().replace(/^http/, "ws");
}

export function explorerTx(sig: string) {
  return `https://explorer.solana.com/tx/${sig}${attestCluster() === "devnet" ? "?cluster=devnet" : ""}`;
}

export function explorerAddress(addr: string) {
  return `https://explorer.solana.com/address/${addr}${attestCluster() === "devnet" ? "?cluster=devnet" : ""}`;
}

export function attestorSecret(): Uint8Array | null {
  const raw = process.env.ATTESTOR_SECRET_KEY;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) return null;
    return new Uint8Array(arr);
  } catch {
    return null;
  }
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes: Uint8Array) {
  let n = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  let out = "";
  while (n > BigInt(0)) {
    out = ALPHABET[Number(n % BigInt(58))] + out;
    n /= BigInt(58);
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

// The public key is the second half of the 64-byte Solana secret key.
export function attestorAddress(): string | null {
  const s = attestorSecret();
  return s ? base58(s.slice(32)) : null;
}

// Receipt history needs the `memo` field from getSignaturesForAddress, which some keyed providers
// don't return. Read history from Solana's own public endpoint first, then fall back to the keyed one.
const PUBLIC_RPC: Record<Cluster, string> = { devnet: "https://api.devnet.solana.com", "mainnet-beta": "https://api.mainnet-beta.solana.com" };

export async function receiptHistory<T>(address: string): Promise<T> {
  const params = [address, { limit: 100, commitment: "confirmed" }];
  try {
    return await attestRpc<T>("getSignaturesForAddress", params, process.env.ATTEST_HISTORY_RPC_URL || PUBLIC_RPC[attestCluster()]);
  } catch {
    return attestRpc<T>("getSignaturesForAddress", params);
  }
}

export async function attestRpc<T>(method: string, params: unknown[], url = attestRpcUrl()): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result as T;
}

export async function attestorBalanceLamports(): Promise<number | null> {
  const addr = attestorAddress();
  if (!addr) return null;
  try {
    const r = await attestRpc<{ value: number }>("getBalance", [addr, { commitment: "confirmed" }]);
    return r.value;
  } catch {
    return null;
  }
}
