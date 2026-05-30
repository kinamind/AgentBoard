// Shared types for AgentBoard server + (mirrored on the Python client).

export interface Env {
  DB: D1Database;
  SESSION_STREAM: DurableObjectNamespace;
  // Static asset server (provided automatically in Pages advanced mode).
  ASSETS: Fetcher;
  // Optional bootstrap key for local dev / first-run, set via .dev.vars or CF secret.
  AGENTBOARD_BOOTSTRAP_KEY?: string;
}

export type SessionStatus =
  | "starting"
  | "running"
  | "waiting"
  | "done"
  | "error"
  | "cancelled";

export interface SessionRow {
  id: string;
  tenant: string;
  project_id: string | null;
  agent_type: string;
  title: string | null;
  status: SessionStatus;
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

export interface LogLine {
  seq: number;
  ts: number;
  stream: "stdout" | "stderr";
  content: string;
}

export interface CommandRow {
  id: string;
  session_id: string;
  ts: number;
  kind: string;
  payload_json: string | null;
  status: "pending" | "delivered" | "done" | "failed";
  result_json: string | null;
  acked_at: number | null;
}

export interface AuthContext {
  tenant: string;
  scopes: Set<string>;
  key: string;
}

// WebSocket frames (server -> browser).
export type StreamFrame =
  | { t: "snapshot"; session: Record<string, unknown>; lines: LogLine[] }
  | { t: "log"; seq: number; ts: number; stream: "stdout" | "stderr"; content: string }
  | { t: "status"; status: SessionStatus; ts: number }
  | { t: "event"; event: Record<string, unknown> };
