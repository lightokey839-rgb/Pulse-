import { buildDossier, resolveToken } from "@/lib/dossier";
import { clientIp, rateLimited } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (rateLimited(`dossier:${clientIp(request)}`, 12, 60_000)) return Response.json({ error: "Too many investigations — wait a minute." }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { query?: unknown };
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 64) : "";
  if (!query) return Response.json({ error: "Paste a token mint, symbol or name." }, { status: 400 });
  const found = await resolveToken(query);
  if (!found) return Response.json({ error: `No Solana token found for “${query}”.` }, { status: 404 });
  const dossier = await buildDossier(found);
  if (dossier.mode === "UNAVAILABLE") return Response.json({ error: "That address is not a token mint, or data sources are unreachable right now.", dossier }, { status: 502 });
  return Response.json(dossier);
}
