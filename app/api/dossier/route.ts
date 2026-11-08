import { buildDossier, resolveToken, SearchUnavailable } from "@/lib/dossier";
import { clientIp, rateLimited } from "@/lib/cache";
import { sealVerdict } from "@/lib/verdict-seal";
import { rememberVerdict } from "@/lib/verdict-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (rateLimited(`dossier:${clientIp(request)}`, 12, 60_000)) return Response.json({ error: "Too many investigations — wait a minute." }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { query?: unknown };
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 64) : "";
  if (!query) return Response.json({ error: "Paste a token mint, symbol or name." }, { status: 400 });
  let found;
  try {
    found = await resolveToken(query);
  } catch (e) {
    if (e instanceof SearchUnavailable) return Response.json({ error: "Token search is busy (Jupiter rate limit). Try again in a few seconds, or paste the mint address." }, { status: 503 });
    throw e;
  }
  if (!found) return Response.json({ error: `No Solana token found for “${query}”.` }, { status: 404 });
  const dossier = await buildDossier(found);
  if (dossier.mode === "UNAVAILABLE") return Response.json({ error: "That address is not a token mint, or data sources are unreachable right now.", dossier }, { status: 502 });
  const v = dossier.verdict;
  rememberVerdict({ mint: dossier.mint, score: v.score, band: v.band, confidence: v.confidence, hash: dossier.evidenceHash });
  const issuedAt = Date.now();
  const seal = sealVerdict({ mint: dossier.mint, score: v.score, band: v.band, confidence: v.confidence, hash: dossier.evidenceHash, issuedAt });
  return Response.json({ ...dossier, seal: seal ? { value: seal, issuedAt } : undefined });
}
