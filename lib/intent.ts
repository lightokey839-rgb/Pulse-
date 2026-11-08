// Turns a plain-English request into a destination in the app. Deterministic, no LLM needed.
export type Intent = { href: string; label: string };

const MINT = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const FILLER = /\b(check|scan|analy[sz]e|investigate|look ?up|lookup|research|is|the|token|coin|memecoin|safe|a|rug|risky|please|me|about|on|for|what|whats|what's|how|does|doing|show|find|of)\b/gi;

export function parseIntent(input: string): Intent | null {
  const text = input.trim();
  if (!text) return null;
  const mint = text.match(MINT)?.[0];
  if (mint) return { href: `/token/${mint}`, label: `Investigate ${mint.slice(0, 4)}…${mint.slice(-4)}` };

  const t = text.toLowerCase();
  if (/serial|repeat (launcher|deployer)|launch farm/.test(t)) return { href: "/?filter=serial", label: "New launches from serial launchers" };
  if (/(fewer|no|least|without) (red )?flags|clean(est)?|lowest risk/.test(t)) return { href: "/?filter=clean", label: "New launches with fewer flags" };
  if (/(warning|flagged|red flag|danger)/.test(t)) return { href: "/?filter=flagged", label: "New launches with warnings" };
  if (/trend|hot|moving|pumping|volume/.test(t)) return { href: "/trending", label: "Trending in the last hour" };
  if (/watch ?list|my (tokens|list)|saved/.test(t)) return { href: "/watchlist", label: "Your watchlist" };
  if (/how (does|do) (it|pulse|you)|method|scor(e|ing) work|explain (the )?score/.test(t)) return { href: "/methodology", label: "How Pulse decides" };
  if (/\b(new|latest|fresh|just launched|launches|newest)\b/.test(t) && !/\$\w/.test(t)) return { href: "/", label: "Newest launches" };

  const ticker = text.match(/\$([A-Za-z0-9]{2,12})/)?.[1];
  const rest = ticker ?? text.replace(FILLER, " ").replace(/[?!.,]/g, " ").trim().split(/\s+/).filter(Boolean)[0];
  if (rest) return { href: `/token/${encodeURIComponent(rest)}`, label: `Investigate ${rest.toUpperCase()}` };
  return null;
}
