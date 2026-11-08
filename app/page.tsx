import Link from "next/link";
import RadarBoard, { type Filter } from "@/components/RadarBoard";

const CHIPS = [
  { href: "/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", label: "Demo: BONK, anchored on Solana" },
  { href: "/token/DxFsA32uefKvFdQPdYLzaYZPyEvErduMRPd4rt3tpump", label: "Demo: a token that rugged live" },
  { href: "/ledger", label: "Verify a receipt" },
  { href: "/?filter=serial", label: "Show serial launchers" },
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
          Provable verdicts on Solana memecoins: Pulse reads the chain, measures what a sell would really return and checks the creator&apos;s history. Its AI can only cite that evidence, and every verdict can be anchored on Solana for anyone to verify.
        </p>
        <div className="hero-ctas">
          <a href="#moving" className="cta primary">Scan new launches</a>
          <Link href="/ledger" className="cta">Verify on-chain receipts</Link>
        </div>
        <div className="chips">
          {CHIPS.map((c) => <Link key={c.label} href={c.href} className="chip-link">{c.label}</Link>)}
        </div>
      </section>
      <RadarBoard feed="new" variant="home" initialFilter={initial} />
    </div>
  );
}
