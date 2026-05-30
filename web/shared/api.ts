import type { AuthContext, Env } from "./types";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...(extra || {}) },
  });
}

export function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function now(): number {
  return Date.now();
}

export function newId(prefix = "s"): string {
  // Short, time-sortable-ish id: prefix + base36 time + random.
  const t = Date.now().toString(36);
  const r = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${prefix}_${t}${r}`;
}

/** Resolve the bearer token to an auth context, or null if invalid. */
export async function authenticate(req: Request, env: Env): Promise<AuthContext | null> {
  const token = bearer(req);
  if (!token) return null;

  // Bootstrap key (env) always maps to the default tenant with full scopes.
  if (env.AGENTBOARD_BOOTSTRAP_KEY && token === env.AGENTBOARD_BOOTSTRAP_KEY) {
    return { tenant: "default", scopes: new Set(["ingest", "read", "manage"]), key: token };
  }

  const row = await env.DB.prepare(
    "SELECT key, tenant, scopes FROM api_keys WHERE key = ?",
  )
    .bind(token)
    .first<{ key: string; tenant: string; scopes: string }>();
  if (!row) return null;
  return {
    tenant: row.tenant,
    scopes: new Set(row.scopes.split(",").map((s) => s.trim()).filter(Boolean)),
    key: row.key,
  };
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (m) return m[1].trim();
  // Allow token via query for WebSocket upgrades (browsers can't set headers).
  const url = new URL(req.url);
  return url.searchParams.get("token");
}

export function requireScope(auth: AuthContext | null, scope: string): Response | null {
  if (!auth) return err("unauthorized", 401);
  if (!auth.scopes.has(scope)) return err(`missing scope: ${scope}`, 403);
  return null;
}

/** Fetch a session scoped to the tenant. */
export async function getSession(env: Env, tenant: string, id: string) {
  return env.DB.prepare("SELECT * FROM sessions WHERE id = ? AND tenant = ?")
    .bind(id, tenant)
    .first();
}

/** Get the Durable Object stub that fans out a session's realtime stream. */
export function streamStub(env: Env, sessionId: string): DurableObjectStub {
  const doId = env.SESSION_STREAM.idFromName(sessionId);
  return env.SESSION_STREAM.get(doId);
}

/** Forward a realtime frame to the session's DO so it can broadcast to browsers. */
export async function broadcast(env: Env, sessionId: string, frame: unknown): Promise<void> {
  try {
    await streamStub(env, sessionId).fetch("https://do/publish", {
      method: "POST",
      body: JSON.stringify(frame),
    });
  } catch {
    // Broadcast is best-effort; persistence already succeeded.
  }
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
