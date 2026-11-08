export const usd = (n?: number) =>
  n === undefined || n === null
    ? "—"
    : n >= 1e9
      ? `$${(n / 1e9).toFixed(2)}B`
      : n >= 1e6
        ? `$${(n / 1e6).toFixed(2)}M`
        : n >= 1e3
          ? `$${(n / 1e3).toFixed(1)}K`
          : `$${n.toFixed(0)}`;

export const age = (m: number | null) => (m === null ? "—" : m < 60 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`);
export const short = (s: string) => (s.length > 14 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s);
export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const bandTone = (band: string) => (band === "High" || band === "Elevated" ? "bad" : band === "Moderate" ? "warn" : band === "Low signals" ? "ok" : "muted");
