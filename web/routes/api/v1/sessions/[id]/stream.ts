import type { Env } from "../../../../../shared/types";
import { authenticate, err, requireScope, streamStub } from "../../../../../shared/api";

// GET /api/v1/sessions/:id/stream (WebSocket upgrade)
// Browser dashboards connect here to receive live status/log/event frames.
// Auth is via ?token=<api_key> (browsers cannot set headers on WebSocket).
export const onRequest: PagesFunction<Env, "id"> = async (ctx) => {
  const { request, env, params } = ctx;
  if (request.headers.get("Upgrade") !== "websocket") {
    return err("expected websocket upgrade", 426);
  }
  const auth = await authenticate(request, env);
  const denied = requireScope(auth, "read");
  if (denied) return denied;

  const id = String(params.id);
  // Hand the upgrade to the session's Durable Object.
  return streamStub(env, id).fetch("https://do/subscribe", request);
};
