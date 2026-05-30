import type { Env } from "../../../shared/types";
import { authenticate, json, requireScope } from "../../../shared/api";

// GET /api/v1/stats -> aggregate counts for dashboard panels
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const auth = await authenticate(request, env);
  const denied = requireScope(auth, "read");
  if (denied) return denied;

  const byStatus = await env.DB.prepare(
    "SELECT status, COUNT(*) AS n FROM sessions WHERE tenant = ? GROUP BY status",
  )
    .bind(auth!.tenant)
    .all<{ status: string; n: number }>();

  const byAgent = await env.DB.prepare(
    "SELECT agent_type, COUNT(*) AS n FROM sessions WHERE tenant = ? GROUP BY agent_type",
  )
    .bind(auth!.tenant)
    .all<{ agent_type: string; n: number }>();

  const total = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sessions WHERE tenant = ?",
  )
    .bind(auth!.tenant)
    .first<{ n: number }>();

  const status: Record<string, number> = {};
  for (const r of byStatus.results) status[r.status] = r.n;
  const agents: Record<string, number> = {};
  for (const r of byAgent.results) agents[r.agent_type] = r.n;

  return json({ total: total?.n || 0, status, agents });
};
