# Pulse

Pulse is an evidence-bound Solana token investigator. The first build gate is a judge-facing vertical slice: paste a token or choose an example, inspect the trace, review the deterministic risk verdict, open the Exit Ladder, download the evidence bundle, and see the honest receipt-unavailable state until an attestor is configured.

## Run locally

```powershell
cd C:\Users\HomePC\Documents\Codex\2026-11-07\sta\work\pulse
$env:NPM_CONFIG_CACHE = Join-Path (Get-Location) '.npm-cache'
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Current data labels

The first gate intentionally returns recorded DEMO evidence. It never presents the snapshot as live and it never invents a Solana receipt. The next gate wires keyed RPC/Jupiter adapters, the claim verifier, and the devnet Memo attestor behind the existing route boundaries.

## Environment

See `.env.example`. Secrets stay server-side. `ATTESTOR_SECRET_KEY` is intentionally empty until a funded devnet wallet is generated and approved for use.

## Verification

The risk engine has vectors for clean data, critical flags, and missing data coverage. In this environment, dependency installation could not complete because the npm registry request stalled; run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` on a normal networked machine before deployment.

Not financial advice. Monitoring runs only while Pulse is open. Receipts prove what Pulse said and when, not that it was right. Owner classification will be heuristic, and Jupiter data is third-party.
