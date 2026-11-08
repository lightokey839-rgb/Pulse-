# Pulse — provable verdicts for Solana memecoins

**Check before you sign.** Pulse catches memecoins minutes after launch, reads what the chain says about them, measures what a sell would really return, and anchors every verdict on Solana so anyone can verify it was never rewritten.

Built for the **MLH Solana Hackathon (Nov 6–8, 2026)**. Live: **https://pulse-light-af8c.vercel.app** · License: MIT

## 60-second tour

1. **Home / New launches.** Live feed of tokens minted minutes ago (pump.fun, Meteora, LaunchLab, bags.fun). Stats show how many come from serial launchers.
2. **Open any token.** Pulse reads mint and freeze authority and Token-2022 extensions straight from Solana, quotes real $100 / $1k / $10k sells through Jupiter, and checks the creator's launch history.
3. **Verdict.** A deterministic 10-factor score with confidence, coverage and critical flags that can't be averaged away.
4. **AI brief.** Written only from the evidence ledger; a verifier deletes any claim that cites nothing, invents a number, or gives advice.
5. **Anchor on Solana.** One click writes a Memo-program receipt with the score, band, method version and evidence hash.
6. **Ledger → Verify.** Receipts are read back from chain (no database). Verify recomputes the hash in your browser: ✓ MATCH, or ✕ MISMATCH if one evidence field changed.

## What Solana does here (not bolted on)

- **Public account state is the evidence.** Authorities, extensions and holder ownership come from RPC reads of the mint and token accounts; the chain wins when third-party data disagrees.
- **Cheap, fast, public receipts.** Each verdict is a Memo transaction (~5,000 lamports, confirmed in seconds) that anyone can read with `getSignaturesForAddress` and check against the evidence. Receipts prove what Pulse said and when, not that it was right.
- **Composability.** The Exit Ladder is built from live Jupiter routes across Solana DEXs; trades hand off to Jupiter for the user to sign.

Receipt format (under 300 bytes):
```
pulse/1 c=devnet n=mainnet v=pulse-risk/2 m=<mint> s=<score> b=<L|M|E|H|I> k=<confidence> h=<first 16 hex of SHA-256> t=<unix>
```
`c` = receipt cluster, `n` = the token's cluster. The server never anchors client-supplied scores: verdicts are HMAC-sealed when computed and re-checked before writing. Writes are idempotent per mint + hash (checked on chain) and rate-limited.

## How AI is used

- `claude-haiku-5-5` (configurable) writes the brief as Zod-validated JSON from the evidence ledger only. Token names are treated as untrusted input.
- The claim verifier (`lib/ai.ts`) checks every finding cites existing evidence IDs, every number appears in the cited evidence, and no advice or reassurance wording appears. One repair retry, then a labelled rule-based fallback.
- Tests cover invented numbers, uncited claims, forbidden wording and a prompt-injection case.

## Live vs simulated

| Part | Status |
|---|---|
| Launch and trending feeds, ticker | LIVE (Jupiter Tokens v2) |
| Authorities, Token-2022 extensions | LIVE (Solana mainnet RPC) |
| Holder concentration | LIVE with a keyed RPC; otherwise Jupiter's figure, labelled |
| Exit Ladder | LIVE Jupiter quotes; bonding-curve tokens shown as "curve only" |
| Creator launch history | LIVE (Jupiter audit data) |
| AI brief | LIVE with `ANTHROPIC_API_KEY`; otherwise labelled rule-based |
| Receipts and Ledger | LIVE on Solana **devnet** (mainnet supported via `ATTEST_CLUSTER`) |
| Ask bar | Keyword matching, labelled "Keyword" (no LLM) |
| Nothing is mocked or pre-recorded. | |

## Run locally (PowerShell)

```powershell
npm install
node scripts/attestor.mjs new      # creates a devnet attestor key in .env.local (gitignored)
# fund the printed address at https://faucet.solana.com
npm run dev
```
Checks: `npm run typecheck`, `npm test` (21 tests), `npm run build`. Health: `GET /api/health`. Env vars: see `.env.example`.

## Roadmap (what the microgrant would fund)

1. **Mainnet attestation.** Move receipts to mainnet and adopt Solana Attestation Service schemas so other apps can read Pulse verdicts natively.
2. **Public Verify API + SDK.** `GET /api/v1/verdict/{mint}` returning verdict, evidence and receipt, plus a small client so wallets and bots can run a pre-trade check.
3. **Agent-readable endpoint and alerts.** A machine-readable pre-sign check for AI trading agents, and live alerts on watched tokens (authority changes, liquidity pulls, creator selling).

**What $1,000 would fund:** keyed RPC and LLM costs for a public beta (~3 months), mainnet attestation fees, and hardening (shared cache, monitoring, rate-limit tuning) so Pulse stays up for real traders.

## Limitations

Holder owner classification is heuristic. Jupiter data is third-party and quotes are point-in-time. Tokens still on a bonding curve can't be routed by Jupiter yet, so their exit depth isn't scored. Pulse runs while open (no background monitoring). A low score means fewer warning signs, not protection. **Not financial advice.**

## Event work disclosure

All code in this repository was written during the event; the first commit is Nov 7, 2026 and the full history is public. The idea and a static UI mockup existed before the event.
