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
import { autoDepartment, resolveDept } from "./opc";

interface CreateSessionBody {
  agent_type?: string;
  title?: string;
  project?: string;
  cwd?: string;
  host?: string;
  pid?: number;
  status?: string;
  department?: string; // slug or id
  task_id?: string;
  tags?: string[];
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
    const department = url.searchParams.get("department_id") || url.searchParams.get("department");
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
    if (department) {
      if (department === "none") {
        where.push("department_id IS NULL");
      } else {
        where.push("department_id = ?");
        binds.push((await resolveDept(env, auth!.tenant, department)) || department);
      }
    }
    const rows = await env.DB.prepare(
      `SELECT id, project_id, agent_type, title, status, cwd, host, pid,
              started_at, updated_at, ended_at, exit_code, last_seq, meta_json,
              department_id, task_id, tags
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

    // Department: explicit > task > roster > assignment rules.
    let departmentId = await resolveDept(env, auth!.tenant, body.department);
    if (!departmentId) {
      departmentId = await autoDepartment(env, auth!.tenant, {
        agent_type: body.agent_type,
        project: body.project,
        title: body.title,
        cwd: body.cwd,
        task_id: body.task_id,
      });
    }

    await env.DB.prepare(
      `INSERT INTO sessions
        (id, tenant, project_id, agent_type, title, status, cwd, host, pid,
         started_at, updated_at, meta_json, department_id, task_id, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        departmentId,
        body.task_id || null,
        body.tags?.length ? JSON.stringify(body.tags) : null,
      )
      .run();

    // Reporting against a claimed task marks it running.
    if (body.task_id) {
      await env.DB.prepare(
        "UPDATE tasks SET status = 'running', updated_at = ? WHERE id = ? AND tenant = ? AND status IN ('todo','claimed')",
      )
        .bind(ts, body.task_id, auth!.tenant)
        .run();
    }

    await env.DB.prepare(
      "INSERT INTO events (session_id, ts, type, level, message) VALUES (?, ?, 'start', 'info', ?)",
    )
      .bind(id, ts, body.title || "session started")
      .run();

    const origin = new URL(request.url).origin.replace(/^http/, "ws");
    return json(
      { id, ws_url: `${origin}/api/v1/sessions/${id}/stream`, status: body.status || "starting", department_id: departmentId },
      201,
    );
  }

  return err("method not allowed", 405);
};
