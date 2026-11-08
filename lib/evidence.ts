import { createHash } from "node:crypto";
import type { Evidence } from "./types";

// Stable JSON: sorted keys at every level.
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
    .join(",")}}`;
}

// The hash covers what was observed, not when, so identical chain state gives an identical hash.
export function canonicalEvidence(evidence: Evidence[]) {
  return stable(
    evidence
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
      .map(({ id, label, value, source, method }) => ({ id, label, value, source, method })),
  );
}

export function evidenceHash(evidence: Evidence[]) {
  return createHash("sha256").update(canonicalEvidence(evidence)).digest("hex");
}
