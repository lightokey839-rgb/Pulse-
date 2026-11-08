"use client";
import { useCallback, useEffect, useState } from "react";

export type WatchItem = { mint: string; symbol: string; name: string; icon?: string; score?: number; band?: string; addedAt: string };
const KEY = "pulse.watchlist.v1";

function read(): WatchItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WatchItem[]) : [];
  } catch {
    return [];
  }
}

// Stored in this browser only. Shared across tabs via the storage event.
export function useWatchlist() {
  const [items, setItems] = useState<WatchItem[]>([]);
  useEffect(() => {
    setItems(read());
    const onStorage = (e: StorageEvent) => e.key === KEY && setItems(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const save = useCallback((next: WatchItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: the list still works for this visit */
    }
  }, []);
  const has = useCallback((mint: string) => items.some((i) => i.mint === mint), [items]);
  const toggle = useCallback(
    (item: Omit<WatchItem, "addedAt">) => {
      const current = read();
      save(current.some((i) => i.mint === item.mint) ? current.filter((i) => i.mint !== item.mint) : [{ ...item, addedAt: new Date().toISOString() }, ...current]);
    },
    [save],
  );
  const update = useCallback(
    (mint: string, patch: Partial<WatchItem>) => {
      const current = read();
      if (!current.some((i) => i.mint === mint)) return;
      save(current.map((i) => (i.mint === mint ? { ...i, ...patch } : i)));
    },
    [save],
  );
  return { items, has, toggle, update };
}
