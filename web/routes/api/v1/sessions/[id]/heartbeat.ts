import type { Env } from "../../../../../shared/types";
import { authenticate, err, getSession, json, now, requireScope } from "../../../../../shared/api";

// POST /api/v1/sessions/:id/heartbeat -> liveness ping (ingest)
export const onRequest: PagesFunction<Env, "id"> = async (ctx) => {
  const { request, env, params } = ctx;
  if (request.method !== "POST") return err("method not allowed", 405);
  const auth = await authenticate(request, env);
  const denied = requireScope(auth, "ingest");
  if (denied) return denied;

  const id = String(params.id);
  const session = await getSession(env, auth!.tenant, id);
  if (!session) return err("not found", 404);

  await env.DB.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").bind(now(), id).run();
  return json({ ok: true });
};
