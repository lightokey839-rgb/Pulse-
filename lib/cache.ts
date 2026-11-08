// Best-effort in-memory cache. Serverless instances may not share it; it only saves calls.
// - Concurrent requests for the same key share one load (coalescing).
// - If a refresh fails, the last good value is served for up to STALE_MS and marked stale.
const store = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const STALE_MS = 10 * 60_000;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<{ value: T; hit: boolean; stale?: boolean }> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.expires > now) return { value: entry.value as T, hit: true };
  let pending = inflight.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  try {
    const value = await pending;
    store.set(key, { expires: Date.now() + ttlMs, value });
    if (store.size > 500) {
      for (const [k, v] of store) if (v.expires + STALE_MS <= now) store.delete(k);
    }
    return { value, hit: false };
  } catch (err) {
    if (entry && entry.expires + STALE_MS > now) return { value: entry.value as T, hit: true, stale: true };
    throw err;
  }
}

// Simple fixed-window limiter per key (usually client IP).
const windows = new Map<string, { start: number; count: number }>();
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    return false;
  }
  w.count += 1;
  return w.count > limit;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
