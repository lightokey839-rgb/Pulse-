import Link from "next/link";
import RadarBoard, { type Filter } from "@/components/RadarBoard";

const CHIPS = [
  { href: "/?filter=serial", label: "Show serial launchers" },
  { href: "/trending", label: "What's trending right now?" },
  { href: "/token/%24WIF", label: "Check $WIF" },
  { href: "/?filter=clean", label: "New launches with fewer flags" },
];
const FILTERS: Filter[] = ["all", "clean", "serial", "flagged"];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const initial = FILTERS.includes(filter as Filter) ? (filter as Filter) : "all";
  return (
    <div className="page home">
      <section className="hero2">
        <span className="eyebrow">AI LAUNCH RADAR FOR SOLANA MEMECOINS</span>
        <h1>
          Check before
          <br />
          <em>you sign.</em>
        </h1>
        <p>
          Catch memecoins minutes after launch. Pulse reads the chain, measures what a sell would really return, checks the creator&apos;s history, and has an AI explain it, with every claim tied to evidence.
        </p>
        <div className="hero-ctas">
          <a href="#moving" className="cta primary">Scan new launches</a>
          <Link href="/methodology" className="cta">How it works</Link>
        </div>
        <div className="chips">
          {CHIPS.map((c) => <Link key={c.label} href={c.href} className="chip-link">{c.label}</Link>)}
        </div>
      </section>
      <RadarBoard feed="new" variant="home" initialFilter={initial} />
    </div>
  );
}
