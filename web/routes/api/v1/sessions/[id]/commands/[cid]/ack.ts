import type { Env } from "../../../../../../../shared/types";
import { authenticate, err, json, now, readJson, requireScope } from "../../../../../../../shared/api";

interface AckBody {
  status?: "done" | "failed";
  result?: Record<string, unknown>;
}

// POST /api/v1/sessions/:id/commands/:cid/ack -> agent reports command result (ingest)
export const onRequest: PagesFunction<Env, "id" | "cid"> = async (ctx) => {
  const { request, env, params } = ctx;
  if (request.method !== "POST") return err("method not allowed", 405);
  const auth = await authenticate(request, env);
  const denied = requireScope(auth, "ingest");
  if (denied) return denied;

  const cid = String(params.cid);
  const body = (await readJson<AckBody>(request)) || {};
  await env.DB.prepare(
    "UPDATE commands SET status = ?, result_json = ?, acked_at = ? WHERE id = ? AND session_id = ?",
  )
    .bind(
      body.status === "failed" ? "failed" : "done",
      body.result ? JSON.stringify(body.result) : null,
      now(),
      cid,
      String(params.id),
    )
    .run();
  return json({ ok: true });
};
