// OPC (one-person company) management API: departments, roster, assignment rules,
// goals, tasks (claim/lease), decisions inbox, analyses, settings, insights context.

import type { Env } from "../../../shared/types";
import { authenticate, broadcast, err, getSession, json, newId, now, readJson, requireScope } from "../../../shared/api";
import { MIGRATIONS } from "../../../shared/migrations";
import { FRAMEWORKS } from "../../../shared/frameworks";

type Ctx = { request: Request; env: Env; params: Record<string, string> };
type H = (ctx: Ctx) => Promise<Response>;

async function need(ctx: Ctx, scope: string) {
  const auth = await authenticate(ctx.request, ctx.env);
  const denied = requireScope(auth, scope);
  return denied ? { denied, auth: null } : { denied: null, auth: auth! };
}

const TERMINAL = ["done", "error", "cancelled"];

// ───────────────────────── helpers ─────────────────────────

export async function resolveDept(env: Env, tenant: string, v?: string | null): Promise<string | null> {
  if (!v) return null;
  const row = await env.DB.prepare("SELECT id FROM departments WHERE tenant = ? AND (id = ? OR slug = ?)")
    .bind(tenant, v, v)
    .first<{ id: string }>();
  return row?.id ?? null;
}

function ruleMatches(op: string, value: string, target: string | null | undefined): boolean {
  if (target == null) return false;
  const t = target.toLowerCase();
  const v = value.toLowerCase();
  switch (op) {
    case "eq": return t === v;
    case "prefix": return t.startsWith(v);
    case "contains": return t.includes(v);
    case "regex":
      try { return new RegExp(value, "i").test(target); } catch { return false; }
    default: return false;
  }
}

/** Resolve a department for a session: task → roster → rules. */
export async function autoDepartment(
  env: Env,
  tenant: string,
  s: { agent_type?: string | null; project?: string | null; title?: string | null; cwd?: string | null; task_id?: string | null },
): Promise<string | null> {
  if (s.task_id) {
    const t = await env.DB.prepare("SELECT department_id FROM tasks WHERE id = ? AND tenant = ?")
      .bind(s.task_id, tenant)
      .first<{ department_id: string | null }>();
    if (t?.department_id) return t.department_id;
  }
  if (s.agent_type) {
    const a = await env.DB.prepare(
      "SELECT department_id FROM agents WHERE tenant = ? AND agent_type = ? AND department_id IS NOT NULL LIMIT 1",
    )
      .bind(tenant, s.agent_type)
      .first<{ department_id: string }>();
    if (a) return a.department_id;
  }
  const rules = await env.DB.prepare(
    "SELECT department_id, match_field, match_op, match_value FROM assignment_rules WHERE tenant = ? ORDER BY priority ASC, created_at ASC",
  )
    .bind(tenant)
    .all<{ department_id: string; match_field: string; match_op: string; match_value: string }>();
  const fields: Record<string, string | null | undefined> = {
    agent_type: s.agent_type,
    project: s.project,
    title: s.title,
    cwd: s.cwd,
  };
  for (const r of rules.results) {
    if (ruleMatches(r.match_op, r.match_value, fields[r.match_field])) return r.department_id;
  }
  return null;
}

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

async function reclaimLeases(env: Env, tenant: string) {
  await env.DB.prepare(
    "UPDATE tasks SET status = 'todo', claimed_by = NULL, lease_until = NULL, updated_at = ? WHERE tenant = ? AND status IN ('claimed','running') AND lease_until IS NOT NULL AND lease_until < ?",
  )
    .bind(now(), tenant, now())
    .run();
}

// ───────────────────────── admin ─────────────────────────

export const adminMigrate: H = async (ctx) => {
  if (ctx.request.method !== "POST") return err("method not allowed", 405);
  const { denied } = await need(ctx, "manage");
  if (denied) return denied;
  const applied: string[] = [];
  const errors: { sql: string; error: string }[] = [];
  for (const m of MIGRATIONS) {
    for (const sql of m.sql) {
      try {
        await ctx.env.DB.prepare(sql).run();
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (/duplicate column|already exists/i.test(msg)) continue;
        errors.push({ sql: sql.slice(0, 80), error: msg });
      }
    }
    applied.push(m.id);
  }
  return json({ ok: errors.length === 0, applied, errors });
};

// ───────────────────────── departments ─────────────────────────

export const departments: H = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    const deps = await env.DB.prepare("SELECT * FROM departments WHERE tenant = ? ORDER BY sort ASC, created_at ASC")
      .bind(auth.tenant)
      .all<any>();
    const counts = await env.DB.prepare(
      "SELECT department_id, status, COUNT(*) AS n FROM sessions WHERE tenant = ? GROUP BY department_id, status",
    )
      .bind(auth.tenant)
      .all<{ department_id: string | null; status: string; n: number }>();
    const by: Record<string, Record<string, number>> = {};
    for (const c of counts.results) {
      const k = c.department_id || "_none";
      (by[k] ||= {})[c.status] = c.n;
    }
    const members = await env.DB.prepare("SELECT department_id, COUNT(*) AS n FROM agents WHERE tenant = ? GROUP BY department_id")
      .bind(auth.tenant)
      .all<{ department_id: string | null; n: number }>();
    const mem: Record<string, number> = {};
    for (const m of members.results) if (m.department_id) mem[m.department_id] = m.n;
    return json({
      departments: deps.results.map((d) => ({ ...d, status_counts: by[d.id] || {}, members: mem[d.id] || 0 })),
      unassigned: by._none || {},
    });
  }
  if (request.method === "POST") {
    const { denied, auth } = await need(ctx, "manage");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    if (!b.name) return err("name is required");
    const slug = String(b.slug || b.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || newId("d");
    const id = `d_${slug}`;
    try {
      await env.DB.prepare(
        "INSERT INTO departments (id, tenant, name, slug, description, color, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(id, auth.tenant, b.name, slug, b.description || null, b.color || null, b.sort ?? 100, now())
        .run();
    } catch {
      return err("department already exists", 409);
    }
    return json({ id, slug }, 201);
  }
  return err("method not allowed", 405);
};

export const department: H = async (ctx) => {
  const { request, env, params } = ctx;
  const { denied, auth } = await need(ctx, "manage");
  if (denied) return denied;
  const id = (await resolveDept(env, auth.tenant, params.id)) || params.id;
  if (request.method === "PATCH") {
    const b = (await readJson<any>(request)) || {};
    const sets: string[] = [];
    const binds: unknown[] = [];
    for (const k of ["name", "description", "color", "sort"]) {
      if (b[k] !== undefined) { sets.push(`${k} = ?`); binds.push(b[k]); }
    }
    if (!sets.length) return err("nothing to update");
    await env.DB.prepare(`UPDATE departments SET ${sets.join(", ")} WHERE id = ? AND tenant = ?`).bind(...binds, id, auth.tenant).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare("UPDATE sessions SET department_id = NULL WHERE department_id = ? AND tenant = ?").bind(id, auth.tenant),
      env.DB.prepare("UPDATE agents SET department_id = NULL WHERE department_id = ? AND tenant = ?").bind(id, auth.tenant),
      env.DB.prepare("UPDATE tasks SET department_id = NULL WHERE department_id = ? AND tenant = ?").bind(id, auth.tenant),
      env.DB.prepare("DELETE FROM assignment_rules WHERE department_id = ? AND tenant = ?").bind(id, auth.tenant),
      env.DB.prepare("DELETE FROM departments WHERE id = ? AND tenant = ?").bind(id, auth.tenant),
    ]);
    return json({ ok: true });
  }
  return err("method not allowed", 405);
};

// ───────────────────────── roster ─────────────────────────

export const agents: H = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    const rows = await env.DB.prepare("SELECT * FROM agents WHERE tenant = ? ORDER BY created_at ASC").bind(auth.tenant).all<any>();
    return json({ agents: rows.results.map((a) => ({ ...a, capabilities: parseJson(a.capabilities, []) })) });
  }
  if (request.method === "POST") {
    const { denied, auth } = await need(ctx, "manage");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    if (!b.name || !b.agent_type) return err("name and agent_type are required");
    const dep = await resolveDept(env, auth.tenant, b.department || b.department_id);
    const id = newId("a");
    await env.DB.prepare(
      "INSERT INTO agents (id, tenant, name, agent_type, department_id, role, capabilities, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, auth.tenant, b.name, b.agent_type, dep, b.role || null, b.capabilities ? JSON.stringify(b.capabilities) : null, now())
      .run();
    return json({ id }, 201);
  }
  return err("method not allowed", 405);
};

export const agent: H = async (ctx) => {
  const { request, env, params } = ctx;
  const { denied, auth } = await need(ctx, "manage");
  if (denied) return denied;
  if (request.method === "PATCH") {
    const b = (await readJson<any>(request)) || {};
    const sets: string[] = [];
    const binds: unknown[] = [];
    if (b.name !== undefined) { sets.push("name = ?"); binds.push(b.name); }
    if (b.agent_type !== undefined) { sets.push("agent_type = ?"); binds.push(b.agent_type); }
    if (b.role !== undefined) { sets.push("role = ?"); binds.push(b.role); }
    if (b.capabilities !== undefined) { sets.push("capabilities = ?"); binds.push(JSON.stringify(b.capabilities)); }
    if (b.department !== undefined || b.department_id !== undefined) {
      sets.push("department_id = ?");
      binds.push(await resolveDept(env, auth.tenant, b.department || b.department_id));
    }
    if (!sets.length) return err("nothing to update");
    await env.DB.prepare(`UPDATE agents SET ${sets.join(", ")} WHERE id = ? AND tenant = ?`).bind(...binds, params.id, auth.tenant).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM agents WHERE id = ? AND tenant = ?").bind(params.id, auth.tenant).run();
    return json({ ok: true });
  }
  return err("method not allowed", 405);
};

// ───────────────────────── assignment rules ─────────────────────────

export const rules: H = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    const rows = await env.DB.prepare("SELECT * FROM assignment_rules WHERE tenant = ? ORDER BY priority ASC, created_at ASC").bind(auth.tenant).all();
    return json({ rules: rows.results });
  }
  if (request.method === "POST") {
    const { denied, auth } = await need(ctx, "manage");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    const dep = await resolveDept(env, auth.tenant, b.department || b.department_id);
    if (!dep) return err("unknown department");
    if (!["agent_type", "project", "title", "cwd"].includes(b.match_field)) return err("invalid match_field");
    if (!["eq", "prefix", "contains", "regex"].includes(b.match_op || "eq")) return err("invalid match_op");
    if (!b.match_value) return err("match_value is required");
    const id = newId("r");
    await env.DB.prepare(
      "INSERT INTO assignment_rules (id, tenant, department_id, match_field, match_op, match_value, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, auth.tenant, dep, b.match_field, b.match_op || "eq", b.match_value, b.priority ?? 100, now())
      .run();
    return json({ id }, 201);
  }
  return err("method not allowed", 405);
};

export const rule: H = async (ctx) => {
  if (ctx.request.method !== "DELETE") return err("method not allowed", 405);
  const { denied, auth } = await need(ctx, "manage");
  if (denied) return denied;
  await ctx.env.DB.prepare("DELETE FROM assignment_rules WHERE id = ? AND tenant = ?").bind(ctx.params.id, auth.tenant).run();
  return json({ ok: true });
};

/** POST /sessions/reassign  {only_unassigned?: boolean=true} → apply task/roster/rules to sessions. */
export const reassign: H = async (ctx) => {
  if (ctx.request.method !== "POST") return err("method not allowed", 405);
  const { denied, auth } = await need(ctx, "manage");
  if (denied) return denied;
  const b = (await readJson<any>(ctx.request)) || {};
  const onlyUnassigned = b.only_unassigned !== false;
  const rows = await ctx.env.DB.prepare(
    `SELECT s.id, s.agent_type, s.title, s.cwd, s.task_id, s.department_id, p.name AS project
     FROM sessions s LEFT JOIN projects p ON p.id = s.project_id WHERE s.tenant = ?`,
  )
    .bind(auth.tenant)
    .all<any>();
  let changed = 0;
  let skipped = 0;
  for (const s of rows.results) {
    if (onlyUnassigned && s.department_id) { skipped++; continue; }
    const dep = await autoDepartment(ctx.env, auth.tenant, s);
    if (dep && dep !== s.department_id) {
      await ctx.env.DB.prepare("UPDATE sessions SET department_id = ? WHERE id = ? AND tenant = ?").bind(dep, s.id, auth.tenant).run();
      changed++;
    }
  }
  return json({ ok: true, changed, skipped, total: rows.results.length });
};

// ───────────────────────── goals ─────────────────────────

export const goals: H = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    const rows = await env.DB.prepare("SELECT * FROM goals WHERE tenant = ? ORDER BY created_at ASC").bind(auth.tenant).all<any>();
    const tc = await env.DB.prepare("SELECT goal_id, status, COUNT(*) AS n FROM tasks WHERE tenant = ? AND goal_id IS NOT NULL GROUP BY goal_id, status")
      .bind(auth.tenant)
      .all<{ goal_id: string; status: string; n: number }>();
    const by: Record<string, Record<string, number>> = {};
    for (const r of tc.results) (by[r.goal_id] ||= {})[r.status] = r.n;
    return json({
      goals: rows.results.map((g) => ({ ...g, outcome: parseJson(g.outcome_json, null), task_counts: by[g.id] || {} })),
    });
  }
  if (request.method === "POST") {
    const { denied, auth } = await need(ctx, "manage");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    if (!b.title) return err("title is required");
    const id = newId("g");
    await env.DB.prepare(
      "INSERT INTO goals (id, tenant, parent_id, title, outcome_json, level, status, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, auth.tenant, b.parent_id || null, b.title, b.outcome ? JSON.stringify(b.outcome) : null, b.level || null, b.status || "active", b.due_at ?? null, now())
      .run();
    return json({ id }, 201);
  }
  return err("method not allowed", 405);
};

export const goal: H = async (ctx) => {
  const { request, env, params } = ctx;
  const { denied, auth } = await need(ctx, "manage");
  if (denied) return denied;
  if (request.method === "PATCH") {
    const b = (await readJson<any>(request)) || {};
    const sets: string[] = [];
    const binds: unknown[] = [];
    for (const k of ["title", "parent_id", "level", "status", "due_at"]) {
      if (b[k] !== undefined) { sets.push(`${k} = ?`); binds.push(b[k]); }
    }
    if (b.outcome !== undefined) { sets.push("outcome_json = ?"); binds.push(JSON.stringify(b.outcome)); }
    if (!sets.length) return err("nothing to update");
    await env.DB.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ? AND tenant = ?`).bind(...binds, params.id, auth.tenant).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare("UPDATE tasks SET goal_id = NULL WHERE goal_id = ? AND tenant = ?").bind(params.id, auth.tenant),
      env.DB.prepare("UPDATE goals SET parent_id = NULL WHERE parent_id = ? AND tenant = ?").bind(params.id, auth.tenant),
      env.DB.prepare("DELETE FROM goals WHERE id = ? AND tenant = ?").bind(params.id, auth.tenant),
    ]);
    return json({ ok: true });
  }
  return err("method not allowed", 405);
};

// ───────────────────────── tasks ─────────────────────────

const TASK_STATUSES = ["todo", "claimed", "running", "blocked", "review", "done", "cancelled"];

function shapeTask(t: any, doneIds: Set<string>) {
  const deps = parseJson<string[]>(t.depends_on, []);
  return {
    ...t,
    depends_on: deps,
    result: parseJson(t.result_json, null),
    ready: t.status === "todo" && deps.every((d) => doneIds.has(d)),
  };
}

export const tasks: H = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    await reclaimLeases(env, auth.tenant);
    const url = new URL(request.url);
    const where = ["tenant = ?"];
    const binds: unknown[] = [auth.tenant];
    for (const k of ["status", "goal_id", "department_id"]) {
      const v = url.searchParams.get(k);
      if (v) { where.push(`${k} = ?`); binds.push(v); }
    }
    const rows = await env.DB.prepare(`SELECT * FROM tasks WHERE ${where.join(" AND ")} ORDER BY created_at ASC LIMIT 500`).bind(...binds).all<any>();
    const done = await env.DB.prepare("SELECT id FROM tasks WHERE tenant = ? AND status = 'done'").bind(auth.tenant).all<{ id: string }>();
    const doneIds = new Set(done.results.map((d) => d.id));
    return json({ tasks: rows.results.map((t) => shapeTask(t, doneIds)) });
  }
  if (request.method === "POST") {
    const { denied, auth } = await need(ctx, "manage");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    if (!b.title) return err("title is required");
    const dep = await resolveDept(env, auth.tenant, b.department || b.department_id);
    const id = newId("t");
    const ts = now();
    await env.DB.prepare(
      "INSERT INTO tasks (id, tenant, goal_id, department_id, assignee_agent_id, title, description, status, depends_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?)",
    )
      .bind(id, auth.tenant, b.goal_id || null, dep, b.assignee_agent_id || null, b.title, b.description || null, b.depends_on ? JSON.stringify(b.depends_on) : null, ts, ts)
      .run();
    return json({ id }, 201);
  }
  return err("method not allowed", 405);
};

export const task: H = async (ctx) => {
  const { request, env, params } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    const t = await env.DB.prepare("SELECT * FROM tasks WHERE id = ? AND tenant = ?").bind(params.id, auth.tenant).first<any>();
    if (!t) return err("not found", 404);
    const sessions = await env.DB.prepare("SELECT id, title, status, agent_type, updated_at FROM sessions WHERE task_id = ? AND tenant = ? ORDER BY started_at DESC")
      .bind(params.id, auth.tenant)
      .all();
    return json({ task: shapeTask(t, new Set()), sessions: sessions.results });
  }
  if (request.method === "PATCH") {
    // Agents (ingest) report progress/hand-off; humans (manage) edit everything.
    const { denied, auth } = await need(ctx, "ingest");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    const sets: string[] = ["updated_at = ?"];
    const binds: unknown[] = [now()];
    if (b.status !== undefined) {
      if (!TASK_STATUSES.includes(b.status)) return err("invalid status");
      sets.push("status = ?");
      binds.push(b.status);
      if (["done", "cancelled", "review", "blocked", "todo"].includes(b.status)) {
        sets.push("lease_until = NULL");
        if (b.status === "todo") sets.push("claimed_by = NULL");
      }
    }
    for (const k of ["title", "description", "goal_id", "assignee_agent_id"]) {
      if (b[k] !== undefined) { sets.push(`${k} = ?`); binds.push(b[k]); }
    }
    if (b.department !== undefined || b.department_id !== undefined) {
      sets.push("department_id = ?");
      binds.push(await resolveDept(env, auth.tenant, b.department || b.department_id));
    }
    if (b.depends_on !== undefined) { sets.push("depends_on = ?"); binds.push(JSON.stringify(b.depends_on)); }
    if (b.result !== undefined) { sets.push("result_json = ?"); binds.push(JSON.stringify(b.result)); }
    await env.DB.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND tenant = ?`).bind(...binds, params.id, auth.tenant).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    const { denied, auth } = await need(ctx, "manage");
    if (denied) return denied;
    await env.DB.prepare("DELETE FROM tasks WHERE id = ? AND tenant = ?").bind(params.id, auth.tenant).run();
    return json({ ok: true });
  }
  return err("method not allowed", 405);
};

/** POST /tasks/claim {agent?, department?, lease_seconds?} → atomically claim next ready task. */
export const claimTask: H = async (ctx) => {
  if (ctx.request.method !== "POST") return err("method not allowed", 405);
  const { denied, auth } = await need(ctx, "ingest");
  if (denied) return denied;
  const { env } = ctx;
  const b = (await readJson<any>(ctx.request)) || {};
  await reclaimLeases(env, auth.tenant);
  const dep = await resolveDept(env, auth.tenant, b.department || b.department_id);
  const where = ["tenant = ?", "status = 'todo'"];
  const binds: unknown[] = [auth.tenant];
  if (dep) { where.push("department_id = ?"); binds.push(dep); }
  const cand = await env.DB.prepare(`SELECT * FROM tasks WHERE ${where.join(" AND ")} ORDER BY created_at ASC LIMIT 50`).bind(...binds).all<any>();
  const done = await env.DB.prepare("SELECT id FROM tasks WHERE tenant = ? AND status = 'done'").bind(auth.tenant).all<{ id: string }>();
  const doneIds = new Set(done.results.map((d) => d.id));
  const lease = Math.min(Math.max(Number(b.lease_seconds) || 900, 30), 86400);
  for (const t of cand.results) {
    if (!parseJson<string[]>(t.depends_on, []).every((d) => doneIds.has(d))) continue;
    const until = now() + lease * 1000;
    const res = await env.DB.prepare(
      "UPDATE tasks SET status = 'claimed', claimed_by = ?, lease_until = ?, updated_at = ? WHERE id = ? AND status = 'todo'",
    )
      .bind(b.agent || "unknown", until, now(), t.id)
      .run();
    if ((res.meta as any)?.changes === 1) {
      return json({ task: shapeTask({ ...t, status: "claimed", claimed_by: b.agent || "unknown", lease_until: until }, doneIds) });
    }
  }
  return json({ task: null });
};

export const taskHeartbeat: H = async (ctx) => {
  if (ctx.request.method !== "POST") return err("method not allowed", 405);
  const { denied, auth } = await need(ctx, "ingest");
  if (denied) return denied;
  const b = (await readJson<any>(ctx.request)) || {};
  const lease = Math.min(Math.max(Number(b.lease_seconds) || 900, 30), 86400);
  const res = await ctx.env.DB.prepare(
    "UPDATE tasks SET lease_until = ?, status = 'running', updated_at = ? WHERE id = ? AND tenant = ? AND status IN ('claimed','running')",
  )
    .bind(now() + lease * 1000, now(), ctx.params.id, auth.tenant)
    .run();
  if ((res.meta as any)?.changes !== 1) return err("task is not claimed", 409);
  return json({ ok: true, lease_until: now() + lease * 1000 });
};

// ───────────────────────── decisions inbox ─────────────────────────

export const decisions: H = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    const status = new URL(request.url).searchParams.get("status");
    const rows = await env.DB.prepare(
      `SELECT * FROM decisions WHERE tenant = ? ${status ? "AND status = ?" : ""} ORDER BY created_at DESC LIMIT 200`,
    )
      .bind(...(status ? [auth.tenant, status] : [auth.tenant]))
      .all<any>();
    return json({ decisions: rows.results.map((d) => ({ ...d, options: parseJson(d.options_json, []) })) });
  }
  if (request.method === "POST") {
    const { denied, auth } = await need(ctx, "ingest");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    if (!b.question) return err("question is required");
    const id = newId("q");
    await env.DB.prepare(
      "INSERT INTO decisions (id, tenant, session_id, task_id, question, options_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
    )
      .bind(id, auth.tenant, b.session_id || null, b.task_id || null, b.question, b.options ? JSON.stringify(b.options) : null, now())
      .run();
    if (b.session_id) {
      await env.DB.prepare("INSERT INTO events (session_id, ts, type, level, message) VALUES (?, ?, 'decision', 'warn', ?)")
        .bind(b.session_id, now(), `decision requested: ${b.question}`)
        .run();
    }
    return json({ id }, 201);
  }
  return err("method not allowed", 405);
};

export const decisionAnswer: H = async (ctx) => {
  if (ctx.request.method !== "POST") return err("method not allowed", 405);
  const { denied, auth } = await need(ctx, "manage");
  if (denied) return denied;
  const { env } = ctx;
  const b = (await readJson<any>(ctx.request)) || {};
  if (!b.answer) return err("answer is required");
  const d = await env.DB.prepare("SELECT * FROM decisions WHERE id = ? AND tenant = ?").bind(ctx.params.id, auth.tenant).first<any>();
  if (!d) return err("not found", 404);
  if (d.status !== "pending") return err("already answered", 409);
  await env.DB.prepare("UPDATE decisions SET status = 'answered', answer = ?, answered_at = ? WHERE id = ?").bind(b.answer, now(), d.id).run();
  // Deliver the answer to the waiting agent as a management message (with TTL).
  if (d.session_id) {
    const session = (await getSession(env, auth.tenant, d.session_id)) as any;
    if (session && !TERMINAL.includes(session.status)) {
      const ts = now();
      await env.DB.prepare(
        "INSERT INTO commands (id, session_id, ts, kind, payload_json, status, expires_at) VALUES (?, ?, ?, 'message', ?, 'pending', ?)",
      )
        .bind(newId("c"), d.session_id, ts, JSON.stringify({ text: `Decision on "${d.question}": ${b.answer}`, decision_id: d.id }), ts + 3600_000)
        .run();
      await broadcast(env, d.session_id, { t: "event", event: { type: "decision", level: "info", message: `decision answered: ${b.answer}`, ts } });
    }
  }
  return json({ ok: true });
};

// ───────────────────────── analyses / settings / insights ─────────────────────────

export const analyses: H = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    const url = new URL(request.url);
    const where = ["tenant = ?"];
    const binds: unknown[] = [auth.tenant];
    for (const k of ["framework", "target_type", "target_id", "status"]) {
      const v = url.searchParams.get(k);
      if (v) { where.push(`${k} = ?`); binds.push(v); }
    }
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
    const rows = await env.DB.prepare(`SELECT * FROM analyses WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).bind(...binds, limit).all<any>();
    return json({ analyses: rows.results.map((a) => ({ ...a, result: parseJson(a.result_json, {}) })) });
  }
  if (request.method === "POST") {
    const { denied, auth } = await need(ctx, "ingest");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    if (!b.framework || !b.target_type || !b.result) return err("framework, target_type and result are required");
    if (!FRAMEWORKS.some((f) => f.id === b.framework)) return err("unknown framework");
    const id = newId("an");
    await env.DB.prepare(
      "INSERT INTO analyses (id, tenant, framework, target_type, target_id, result_json, analyzer, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)",
    )
      .bind(id, auth.tenant, b.framework, b.target_type, b.target_id || null, JSON.stringify(b.result), b.analyzer || "external:unknown", now())
      .run();
    return json({ id }, 201);
  }
  return err("method not allowed", 405);
};

export const analysis: H = async (ctx) => {
  if (ctx.request.method !== "PATCH") return err("method not allowed", 405);
  const { denied, auth } = await need(ctx, "manage");
  if (denied) return denied;
  const b = (await readJson<any>(ctx.request)) || {};
  if (!["new", "accepted", "dismissed"].includes(b.status)) return err("invalid status");
  await ctx.env.DB.prepare("UPDATE analyses SET status = ? WHERE id = ? AND tenant = ?").bind(b.status, ctx.params.id, auth.tenant).run();
  return json({ ok: true });
};

export const settings: H = async (ctx) => {
  const { request, env, params } = ctx;
  if (request.method === "GET") {
    const { denied, auth } = await need(ctx, "read");
    if (denied) return denied;
    const rows = await env.DB.prepare("SELECT key, value FROM settings WHERE tenant = ?").bind(auth.tenant).all<{ key: string; value: string }>();
    const out: Record<string, string> = {};
    for (const r of rows.results) out[r.key] = r.value;
    return json({ settings: out });
  }
  if (request.method === "PUT") {
    const { denied, auth } = await need(ctx, "manage");
    if (denied) return denied;
    const b = (await readJson<any>(request)) || {};
    if (params.key === "analyzer.mode" && !["external", "builtin", "manual"].includes(b.value)) return err("invalid analyzer mode");
    await env.DB.prepare("INSERT INTO settings (tenant, key, value) VALUES (?, ?, ?) ON CONFLICT(tenant, key) DO UPDATE SET value = excluded.value")
      .bind(auth.tenant, params.key, String(b.value ?? ""))
      .run();
    return json({ ok: true });
  }
  return err("method not allowed", 405);
};

/** GET /insights/context?scope=company|department|goal&id=  → everything an external analyst needs. */
export const insightsContext: H = async (ctx) => {
  if (ctx.request.method !== "GET") return err("method not allowed", 405);
  const { denied, auth } = await need(ctx, "read");
  if (denied) return denied;
  const { env } = ctx;
  const url = new URL(ctx.request.url);
  const scope = url.searchParams.get("scope") || "company";
  const scopeId = url.searchParams.get("id");
  const t = auth.tenant;
  await reclaimLeases(env, t);

  const depId = scope === "department" ? await resolveDept(env, t, scopeId) : null;
  const sessWhere = ["s.tenant = ?"];
  const sessBinds: unknown[] = [t];
  if (depId) { sessWhere.push("s.department_id = ?"); sessBinds.push(depId); }

  const [deps, goalRows, taskRows, sessRows, decRows, anaRows, modeRow, agentRows] = await Promise.all([
    env.DB.prepare("SELECT id, name, slug, description FROM departments WHERE tenant = ? ORDER BY sort").bind(t).all<any>(),
    env.DB.prepare("SELECT * FROM goals WHERE tenant = ? AND status IN ('draft','active') ORDER BY created_at").bind(t).all<any>(),
    env.DB.prepare("SELECT * FROM tasks WHERE tenant = ? AND status NOT IN ('cancelled') ORDER BY created_at").bind(t).all<any>(),
    env.DB.prepare(
      `SELECT s.id, s.title, s.status, s.agent_type, s.department_id, s.task_id, s.started_at, s.updated_at, s.ended_at, s.exit_code, p.name AS project
       FROM sessions s LEFT JOIN projects p ON p.id = s.project_id WHERE ${sessWhere.join(" AND ")} ORDER BY s.updated_at DESC LIMIT 60`,
    ).bind(...sessBinds).all<any>(),
    env.DB.prepare("SELECT id, session_id, task_id, question, options_json, created_at FROM decisions WHERE tenant = ? AND status = 'pending'").bind(t).all<any>(),
    env.DB.prepare("SELECT id, framework, target_type, target_id, analyzer, status, created_at FROM analyses WHERE tenant = ? ORDER BY created_at DESC LIMIT 20").bind(t).all<any>(),
    env.DB.prepare("SELECT value FROM settings WHERE tenant = ? AND key = 'analyzer.mode'").bind(t).first<{ value: string }>(),
    env.DB.prepare("SELECT id, name, agent_type, department_id, role FROM agents WHERE tenant = ?").bind(t).all<any>(),
  ]);

  let goals = goalRows.results;
  let tasks = taskRows.results;
  if (scope === "goal" && scopeId) {
    const ids = new Set<string>([scopeId]);
    for (let i = 0; i < 5; i++) for (const g of goals) if (g.parent_id && ids.has(g.parent_id)) ids.add(g.id);
    goals = goals.filter((g: any) => ids.has(g.id));
    tasks = tasks.filter((x: any) => x.goal_id && ids.has(x.goal_id));
  }
  if (depId) tasks = tasks.filter((x: any) => x.department_id === depId);

  const nowTs = now();
  const sessions = sessRows.results;
  return json({
    generated_at: nowTs,
    scope: { type: scope, id: scopeId },
    analyzer_mode: modeRow?.value || "external",
    departments: deps.results,
    agents: agentRows.results,
    goals: goals.map((g: any) => ({ ...g, outcome: parseJson(g.outcome_json, null) })),
    tasks: tasks.map((x: any) => ({ ...x, depends_on: parseJson(x.depends_on, []) })),
    sessions,
    pending_decisions: decRows.results.map((d: any) => ({ ...d, options: parseJson(d.options_json, []) })),
    signals: {
      orphan_tasks: tasks.filter((x: any) => !x.goal_id).map((x: any) => x.id),
      goals_without_tasks: goals.filter((g: any) => !tasks.some((x: any) => x.goal_id === g.id)).map((g: any) => g.id),
      sessions_without_task: sessions.filter((s: any) => !s.task_id).map((s: any) => s.id),
      unassigned_sessions: sessions.filter((s: any) => !s.department_id).map((s: any) => s.id),
      stale_sessions: sessions
        .filter((s: any) => ["running", "waiting"].includes(s.status) && nowTs - s.updated_at > 10 * 60_000)
        .map((s: any) => s.id),
      failed_sessions: sessions.filter((s: any) => s.status === "error").map((s: any) => s.id),
    },
    recent_analyses: anaRows.results,
    frameworks: FRAMEWORKS,
    submit: { method: "POST", path: "/api/v1/analyses", body: "{framework,target_type,target_id,result,analyzer}" },
  });
};

export const frameworks: H = async (ctx) => {
  const { denied } = await need(ctx, "read");
  if (denied) return denied;
  return json({ frameworks: FRAMEWORKS });
};
