# MLH submission text (copy into the form)

**Project name:** Pulse

**Tagline (under 80 chars):** Provable verdicts for Solana memecoins: check before you sign.

**Demo URL:** https://pulse-light-af8c.vercel.app
**Repo:** https://github.com/lightokey839-rgb/Pulse-
**Video:** <paste link>

## What it does
Pulse catches Solana memecoins minutes after launch and builds an evidence-first dossier for any token: mint and freeze authority and Token-2022 extensions read directly from Solana, live Jupiter sell quotes at $100 / $1k / $10k (the Exit Ladder), and the creator's launch history. A deterministic 10-factor score with critical flags gives the verdict; an AI writes the brief but can only cite that evidence. Every verdict can be anchored on Solana as a Memo receipt, and anyone can verify it on the Ledger page by recomputing the evidence hash.

## Why
In the two days before this hackathon I lost a little over $25 on Solana memecoins I found on pump.fun and DEX screeners. I was in profit and couldn't sell for what the chart showed until it became a loss; I aped fresh launches without knowing who held the supply; and I bought a copycat ticker. Every answer was already on Solana — it just took too long to find. Pulse puts it on one screen in seconds, starting with the number I never had: what a sell would actually return.

Most new memecoins come from repeat deployers — in our feed, roughly 4 in 10 recent launches came from creators with 50+ prior tokens. During testing, Pulse caught a token that collapsed from about $3K to $61 in minutes: no sell route, creator with 2,469 launches. Free scanners give a score; Pulse gives evidence, a measured exit, and a verdict that can't be quietly rewritten.

## How we built it
Next.js on Vercel. Solana RPC reads (getAccountInfo jsonParsed, getTokenLargestAccounts, getMultipleAccounts). Jupiter Tokens v2, Price and Swap v2 (quote-only). @solana/kit + @solana-program/memo for receipts; getSignaturesForAddress to read them back. An LLM (live: openai/gpt-oss-20b on Groq; Anthropic Claude also supported) with Zod-validated JSON and a claim verifier. Receipts are written to Solana mainnet. SHA-256 over canonical JSON; HMAC-sealed verdicts so the server never anchors client-supplied scores. 21 automated tests.

## Challenges
Jupiter can't route tokens still on a bonding curve, which first looked like "no exit" for every new launch — we now detect and label "curve only". Copycat tickers ($WIF vs WIF) — resolved by ranking verified, deepest-liquidity matches. Making receipts trustworthy across serverless instances without a database — solved with sealed verdicts and on-chain idempotency checks.

## Accomplishments
A live verdict pipeline that caught a real rug as it happened; receipts that verify end to end (✓ MATCH, and ✕ MISMATCH when one evidence field is changed); an AI that is structurally prevented from citing facts it wasn't given.

## What we learned
Third-party audit data needs the chain as a referee; "no data" must lower confidence, never the risk score; and on-chain receipts are a cheap way to make AI output accountable.

## What's next
Solana Attestation Service schemas for the mainnet receipts, a public Verify API/SDK for wallets and bots, and an agent-readable pre-sign endpoint with live alerts.

## Prize tracks

**Top 3 Overall.** Pulse uses Solana for what it's good at: public account state as the evidence, cheap fast receipts anyone can verify, and composability with Jupiter's routes. It's a working product a trader can use today, with a clear plan to keep building.

**AI Track.** AI makes on-chain activity safer and Solana makes the AI verifiable: an evidence-bound analyst flags risky tokens before signing, a verifier removes unsupported claims, and the evidence hash of each verdict is recorded on chain.

**DeFi Track.** Trading analytics built on composability: live Jupiter sell quotes become an Exit Ladder that shows what a sell would actually return, alongside launch and trending feeds, holder and creator analytics, and a hand-off to Jupiter to trade.

**Technologies:** Solana, @solana/kit, Memo program, Jupiter APIs, Helius, Next.js, TypeScript, Vercel, Groq (gpt-oss-20b), Zod.

**AI coding tools:** Claude Code (Claude Opus 5.5) and OpenAI Codex.
