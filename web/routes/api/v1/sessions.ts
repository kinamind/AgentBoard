import type { Env } from "../../../shared/types";
import {
  authenticate,
  err,
  json,
  newId,
  now,
  readJson,
  requireScope,
} from "../../../shared/api";

interface CreateSessionBody {
  agent_type?: string;
  title?: string;
  project?: string;
  cwd?: string;
  host?: string;
  pid?: number;
  status?: string;
  meta?: Record<string, unknown>;
}

// GET /api/v1/sessions  -> list sessions for the tenant (dashboard + monitoring)
// POST /api/v1/sessions -> register a new session (ingest)
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const auth = await authenticate(request, env);

  if (request.method === "GET") {
    const denied = requireScope(auth, "read");
    if (denied) return denied;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const project = url.searchParams.get("project");
    const agentType = url.searchParams.get("agent_type");
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);

    const where = ["tenant = ?"];
    const binds: unknown[] = [auth!.tenant];
    if (status) {
      where.push("status = ?");
      binds.push(status);
    }
    if (project) {
      where.push("project_id = ?");
      binds.push(project);
    }
    if (agentType) {
      where.push("agent_type = ?");
      binds.push(agentType);
    }
    const rows = await env.DB.prepare(
      `SELECT id, project_id, agent_type, title, status, cwd, host, pid,
              started_at, updated_at, ended_at, exit_code, last_seq, meta_json
       FROM sessions WHERE ${where.join(" AND ")}
       ORDER BY updated_at DESC LIMIT ?`,
    )
      .bind(...binds, limit)
      .all();
    return json({ sessions: rows.results });
  }

  if (request.method === "POST") {
    const denied = requireScope(auth, "ingest");
    if (denied) return denied;
    const body = (await readJson<CreateSessionBody>(request)) || {};
    const ts = now();
    const id = newId("s");

    let projectId: string | null = null;
    if (body.project) {
      projectId = `p_${body.project}`;
      await env.DB.prepare(
        "INSERT OR IGNORE INTO projects (id, tenant, name, created_at) VALUES (?, ?, ?, ?)",
      )
        .bind(projectId, auth!.tenant, body.project, ts)
        .run();
    }

    await env.DB.prepare(
      `INSERT INTO sessions
        (id, tenant, project_id, agent_type, title, status, cwd, host, pid,
         started_at, updated_at, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        auth!.tenant,
        projectId,
        body.agent_type || "unknown",
        body.title || null,
        body.status || "starting",
        body.cwd || null,
        body.host || null,
        body.pid ?? null,
        ts,
        ts,
        body.meta ? JSON.stringify(body.meta) : null,
      )
      .run();

    await env.DB.prepare(
      "INSERT INTO events (session_id, ts, type, level, message) VALUES (?, ?, 'start', 'info', ?)",
    )
      .bind(id, ts, body.title || "session started")
      .run();

    const origin = new URL(request.url).origin.replace(/^http/, "ws");
    return json(
      { id, ws_url: `${origin}/api/v1/sessions/${id}/stream`, status: body.status || "starting" },
      201,
    );
  }

  return err("method not allowed", 405);
};
