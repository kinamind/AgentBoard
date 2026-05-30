// AgentBoard Worker — single-Worker entrypoint (Cloudflare Workers + static assets).
//
// One Worker serves the SPA dashboard (via the ASSETS binding), routes /api/v1/* to the
// handlers below, and hosts the SessionStream Durable Object. Workers (unlike Pages)
// fully support self-hosted Durable Objects + migrations, so this deploys with one
// `wrangler deploy`.

import { CORS_HEADERS } from "../shared/api";
import type { Env } from "../shared/types";

// Re-export the Durable Object so wrangler can bind SESSION_STREAM -> SessionStream.
export { SessionStream } from "../do/SessionStream";

// Existing handlers (authored as PagesFunction onRequest). They only use
// { request, env, params }, so we invoke them with a minimal context.
import { onRequest as sessions } from "../routes/api/v1/sessions";
import { onRequest as sessionDetail } from "../routes/api/v1/sessions/[id]";
import { onRequest as logs } from "../routes/api/v1/sessions/[id]/logs";
import { onRequest as events } from "../routes/api/v1/sessions/[id]/events";
import { onRequest as heartbeat } from "../routes/api/v1/sessions/[id]/heartbeat";
import { onRequest as commands } from "../routes/api/v1/sessions/[id]/commands";
import { onRequest as commandAck } from "../routes/api/v1/sessions/[id]/commands/[cid]/ack";
import { onRequest as stream } from "../routes/api/v1/sessions/[id]/stream";
import { onRequest as stats } from "../routes/api/v1/stats";

type Handler = (ctx: { request: Request; env: Env; params: Record<string, string> }) => Promise<Response> | Response;

interface Route {
  pattern: RegExp;
  handler: Handler;
  keys: string[];
}

function route(path: string, handler: unknown): Route {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" +
      path.replace(/:[a-zA-Z]+/g, (m) => {
        keys.push(m.slice(1));
        return "([^/]+)";
      }) +
      "/?$",
  );
  return { pattern, handler: handler as Handler, keys };
}

const routes: Route[] = [
  route("/api/v1/sessions", sessions),
  route("/api/v1/sessions/:id", sessionDetail),
  route("/api/v1/sessions/:id/logs", logs),
  route("/api/v1/sessions/:id/events", events),
  route("/api/v1/sessions/:id/heartbeat", heartbeat),
  route("/api/v1/sessions/:id/commands", commands),
  route("/api/v1/sessions/:id/commands/:cid/ack", commandAck),
  route("/api/v1/sessions/:id/stream", stream),
  route("/api/v1/stats", stats),
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      for (const r of routes) {
        const m = r.pattern.exec(url.pathname);
        if (!m) continue;
        const params: Record<string, string> = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return r.handler({ request, env, params });
      }
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Everything else: serve the static dashboard (SPA).
    return env.ASSETS.fetch(request);
  },
};
