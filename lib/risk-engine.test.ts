import test from "node:test";
import assert from "node:assert/strict";
import { calculateRisk, type RiskInput } from "./risk-engine";

const rpc = <T,>(value: T, id = "E1") => ({ value, source: "rpc" as const, evidenceIds: [id] });
const jup = <T,>(value: T, id = "E9") => ({ value, source: "jupiter" as const, evidenceIds: [id] });

const clean: RiskInput = {
  mintAuthorityActive: rpc(false),
  freezeAuthorityActive: rpc(false),
  extensions: rpc([]),
  holders: { value: { topWallet: 0.04, topTen: 0.18, method: "rpc" }, source: "derived", evidenceIds: ["E4"] },
  exit: jup({ noRoute: false, impactAt1000: 0.002 }),
  liquidityToFdv: jup(0.06),
  ageHours: jup(4000),
  identity: jup("verified" as const),
  creatorLaunches: jup({ mints: 1, migrations: 1 }),
  creatorHolding: jup(0.5),
};

test("clean token scores low with full coverage", () => {
  const v = calculateRisk(clean);
  assert.ok(v.score < 25, `score ${v.score}`);
  assert.equal(v.band, "Low signals");
  assert.equal(v.coverage, 1);
  assert.equal(v.criticalFlags.length, 0);
});

test("active mint authority plus no sell route scores high with critical flags", () => {
  const v = calculateRisk({ ...clean, mintAuthorityActive: rpc(true), exit: jup({ noRoute: true, impactAt1000: null }) });
  assert.ok(v.score >= 50, `score ${v.score}`);
  assert.equal(v.criticalFlags.length, 2);
});

test("missing data lowers coverage and confidence, not the score", () => {
  const full = calculateRisk(clean);
  const partial = calculateRisk({ ...clean, mintAuthorityActive: null, freezeAuthorityActive: null, exit: null });
  assert.ok(partial.coverage < full.coverage);
  assert.ok(partial.confidence < full.confidence);
  assert.ok(partial.score <= full.score + 1);
  assert.ok(partial.unknowns.length === 3);
});

test("low coverage never shows a reassuring band", () => {
  const v = calculateRisk({ ...clean, mintAuthorityActive: null, freezeAuthorityActive: null, exit: null, holders: null });
  assert.equal(v.band, "Insufficient data");
});

test("serial launcher raises the creator factor", () => {
  const v = calculateRisk({ ...clean, creatorLaunches: jup({ mints: 120, migrations: 2 }) });
  const f = v.factors.find((x) => x.name === "Creator launch history");
  assert.equal(f?.severity, 1);
  assert.ok(v.criticalFlags.some((x) => x.startsWith("Creator launch history")));
  assert.ok(v.score >= 50);
});

test("limited coverage with a calm score is not shown as low signals", () => {
  const v = calculateRisk({ ...clean, holders: null, exit: null });
  assert.ok(v.coverage < 0.8);
  assert.equal(v.band, "Insufficient data");
});

test("permanent delegate is a critical flag", () => {
  const v = calculateRisk({ ...clean, extensions: rpc([{ extension: "permanentDelegate", state: { delegate: "X" } }]) });
  assert.ok(v.criticalFlags.some((x) => x.startsWith("Token-2022")));
});

test("same input gives the same verdict", () => {
  assert.deepEqual(calculateRisk(clean), calculateRisk(clean));
});
