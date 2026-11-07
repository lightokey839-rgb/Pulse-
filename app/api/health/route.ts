export async function GET() {
  return Response.json({ ok: true, checkedAt: new Date().toISOString(), services: { rpc: process.env.SOLANA_RPC_URL && process.env.ALLOW_PUBLIC_RPC === "true" ? "configured" : "demo fallback", jupiter: process.env.JUPITER_API_KEY ? "configured" : "keyless/demo fallback", llm: process.env.ANTHROPIC_API_KEY && process.env.AI_ENABLED !== "false" ? "configured" : "rule-based fallback", attestor: process.env.ATTESTOR_SECRET_KEY ? "configured" : "unavailable — fund/configure attestor" } });
}
