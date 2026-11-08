import test from "node:test";
import assert from "node:assert/strict";

import { checkSeal, sealVerdict } from "./verdict-seal";

process.env.PULSE_SEAL_SECRET = "test-secret"; // read at call time

const v = { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", score: 5, band: "Low signals" as const, confidence: 0.74, hash: "a".repeat(64), issuedAt: Date.now() };

test("a sealed verdict verifies", () => {
  assert.ok(checkSeal(v, sealVerdict(v)!));
});

test("a tampered score fails", () => {
  assert.equal(checkSeal({ ...v, score: 1 }, sealVerdict(v)!), false);
});

test("an expired seal fails", () => {
  const old = { ...v, issuedAt: Date.now() - 31 * 60_000 };
  assert.equal(checkSeal(old, sealVerdict(old)!), false);
});
