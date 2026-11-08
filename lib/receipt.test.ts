import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { formatReceipt, parseReceiptMemo } from "./receipt";
import { canonicalEvidence, sha256Hex } from "./canonical";

const r = { cluster: "devnet", subject: "mainnet", method: "pulse-risk/2", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", score: 6, band: "Low signals" as const, confidence: 0.78, hash16: "1cde6c943ebfa38e", time: 1794100000 };

test("receipt memo round-trips through the RPC memo format", () => {
  const memo = formatReceipt(r);
  assert.ok(Buffer.byteLength(memo) < 300);
  assert.deepEqual(parseReceiptMemo(`[${memo.length}] ${memo}`), r);
});

test("non-Pulse memos are ignored", () => {
  assert.equal(parseReceiptMemo("[32] ef3638e9db6e42ed938ffefe7de6c9ee"), null);
  assert.equal(parseReceiptMemo(null), null);
});

test("browser hash matches the server hash", async () => {
  const ev = [{ id: "E2", label: "b", value: 2, source: "rpc", method: "m" }, { id: "E1", label: "a", value: "x", source: "rpc", method: "m" }];
  const server = createHash("sha256").update(canonicalEvidence(ev)).digest("hex");
  assert.equal(await sha256Hex(canonicalEvidence(ev)), server);
});
