# Pulse Terminal — Build Spec

*A memecoin launch radar with an evidence-bound AI analyst, on Solana. Written Nov 8, 2026, to replace the earlier Pulse prompt. Reusable for any Solana, AI or DeFi hackathon.*

**Pitch:** catch memecoins at launch, see what the chain knows before you buy, and trade from one screen.
**Tagline:** Check before you sign.

## 1. The insight

On Solana, a memecoin has no real on-chain "upcoming" stage. It's mostly a social post until the mint exists. The window a trader can act in is:

| Stage | What exists on chain | What Pulse shows |
| --- | --- | --- |
| On the bonding curve | Launchpad curve account, early buys | Curve progress to graduation, buy pace, holder growth |
| About to graduate | Curve close to complete | Alert, with a dossier already prepared |
| Just graduated | DEX pool, first trades | Exit Ladder, creator selling, liquidity changes |

Pre-launch hype from X or Telegram is a later add-on, not the core (the X API is expensive).

## 2. Product parts

1. **Radar.** A live feed of new and trending tokens. v1: Jupiter Tokens v2 `/recent` and `/toptrending/1h`. v3: launchpad program logs over WebSocket (`logsSubscribe`), with curve progress.
2. **AI search.** Natural language goes to structured filters, validated with Zod and shown as editable chips before anything applies. A keyword parser works without an LLM key.
3. **Launch dossier.** Every fact gets an evidence ID (E1…), a source (rpc, jupiter, derived), a method and a timestamp.
   - Mint and freeze authority, Token-2022 extensions (RPC `getAccountInfo` jsonParsed)
   - Holder concentration with owners resolved; program-owned accounts (pools, curves) are excluded and labelled as heuristic
   - Exit Ladder: Jupiter `/swap/v2/order` sell quotes at $100, $1k and $10k
   - Liquidity vs FDV, age, organic score, Jupiter audit flags (with a disagreement chip when they conflict with RPC)
   - v2: **creator history** (prior tokens from the deployer and how they ended) and **bundled launch buys** (same-slot buyers funded from one source)
4. **AI brief.** Generated only from the evidence ledger. JSON output, validated. The claim verifier drops any finding that doesn't cite an existing evidence ID, any number missing from its cited evidence, and forbidden words (safe, guaranteed, buy, sell, invest, will rise, moon). A rule-based fallback works with no key. Token name and description are untrusted input, so they're sanitised and placed in a delimited block.
5. **Trade.** v1: a deep link that opens Jupiter (Pulse holds nothing). v2: the user's own wallet signs a Jupiter order in the app, after the dossier and a simulated sell are shown.
6. **Watch.** v2: alerts while a coin is held: the creator wallet sells, an authority changes, or liquidity is pulled. Runs only while the tab is open, and the UI says so.
7. **On-chain track record.** v2: each verdict is written as a Memo receipt (`pulse/1 m=<mint> s=<score> h=<hash16> t=<unix>`). v3: a public **AI scorecard** comparing what happened 24h later to tokens flagged high-risk versus low-risk.

## 3. Rules

- The AI shows risk and evidence and never says buy, sell or hold. A low score is never "safe".
- No custody, no auto-sniping, no server-held user keys. The only server signer is the receipt attestor.
- Label every data group LIVE, CACHED, DEMO or UNAVAILABLE. Never present demo data as live.
- Secrets live in env vars only. Never paste keys into chats or commit them.
- Verify every Solana, Jupiter and launchpad API from current docs or a live response before relying on it. Never guess field names.

## 4. Risk engine (deterministic, pure)

The score runs from 0 to 100, where higher means more risk. Factors have weights; unknown factors lower coverage and confidence, never the score. Critical flags override averaging: active mint authority, active freeze authority, PermanentDelegate, no sell route, and (v2) a creator with prior rugs.

| Factor | Weight | v |
| --- | --- | --- |
| Mint authority | 18 | 1 |
| Freeze authority | 10 | 1 |
| Token-2022 extensions | 10 | 1 |
| Holder concentration | 16 | 1 |
| Exit liquidity | 18 | 1 |
| Liquidity vs FDV | 6 | 1 |
| Age | 4 | 1 |
| Identity / audit flags | 4 | 1 |
| Creator launch history (50+ launches is critical) | 8 | 1 |
| Creator holding (v2: bundled launch buys) | 6 | 1 |

Bands: 0–24 low signals, 25–49 moderate, 50–74 elevated, 75+ high. Below 80% coverage, add "Limited data"; below 60%, show "Insufficient data" instead of a band. The evidence hash is SHA-256 of the canonical ledger **without timestamps**, so the same chain state gives the same hash.

## 5. Stack

Next.js (App Router) on Vercel. Server route handlers only call providers: a keyed RPC (Helius or similar) in `SOLANA_RPC_URL`, Jupiter with `x-api-key` from `JUPITER_API_KEY` (1 rps free), and Anthropic through `ANTHROPIC_API_KEY` with `LLM_MODEL` (default `claude-haiku-5-5`). Cache in memory with a TTL, rate-limit expensive routes, and use the `AI_ENABLED` kill switch.

## 6. Versions

| Version | Scope | Done when |
| --- | --- | --- |
| **v1 (built Nov 8)** | Radar (Jupiter feeds), live dossier (RPC + Jupiter), Exit Ladder, creator launch history (Jupiter `audit.devMints` / `devMigrations`), AI brief with verifier and fallback, Open in Jupiter | A judge pastes any mint on the live URL and gets a real, cited verdict in under 10 s |
| **v2** | Bundled-buy detection, prior-rug detection for creators, AI search chips, Memo receipts and a Ledger page, in-app wallet swap, watch alerts, real bonding-curve progress | Receipts appear on the explorer; a known serial-rug creator is flagged |

**Learned while building v1 (verified against live APIs, Nov 8):**
- Jupiter's token feed already exposes `launchpad`, `dev`, `audit.devMints`, `audit.devMigrations` and `audit.devBalancePercentage`, so creator history works in v1. Deployers with 20,000+ launches are launchpad signers, not people.
- Jupiter's swap API can't quote tokens still on a bonding curve ("Failed to get quotes", even for $10). Pulse shows "curve only" instead of a false "no sell route".
- `audit.topHoldersPercentage` is on a 0–100 scale and includes pools, so it is only a fallback.
- The public RPC rate-limits `getTokenLargestAccounts`; a keyed RPC is needed for owner-resolved holders.
| **v3** | Launchpad stream with graduation alerts, AI scorecard, Telegram alerts, agent API `/api/v1/verdict/{mint}` | The scorecard shows 24h outcomes computed from on-chain data |

## 7. Two-minute demo

| Time | The judge sees |
| --- | --- |
| 0:00 | Radar: new tokens streaming in, each with a risk chip |
| 0:15 | Click a token: the dossier fills in step by step, each step showing its source |
| 0:40 | Verdict and AI brief, with [E3]-style citations that open the evidence |
| 1:00 | Exit Ladder: what selling $1k would actually return |
| 1:15 | A risky token next to it: active mint authority, no sell route, flagged |
| 1:35 | Check before you sign: Open in Jupiter (v2: wallet swap and receipt) |
| 1:55 | Tagline |

## 8. Submission kit

README (60-second summary, how Solana is used, how AI is used, limitations), the form copy with one paragraph per prize, the video script, and a judge Q&A covering how it differs from RugCheck, what happens if the AI hallucinates, why Solana, and that it isn't financial advice.
