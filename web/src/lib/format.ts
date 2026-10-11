export const STATUS_COLORS: Record<string, string> = {
  starting: "#94a3b8",
  running: "#2563eb",
  waiting: "#d97706",
  done: "#059669",
  error: "#dc2626",
  cancelled: "#6b7280",
};

export const STATUS_ORDER = ["running", "waiting", "starting", "error", "done", "cancelled"];

export function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function duration(start: number, end?: number | null): string {
  const s = Math.max(0, Math.floor(((end ?? Date.now()) - start) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function isActive(status: string): boolean {
  return status === "running" || status === "waiting" || status === "starting";
}

/** Active but silent for longer than `mins` minutes. */
export function isStale(s: { status: string; updated_at: number }, mins = 10): boolean {
  return (s.status === "running" || s.status === "waiting") && Date.now() - s.updated_at > mins * 60_000;
}
