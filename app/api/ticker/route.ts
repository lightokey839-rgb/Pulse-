import { trendingTokens } from "@/lib/jupiter";

export const dynamic = "force-dynamic";

// Price strip: verified tokens from Jupiter's 1h trending list, with 24h change.
export async function GET() {
  try {
    const { value, hit } = await trendingTokens();
    const items = value
      .filter((t) => t.isVerified && typeof t.usdPrice === "number")
      .slice(0, 16)
      .map((t) => ({ mint: t.id, symbol: t.symbol, price: t.usdPrice!, change24h: t.stats24h?.priceChange ?? null }));
    return Response.json({ mode: hit ? "CACHED" : "LIVE", items });
  } catch {
    return Response.json({ mode: "UNAVAILABLE", items: [] }, { status: 502 });
  }
}
