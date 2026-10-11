import type { Env } from "../../../../../shared/types";
import {
  authenticate,
  broadcast,
  err,
  getSession,
  json,
  newId,
  now,
  readJson,
  requireScope,
} from "../../../../../shared/api";

interface CommandBody {
  kind?: string; // cancel|pause|resume|message|annotate|custom
  payload?: Record<string, unknown>;
}

// GET  /api/v1/sessions/:id/commands?wait=1 -> agent polls pending commands (ingest)
// POST /api/v1/sessions/:id/commands        -> controller enqueues a command (manage)
export const onRequest: PagesFunction<Env, "id"> = async (ctx) => {
  const { request, env, params } = ctx;
  const id = String(params.id);
  const auth = await authenticate(request, env);

  if (request.method === "GET") {
    // The reporting agent (ingest scope) drains its pending commands.
    const denied = requireScope(auth, "ingest");
    if (denied) return denied;
    const session = await getSession(env, auth!.tenant, id);
    if (!session) return err("not found", 404);

    // Expire stale commands so nothing dangles forever.
    await env.DB.prepare(
      "UPDATE commands SET status = 'expired' WHERE session_id = ? AND status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?",
    )
      .bind(id, now())
      .run();

    const rows = await env.DB.prepare(
      "SELECT id, kind, payload_json, ts FROM commands WHERE session_id = ? AND status = 'pending' ORDER BY ts ASC",
    )
      .bind(id)
      .all<{ id: string; kind: string; payload_json: string | null; ts: number }>();

    if (rows.results.length) {
      const ids = rows.results.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      await env.DB.prepare(
        `UPDATE commands SET status = 'delivered' WHERE id IN (${placeholders})`,
      )
        .bind(...ids)
        .run();
    }
    return json({
      commands: rows.results.map((r) => ({
        id: r.id,
        kind: r.kind,
        payload: r.payload_json ? JSON.parse(r.payload_json) : null,
        ts: r.ts,
      })),
    });
  }

  if (request.method === "POST") {
    // A controller (human or another agent) issues a management command.
    const denied = requireScope(auth, "manage");
    if (denied) return denied;
    const session = await getSession(env, auth!.tenant, id);
    if (!session) return err("not found", 404);

    // Commands to a finished session can never be honoured.
    if (["done", "error", "cancelled"].includes((session as any).status)) {
      return err(`session already ${(session as any).status}`, 409);
    }

    const body = (await readJson<CommandBody>(request)) || {};
    if (!body.kind) return err("kind is required");
    const cid = newId("c");
    const ts = now();
    await env.DB.prepare(
      "INSERT INTO commands (id, session_id, ts, kind, payload_json, status, expires_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
    )
      .bind(cid, id, ts, body.kind, body.payload ? JSON.stringify(body.payload) : null, ts + 10 * 60_000)
      .run();
    await env.DB.prepare(
      "INSERT INTO events (session_id, ts, type, level, message, data_json) VALUES (?, ?, 'command', 'info', ?, ?)",
    )
      .bind(id, ts, `command: ${body.kind}`, JSON.stringify(body.payload || {}))
      .run();
    await broadcast(env, id, {
      t: "event",
      event: { type: "command", level: "info", message: `command: ${body.kind}`, ts },
    });
    return json({ id: cid, status: "pending" }, 201);
  }

  return err("method not allowed", 405);
};
