import type { Env, LogLine } from "../../../../../shared/types";
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

interface LogBody {
  lines?: Array<{ content: string; stream?: "stdout" | "stderr"; ts?: number }>;
  // Convenience single-line form.
  content?: string;
  stream?: "stdout" | "stderr";
}

// GET  /api/v1/sessions/:id/logs?after=<seq>&limit=<n>  -> historical log paging
// POST /api/v1/sessions/:id/logs                        -> append a batch (ingest)
export const onRequest: PagesFunction<Env, "id"> = async (ctx) => {
  const { request, env, params } = ctx;
  const id = String(params.id);
  const auth = await authenticate(request, env);

  if (request.method === "GET") {
    const denied = requireScope(auth, "read");
    if (denied) return denied;
    const url = new URL(request.url);
    const after = Number(url.searchParams.get("after") || 0);
    const limit = Math.min(Number(url.searchParams.get("limit") || 1000), 5000);
    const rows = await env.DB.prepare(
      `SELECT seq, ts, stream, content FROM logs
       WHERE session_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?`,
    )
      .bind(id, after, limit)
      .all<LogLine>();
    return json({ lines: rows.results });
  }

  if (request.method === "POST") {
    const denied = requireScope(auth, "ingest");
    if (denied) return denied;
    const session = await getSession(env, auth!.tenant, id);
    if (!session) return err("not found", 404);

    const body = (await readJson<LogBody>(request)) || {};
    const incoming = body.lines
      ? body.lines
      : body.content !== undefined
        ? [{ content: body.content, stream: body.stream }]
        : [];
    if (incoming.length === 0) return json({ ok: true, written: 0, last_seq: session.last_seq });

    let seq = Number(session.last_seq) || 0;
    const ts = now();
    const stmt = env.DB.prepare(
      "INSERT INTO logs (session_id, seq, ts, stream, content) VALUES (?, ?, ?, ?, ?)",
    );
    const batch = [];
    const broadcasts: unknown[] = [];
    for (const line of incoming) {
      seq += 1;
      const lts = line.ts || ts;
      const stream = line.stream === "stderr" ? "stderr" : "stdout";
      batch.push(stmt.bind(id, seq, lts, stream, line.content));
      broadcasts.push({ t: "log", seq, ts: lts, stream, content: line.content });
    }
    batch.push(
      env.DB.prepare("UPDATE sessions SET last_seq = ?, updated_at = ? WHERE id = ?").bind(
        seq,
        ts,
        id,
      ),
    );
    await env.DB.batch(batch);

    // Fan out to subscribed browsers (best-effort).
    await broadcast(env, id, { t: "logs", frames: broadcasts });
    return json({ ok: true, written: incoming.length, last_seq: seq });
  }

  return err("method not allowed", 405);
};
