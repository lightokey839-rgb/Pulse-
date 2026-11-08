// Best-effort in-memory cache. Serverless instances may not share it; it only saves calls.
const store = new Map<string, { expires: number; value: unknown }>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.expires > now) return { value: entry.value as T, hit: true };
  const value = await load();
  store.set(key, { expires: now + ttlMs, value });
  if (store.size > 500) {
    for (const [k, v] of store) if (v.expires <= now) store.delete(k);
  }
  return { value, hit: false };
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
