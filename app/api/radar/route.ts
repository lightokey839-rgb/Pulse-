import { toRadar } from "@/lib/dossier";
import { recentTokens, trendingTokens } from "@/lib/jupiter";
import { clientIp, rateLimited } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (rateLimited(`radar:${clientIp(request)}`, 30, 60_000)) return Response.json({ error: "Too many requests — slow down." }, { status: 429 });
  const feed = new URL(request.url).searchParams.get("feed") === "trending" ? "trending" : "new";
  try {
    const { value, hit } = feed === "trending" ? await trendingTokens() : await recentTokens();
    return Response.json({ feed, mode: hit ? "CACHED" : "LIVE", observedAt: new Date().toISOString(), tokens: value.slice(0, 40).map(toRadar) });
  } catch {
    return Response.json({ feed, mode: "UNAVAILABLE", observedAt: new Date().toISOString(), tokens: [] }, { status: 502 });
  }
}
