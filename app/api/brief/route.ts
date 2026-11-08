import { analyze } from "@/lib/ai";
import { clientIp, rateLimited } from "@/lib/cache";
import { evidenceHash } from "@/lib/evidence";
import type { Evidence, Verdict } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (rateLimited(`brief:${clientIp(request)}`, 10, 60_000)) return Response.json({ error: "Too many AI requests — wait a minute." }, { status: 429 });
  const text = await request.text();
  if (text.length > 40_000) return Response.json({ error: "Request too large." }, { status: 413 });
  let body: { evidence?: Evidence[]; verdict?: Verdict; name?: string; symbol?: string };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!Array.isArray(body.evidence) || !body.verdict || !Array.isArray(body.verdict.factors)) return Response.json({ error: "Missing evidence or verdict." }, { status: 400 });
  // The hash is recomputed here, so the cache key always matches the evidence actually analysed.
  const hash = evidenceHash(body.evidence);
  const brief = await analyze(body.evidence, body.verdict, { name: String(body.name ?? ""), symbol: String(body.symbol ?? "") }, hash);
  return Response.json({ evidenceHash: hash, brief });
}
