# Likely judge questions

**How is this different from RugCheck and other scanners?**
Scanners give a score. Pulse shows the evidence behind it, measures the exit with live sell quotes, checks the creator's launch history, and anchors each verdict on Solana so anyone can verify it later. Its AI can't cite anything that isn't in the evidence.

**What if the AI hallucinates?**
The score never comes from AI. The AI only explains, and a verifier removes any finding that cites no evidence, cites a missing ID, contains a number not in the cited evidence, or uses advice wording. If everything fails, a labelled rule-based explanation is shown.

**Why Solana?**
The evidence is public Solana account state, receipts cost about 5,000 lamports and confirm in seconds, and Jupiter's composable routing gives real exit quotes. A receipt per verdict would be impractical on a slow or expensive chain.

**Is this financial advice?**
No. Pulse shows risk signals and evidence and never says buy, sell or hold. A low score means fewer warning signs, not safety.

**What's live versus recorded?**
Everything is live: feeds, RPC reads, quotes and receipts. Receipts are written to Solana mainnet. Without an AI key the brief is labelled rule-based.

**Can someone fake a receipt?**
Only the attestor wallet's history counts, and Pulse never anchors scores sent by the browser — verdicts are sealed server-side when computed. Receipts prove what Pulse said and when, not that it was right.

**What was built before the event?**
The idea and a static UI mockup. All code in the repo was written during the event; see the commit history.
