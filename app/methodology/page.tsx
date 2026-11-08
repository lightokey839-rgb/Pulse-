import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works" };

const FACTORS: [string, number, string, string][] = [
  ["Mint authority", 18, "Solana RPC", "Active = 1, disabled = 0. Active is a critical flag."],
  ["Freeze authority", 10, "Solana RPC", "Active = 0.8. Active is a critical flag."],
  ["Token-2022 extensions", 10, "Solana RPC", "Worst extension wins: permanent delegate, non-transferable or frozen-by-default = 1 (critical); transfer hook or pausable = 0.7; transfer fee scaled by basis points."],
  ["Holder concentration", 16, "RPC, owners resolved", "Largest wallet and top-10 wallets, with pools and curves excluded (heuristic). Falls back to Jupiter's figure, capped at 0.5."],
  ["Exit liquidity", 18, "Jupiter quotes", "Price impact selling $1k: >10% = 0.9, 3–10% = 0.5, 1–3% = 0.2. No sell route = 1 (critical). Bonding-curve tokens are not scored."],
  ["Liquidity vs valuation", 6, "Jupiter", "Liquidity under 0.5% of FDV = 0.8; under 2% = 0.4."],
  ["Age", 4, "Jupiter", "Under 24 hours = 0.7, fading over 20 days."],
  ["Identity", 4, "Jupiter", "Flagged suspicious = 1, unverified = 0.4, verified = 0."],
  ["Creator launch history", 8, "Jupiter audit", "Tokens launched by the creator: 50+ = 1 (critical, serial launcher), 10+ = 0.7, 3+ = 0.4."],
  ["Creator holding", 6, "Jupiter audit", "Creator's share of supply: >20% = 1, >10% = 0.6, >5% = 0.3."],
];

export default function MethodologyPage() {
  return (
    <div className="page prose">
      <header className="page-head">
        <div>
          <div className="eyebrow">METHOD · pulse-risk/2</div>
          <h1>How Pulse decides</h1>
          <p className="lede">The score is computed by fixed rules, not by AI. The AI only explains the evidence, and a verifier checks every claim it makes before you see it.</p>
        </div>
      </header>

      <section className="steps">
        <div className="step"><span>01</span><h3>Read the chain</h3><p>Mint and freeze authority and Token-2022 extensions come straight from Solana RPC. When Jupiter disagrees with the chain, Pulse says so and uses the chain.</p></div>
        <div className="step"><span>02</span><h3>Measure the exit</h3><p>Pulse asks Jupiter for real sell quotes of $100, $1k and $10k into USDC. Quotes only: Pulse never sends a swap.</p></div>
        <div className="step"><span>03</span><h3>Check the creator</h3><p>How many tokens the creator wallet has launched, how many graduated, and how much it still holds.</p></div>
        <div className="step"><span>04</span><h3>Explain, then verify</h3><p>The AI writes a brief from the evidence ledger only. Claims without evidence, invented numbers and advice wording are removed.</p></div>
      </section>

      <article className="panel">
        <div className="section-kicker">THE TEN FACTORS · WEIGHTS SUM TO 100</div>
        <div className="method-table">
          {FACTORS.map(([name, w, src, rule]) => (
            <div className="method-row" key={name}>
              <strong>{name}</strong>
              <span className="mono accent">{w}</span>
              <span className="mono muted">{src}</span>
              <p>{rule}</p>
            </div>
          ))}
        </div>
        <p className="fineprint">
          Score = 100 × Σ(weight × severity) ÷ Σ(weight of factors with data). Missing data never lowers the score; it lowers coverage and confidence. Any critical flag lifts the score to at least 50. Coverage under 60%, or under 80% with a calm score, shows &ldquo;Insufficient data&rdquo; instead of a reassuring band.
        </p>
      </article>

      <div className="two-col">
        <article className="panel">
          <div className="section-kicker">AI CLAIM VERIFIER</div>
          <ul className="checklist">
            <li>Every finding must cite an evidence ID that exists.</li>
            <li>Every number must match a value in the cited evidence.</li>
            <li>No buy, sell, &ldquo;safe&rdquo;, &ldquo;guaranteed&rdquo; or price predictions.</li>
            <li>No links or markup. Token names are treated as untrusted data.</li>
            <li>One automatic repair attempt, then a labelled rule-based fallback.</li>
          </ul>
        </article>
        <article className="panel">
          <div className="section-kicker">LIMITS, STATED PLAINLY</div>
          <ul className="checklist">
            <li>Holder owner classification is a heuristic.</li>
            <li>Jupiter data is third-party; quotes are point-in-time.</li>
            <li>Bonding-curve tokens can't be routed by Jupiter yet, so their exit depth isn't scored.</li>
            <li>Pulse runs while it's open; there's no background monitoring.</li>
            <li>A low score is fewer warning signs, not protection. Not financial advice.</li>
          </ul>
        </article>
      </div>

      <p className="muted">Ready? <Link href="/" className="inline-link">Open the launch radar →</Link></p>
    </div>
  );
}
