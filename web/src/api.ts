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
  department_id: string | null;
  task_id: string | null;
  tags: string | null; // JSON array
}

export interface Stats {
  total: number;
  status: Record<string, number>;
  agents: Record<string, number>;
  by_department: Record<string, Record<string, number>>;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  members: number;
  status_counts: Record<string, number>;
}

export interface AgentRow {
  id: string;
  name: string;
  agent_type: string;
  department_id: string | null;
  role: string | null;
  capabilities: string[];
}

export interface Rule {
  id: string;
  department_id: string;
  match_field: string;
  match_op: string;
  match_value: string;
  priority: number;
}

export interface Goal {
  id: string;
  parent_id: string | null;
  title: string;
  level: string | null;
  status: string;
  task_counts: Record<string, number>;
}

export interface Task {
  id: string;
  goal_id: string | null;
  department_id: string | null;
  title: string;
  description: string | null;
  status: string;
  depends_on: string[];
  ready: boolean;
  claimed_by: string | null;
  lease_until: number | null;
  updated_at: number;
}

export interface Decision {
  id: string;
  session_id: string | null;
  task_id: string | null;
  question: string;
  options: string[];
  status: string;
  answer: string | null;
  created_at: number;
}

export interface Analysis {
  id: string;
  framework: string;
  target_type: string;
  target_id: string | null;
  analyzer: string;
  status: string;
  created_at: number;
  result: {
    verdict?: string;
    findings?: { item: string; ok: boolean; note: string; quote?: string }[];
    questions?: string[];
    recommendation?: string;
    confidence?: number;
    evidence?: { type: string; id: string }[];
    disclaimer?: string;
  };
}

export interface Framework {
  id: string;
  name: string;
  summary: string;
  applies_to: string[];
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
  departments: () => req<{ departments: Department[]; unassigned: Record<string, number> }>("/departments"),
  createDepartment: (name: string, slug?: string, description?: string) =>
    req<{ id: string }>("/departments", { method: "POST", body: JSON.stringify({ name, slug, description }) }),
  deleteDepartment: (id: string) => req<{ ok: boolean }>(`/departments/${id}`, { method: "DELETE" }),
  assign: (sessionId: string, department: string | null) =>
    req<{ ok: boolean }>(`/sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify({ department }) }),
  agents: () => req<{ agents: AgentRow[] }>("/agents"),
  createAgent: (b: { name: string; agent_type: string; department?: string; role?: string }) =>
    req<{ id: string }>("/agents", { method: "POST", body: JSON.stringify(b) }),
  deleteAgent: (id: string) => req<{ ok: boolean }>(`/agents/${id}`, { method: "DELETE" }),
  rules: () => req<{ rules: Rule[] }>("/assignment-rules"),
  createRule: (b: { department: string; match_field: string; match_op: string; match_value: string }) =>
    req<{ id: string }>("/assignment-rules", { method: "POST", body: JSON.stringify(b) }),
  deleteRule: (id: string) => req<{ ok: boolean }>(`/assignment-rules/${id}`, { method: "DELETE" }),
  reassign: (onlyUnassigned = true) =>
    req<{ changed: number; skipped: number; total: number }>("/sessions/reassign", {
      method: "POST",
      body: JSON.stringify({ only_unassigned: onlyUnassigned }),
    }),
  goals: () => req<{ goals: Goal[] }>("/goals"),
  createGoal: (title: string, parent_id?: string) =>
    req<{ id: string }>("/goals", { method: "POST", body: JSON.stringify({ title, parent_id }) }),
  updateGoal: (id: string, b: Record<string, unknown>) =>
    req<{ ok: boolean }>(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  tasks: () => req<{ tasks: Task[] }>("/tasks"),
  createTask: (b: { title: string; goal_id?: string; department?: string }) =>
    req<{ id: string }>("/tasks", { method: "POST", body: JSON.stringify(b) }),
  updateTask: (id: string, b: Record<string, unknown>) =>
    req<{ ok: boolean }>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  decisions: (status = "pending") => req<{ decisions: Decision[] }>(`/decisions?status=${status}`),
  answerDecision: (id: string, answer: string) =>
    req<{ ok: boolean }>(`/decisions/${id}/answer`, { method: "POST", body: JSON.stringify({ answer }) }),
  analyses: () => req<{ analyses: Analysis[] }>("/analyses?limit=100"),
  setAnalysisStatus: (id: string, status: string) =>
    req<{ ok: boolean }>(`/analyses/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  settings: () => req<{ settings: Record<string, string> }>("/settings"),
  setSetting: (key: string, value: string) =>
    req<{ ok: boolean }>(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
  frameworks: () => req<{ frameworks: Framework[] }>("/insights/frameworks"),
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
