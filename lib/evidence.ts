import { createHash } from "node:crypto";
import { canonicalEvidence } from "./canonical";
import type { Evidence } from "./types";

export { canonicalEvidence };

export function evidenceHash(evidence: Evidence[]) {
  return createHash("sha256").update(canonicalEvidence(evidence)).digest("hex");
}
