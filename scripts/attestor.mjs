// Attestor wallet helper. The secret key is written only to gitignored local files and never printed.
//   node scripts/attestor.mjs new        create .attestor.local.json and add ATTESTOR_SECRET_KEY to .env.local
//   node scripts/attestor.mjs address    print the attestor address
//   node scripts/attestor.mjs balance    print the devnet balance
//   node scripts/attestor.mjs airdrop    request 1 devnet SOL (often rate-limited; use faucet.solana.com instead)
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";

const FILE = ".attestor.local.json";
const RPC = process.env.ATTEST_RPC_URL || "https://api.devnet.solana.com";
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes) {
  let n = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

async function rpc(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

function load() {
  if (!existsSync(FILE)) throw new Error(`No ${FILE}. Run: node scripts/attestor.mjs new`);
  return JSON.parse(readFileSync(FILE, "utf8"));
}

const cmd = process.argv[2] ?? "address";

if (cmd === "new") {
  if (existsSync(FILE)) {
    console.log(`${FILE} already exists (address ${load().address}). Delete it first to make a new one.`);
    process.exit(1);
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url");
  const pub = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
  const secretKey = [...seed, ...pub]; // Solana 64-byte secret key format
  const address = base58(pub);
  writeFileSync(FILE, JSON.stringify({ address, secretKey }), { mode: 0o600 });
  appendFileSync(".env.local", `\nATTESTOR_SECRET_KEY=${JSON.stringify(secretKey)}\nATTEST_CLUSTER=devnet\n`);
  console.log(`Attestor created: ${address}`);
  console.log(`Secret key saved to ${FILE} and .env.local (both gitignored). It was not printed.`);
  console.log(`Fund it with devnet SOL at https://faucet.solana.com (paste the address above).`);
  console.log(`For Vercel: copy the ATTESTOR_SECRET_KEY line from .env.local into the project's Environment Variables.`);
} else if (cmd === "address") {
  console.log(load().address);
} else if (cmd === "balance") {
  const { value } = await rpc("getBalance", [load().address]);
  console.log(`${load().address}: ${(value / 1e9).toFixed(4)} SOL (devnet)`);
} else if (cmd === "airdrop") {
  try {
    const sig = await rpc("requestAirdrop", [load().address, 1_000_000_000]);
    console.log(`Airdrop requested: ${sig}`);
  } catch (e) {
    console.log(`Airdrop failed (${e.message}). Use https://faucet.solana.com with address ${load().address}`);
  }
} else {
  console.log("Usage: node scripts/attestor.mjs new|address|balance|airdrop");
}
