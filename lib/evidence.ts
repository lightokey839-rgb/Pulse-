import { createHash } from "node:crypto";
import type { Evidence } from "./types";

export function canonicalEvidence(evidence: Evidence[]) {
  return JSON.stringify(
    evidence
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, label, value, source, method, observedAt }) => ({ id, label, value, source, method, observedAt })),
  );
}

export function evidenceHash(evidence: Evidence[]) {
  return createHash("sha256").update(canonicalEvidence(evidence)).digest("hex");
}
