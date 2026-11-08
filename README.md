# Pulse — Memecoin Terminal

**Check before you sign.** Pulse is an AI launch radar for Solana memecoins. It streams new and trending launches, then builds a dossier for any token from live chain and Jupiter data: authorities, Token-2022 extensions, holders, a live Exit Ladder, and the creator's launch history. An AI explains the verdict, and every AI claim is machine-checked against the evidence before it is shown.

## 60-second summary

1. **Radar.** New launches (Jupiter `tokens/v2/recent`) and 1h trending, refreshed while the page is open. Each row shows quick flags such as *Creator: 852 launches* or *Mint active*.
2. **Dossier.** Click a token. Pulse reads the mint on chain (`getAccountInfo` jsonParsed), resolves top holders to owners (`getTokenLargestAccounts` + `getMultipleAccounts`), and quotes real sells of $100, $1k and $10k into USDC (Jupiter `swap/v2/order`, quote only).
3. **Verdict.** A deterministic, weighted risk score with confidence, coverage, and critical flags that can't be averaged away: active mint or freeze authority, a dangerous Token-2022 extension, no sell route, or a serial launcher.
4. **AI brief.** Generated only from the evidence ledger. A verifier drops any finding that cites no evidence, cites a missing ID, contains a number not in its cited evidence, or uses advice or reassurance wording. With no LLM key, a rule-based explanation is shown and labelled as such.
5. **Evidence.** Every fact has an ID (E1…E12), a source and a method. The SHA-256 evidence hash covers values, not timestamps, so the same chain state gives the same hash. The bundle downloads as JSON.
6. **Trade.** "Open in Jupiter" opens Jupiter's swap page. The user trades and signs there; Pulse never holds funds or executes swaps.

## How Solana is used
- Mint authority, freeze authority and Token-2022 extensions are read directly from chain, and chain data wins when Jupiter disagrees.
- Holder concentration is computed by resolving token accounts to owners and excluding program-owned accounts such as pools and curves (heuristic, labelled).
- Exit liquidity is measured with live Jupiter routes across Solana DEXs.

## How AI is used
- Model: `claude-haiku-5-5` by default (`LLM_MODEL`), with JSON output validated by a Zod schema.
- Token name and symbol are untrusted: they're sanitised, delimited, and the model is told to treat them as data.
- The claim verifier is in `lib/ai.ts` and tested in `lib/ai.test.ts`, including invented numbers, uncited claims, forbidden wording and a prompt-injection case. A failed check triggers one repair retry, then falls back to the rule-based explanation.

## Run locally (PowerShell)

```powershell
cd C:\Users\HomePC\Documents\Codex\2026-11-07\sta\work\pulse
npm install
Copy-Item .env.example .env.local   # then fill in keys (optional)
npm run dev
```

Checks: `npm run typecheck`, `npm test`, `npm run build`. Health: `GET /api/health`.

## Deploy (Vercel)
Import the GitHub repo in Vercel (framework: Next.js, no build settings needed), add the env vars from `.env.example`, and deploy. Everything works without keys, just slower and with a rule-based brief.

## Limitations
- Tokens still on a launchpad bonding curve can't be routed by Jupiter, so their exit depth shows "curve only" (heuristic) and isn't scored.
- Creator history comes from Jupiter's `devMints` / `devMigrations`. Deployers with 20,000+ launches are treated as launchpad signers and not scored.
- Owner classification is heuristic. Jupiter data is third-party. Quotes are point-in-time.
- The radar refreshes only while the page is open; there is no background monitoring.
- A lower score means fewer warning signs were found, not that a token is protected from loss. Not financial advice.

## Roadmap
v2: creator wallet forensics (bundled launch buys, prior rugs), natural-language search, on-chain Memo receipts with a Ledger page, in-app wallet swap, watch alerts. v3: launchpad stream with graduation alerts, a public AI scorecard of 24h outcomes, agent API. See `Pulse Terminal — Build Spec.md`.
