import type { Env } from "../../../../../shared/types";
import {
  authenticate,
  broadcast,
  err,
  getSession,
  json,
  now,
  readJson,
  requireScope,
} from "../../../../../shared/api";

interface EventBody {
  type?: string;
  level?: "debug" | "info" | "warn" | "error";
  message?: string;
  data?: Record<string, unknown>;
}

// GET  /api/v1/sessions/:id/events  -> event history
// POST /api/v1/sessions/:id/events  -> append a lifecycle event (ingest)
export const onRequest: PagesFunction<Env, "id"> = async (ctx) => {
  const { request, env, params } = ctx;
  const id = String(params.id);
  const auth = await authenticate(request, env);

  if (request.method === "GET") {
    const denied = requireScope(auth, "read");
    if (denied) return denied;
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 200), 1000);
    const rows = await env.DB.prepare(
      `SELECT id, ts, type, level, message, data_json FROM events
       WHERE session_id = ? ORDER BY ts DESC LIMIT ?`,
    )
      .bind(id, limit)
      .all();
    return json({ events: rows.results });
  }

  if (request.method === "POST") {
    const denied = requireScope(auth, "ingest");
    if (denied) return denied;
    const session = await getSession(env, auth!.tenant, id);
    if (!session) return err("not found", 404);
    const body = (await readJson<EventBody>(request)) || {};
    const ts = now();
    await env.DB.prepare(
      "INSERT INTO events (session_id, ts, type, level, message, data_json) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        ts,
        body.type || "note",
        body.level || "info",
        body.message || null,
        body.data ? JSON.stringify(body.data) : null,
      )
      .run();
    await env.DB.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").bind(ts, id).run();
    await broadcast(env, id, {
      t: "event",
      event: { type: body.type || "note", level: body.level || "info", message: body.message, ts },
    });
    return json({ ok: true });
  }

  return err("method not allowed", 405);
};
