import type { Env } from "../../../../shared/types";
import {
  authenticate,
  broadcast,
  err,
  getSession,
  json,
  now,
  readJson,
  requireScope,
} from "../../../../shared/api";

interface PatchBody {
  status?: string;
  title?: string;
  exit_code?: number;
  meta?: Record<string, unknown>;
}

// GET   /api/v1/sessions/:id  -> session detail
// PATCH /api/v1/sessions/:id  -> update status / metadata (ingest)
export const onRequest: PagesFunction<Env, "id"> = async (ctx) => {
  const { request, env, params } = ctx;
  const id = String(params.id);
  const auth = await authenticate(request, env);

  if (request.method === "GET") {
    const denied = requireScope(auth, "read");
    if (denied) return denied;
    const row = await getSession(env, auth!.tenant, id);
    if (!row) return err("not found", 404);
    return json({ session: row });
  }

  if (request.method === "PATCH") {
    const denied = requireScope(auth, "ingest");
    if (denied) return denied;
    const existing = await getSession(env, auth!.tenant, id);
    if (!existing) return err("not found", 404);

    const body = (await readJson<PatchBody>(request)) || {};
    const ts = now();
    const sets: string[] = ["updated_at = ?"];
    const binds: unknown[] = [ts];

    const terminal = ["done", "error", "cancelled"];
    if (body.status) {
      sets.push("status = ?");
      binds.push(body.status);
      if (terminal.includes(body.status)) {
        sets.push("ended_at = ?");
        binds.push(ts);
      }
    }
    if (body.title !== undefined) {
      sets.push("title = ?");
      binds.push(body.title);
    }
    if (body.exit_code !== undefined) {
      sets.push("exit_code = ?");
      binds.push(body.exit_code);
    }
    if (body.meta !== undefined) {
      sets.push("meta_json = ?");
      binds.push(JSON.stringify(body.meta));
    }

    await env.DB.prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ? AND tenant = ?`)
      .bind(...binds, id, auth!.tenant)
      .run();

    if (body.status) {
      await env.DB.prepare(
        "INSERT INTO events (session_id, ts, type, level, message) VALUES (?, ?, 'status', 'info', ?)",
      )
        .bind(id, ts, body.status)
        .run();
      await broadcast(env, id, { t: "status", status: body.status, ts });
    }
    return json({ ok: true });
  }

  return err("method not allowed", 405);
};
