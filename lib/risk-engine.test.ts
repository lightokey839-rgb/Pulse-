import test from "node:test";
import assert from "node:assert/strict";
import { calculateRisk } from "./risk-engine";
const base = { mintAuthorityActive: false, freezeAuthorityActive: false, token2022Extension: null, topWalletShare: 0.14, topTenWalletShare: 0.41, exitImpactAt1000: 0.018, liquidityToFdv: 0.044, ageHours: 312, identity: "unverified" as const };
test("clean vector stays below elevated", () => assert.ok(calculateRisk(base).score < 50));
test("showstoppers raise score and critical flags", () => { const result = calculateRisk({ ...base, mintAuthorityActive: true, exitImpactAt1000: -1 }); assert.ok(result.score >= 50); assert.equal(result.criticalFlags.length, 2); });
test("missing data lowers coverage", () => { const result = calculateRisk({ ...base, mintAuthorityActive: null, freezeAuthorityActive: null, exitImpactAt1000: null }); assert.ok(result.coverage < 0.8); assert.ok(result.unknowns.length > 0); });
