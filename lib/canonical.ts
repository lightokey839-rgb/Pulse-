// Canonical form of an evidence ledger. Pure (no Node APIs) so the browser can recompute hashes too.
type EvidenceLike = { id: string; label: string; value: unknown; source: string; method: string };

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
export function canonicalEvidence(evidence: EvidenceLike[]) {
  return stable(
    evidence
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
      .map(({ id, label, value, source, method }) => ({ id, label, value, source, method })),
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
