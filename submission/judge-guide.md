# Testing Pulse in 3 minutes (judges)

**Live:** https://pulse-light-af8c.vercel.app — no wallet, no sign-up. Works on a phone.

1. **Home** — live launches from the last few minutes. The right rail counts serial launchers (creators with 50+ tokens).
2. **Tap "Demo: a token that rugged live"** — Elevated, critical flags: no sell route and a serial creator.
3. **Tap "Demo: BONK"** (or search any ticker or mint in the top bar). Check:
   - *How this verdict was built*: each step with source and time; amber = explained fallback.
   - *Exit Ladder*: live Jupiter quotes for selling $100 / $1k / $10k.
   - *AI brief*: tap an evidence chip (E1, E6…) to jump to the evidence row.
4. **Anchor on Solana** (bottom of the token page) — writes a Memo receipt to **Solana mainnet** and shows the decoded memo and an Explorer link. If that evidence was already anchored, it shows the existing receipt instead of writing a duplicate.
5. **Open in ledger → Verify** — recomputes the evidence hash in your browser: ✓ VERIFIED. Then **Tamper demo** changes one value: ✕ MISMATCH.
6. **Ask bar** (bottom) — try "show serial launchers" or "check WIF".

**Good to know**
- Data is live (Solana RPC + Jupiter). If Jupiter rate-limits, steps show amber/red with Retry; results are cached for 60 seconds and labelled CACHED.
- Receipts are rate-limited to a few per minute.
- The AI badge reads "AI · verified" when a model is configured, otherwise "Rule-based" (same evidence, same checks).
- Not financial advice. A low score means fewer warning signs, not safety.
