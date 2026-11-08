import { clientIp, rateLimited } from "@/lib/cache";
import { livePrice } from "@/lib/jupiter";

export const dynamic = "force-dynamic";
const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: Request) {
  if (rateLimited(`price:${clientIp(request)}`, 40, 60_000)) return Response.json({ error: "Too many price requests." }, { status: 429 });
  const mint = new URL(request.url).searchParams.get("mint") ?? "";
  if (!MINT.test(mint)) return Response.json({ error: "Invalid mint." }, { status: 400 });
  try {
    const { value, stale } = await livePrice(mint);
    const ageMs = Date.now() - (value.fetchedAt ?? 0);
    // LIVE only when the price itself was fetched from Jupiter within the last 10 seconds.
    return Response.json({ mint, usdPrice: value.usdPrice, change24h: value.priceChange24h ?? null, mode: !stale && ageMs < 10_000 ? "LIVE" : "CACHED", fetchedAt: new Date(value.fetchedAt ?? Date.now()).toISOString() });
  } catch {
    return Response.json({ mint, mode: "UNAVAILABLE" }, { status: 502 });
  }
}
