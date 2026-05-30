// Lightweight API client for the dashboard. The token is stored in localStorage and
// sent as a Bearer header (and as ?token= for the WebSocket upgrade).

export interface Session {
  id: string;
  project_id: string | null;
  agent_type: string;
  title: string | null;
  status: string;
  cwd: string | null;
  host: string | null;
  pid: number | null;
  started_at: number;
  updated_at: number;
  ended_at: number | null;
  exit_code: number | null;
  last_seq: number;
  meta_json: string | null;
}

export interface Stats {
  total: number;
  status: Record<string, number>;
  agents: Record<string, number>;
}

export interface LogLine {
  seq: number;
  ts: number;
  stream: "stdout" | "stderr";
  content: string;
}

export interface AgentEvent {
  id: number;
  ts: number;
  type: string;
  level: string;
  message: string | null;
  data_json: string | null;
}

const TOKEN_KEY = "agentboard.token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "dev-local-key";
}
export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export const api = {
  listSessions: () => req<{ sessions: Session[] }>("/sessions"),
  getSession: (id: string) => req<{ session: Session }>(`/sessions/${id}`),
  stats: () => req<Stats>("/stats"),
  logs: (id: string, after = 0) =>
    req<{ lines: LogLine[] }>(`/sessions/${id}/logs?after=${after}&limit=2000`),
  events: (id: string) => req<{ events: AgentEvent[] }>(`/sessions/${id}/events`),
  sendCommand: (id: string, kind: string, payload?: Record<string, unknown>) =>
    req<{ id: string }>(`/sessions/${id}/commands`, {
      method: "POST",
      body: JSON.stringify({ kind, payload }),
    }),
};

export function streamUrl(id: string): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/api/v1/sessions/${id}/stream?token=${encodeURIComponent(
    getToken(),
  )}`;
}
