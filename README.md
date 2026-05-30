# AgentBoard

A monitoring panel for coding agents. Any agent (Claude Code, OpenCode, Cursor, Codex,
Aider, custom) reports its **session, project, status, and live terminal output** via a
small skill/CLI over **HTTP push**; a **web dashboard** shows every session in real time
with persistent history. A **monitoring/management API** lets other agents or humans
observe, analyze, and remotely control sessions (cancel / pause / message).

- **Reporting via skills** — drop-in, no deep integration. See [`skills/`](skills/).
- **HTTP Push ingest** — agents need only outbound HTTP (firewall/sandbox friendly).
- **Realtime + persistent** — WebSocket live terminal stream + durable DB history.
- **SaaS + self-host** — multi-tenant by API key; runs locally, deploys to Cloudflare
  Workers from GitHub with zero code changes.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Layout

```
web/      TypeScript web app — Cloudflare Worker (React+Vite dashboard served as
          static assets, Worker API, Durable Object for WS, D1 for persistence)
agent/    Python (uv) agent-side client + reporter CLI + process wrapper
skills/   Agent skills: agentboard-report (publish) + agentboard-monitor (observe/manage)
docs/     Architecture & design
```

## Why this stack

Cloudflare can't host a long-running Python server with WebSockets, so the web app is
TypeScript on CF primitives: a single **Worker with static assets** that serves the SPA,
the `/api` backend, the `SessionStream` **Durable Object**, and **D1**. (Pages can't
self-host Durable Objects — it rejects `[[migrations]]` and requires an external
`script_name` — so a Worker is the right home.) The same code runs locally via
`wrangler dev` (Miniflare — no Docker) and deploys with one `wrangler deploy` (or git
auto-deploy via Workers Builds). `uv`/Python powers the agent-side skills that run next
to each coding agent and push data in.

## Quick start (local)

### 1. Web app + API

```bash
cd web
npm install
wrangler d1 create agentboard            # paste database_id into wrangler.toml
npm run db:init:local                    # create tables in local D1
npm run dev:server                       # builds dist + serves the Worker on :8788
```

Local dev API key: `dev-local-key` (seeded in `schema.sql`). Open the printed URL,
paste the key in the top-right field.

> Frontend hot-reload: run `npm run dev` (Vite on :5173, proxies `/api` to :8788)
> in a second terminal alongside `npm run dev:server`.

### 2. Agent reporter (uv)

```bash
cd agent
uv sync
export AGENTBOARD_URL=http://127.0.0.1:8788
export AGENTBOARD_KEY=dev-local-key

# Stream any command to the board:
uv run agentboard wrap --agent claude-code --project demo -- bash -c \
  'for i in $(seq 1 5); do echo "step $i"; sleep 1; done'
```

Watch it appear live on the dashboard. Then try monitoring/management:

```bash
uv run agentboard watch --follow
uv run agentboard ctl <session_id> message --text "wrap up please"
```

## Deploy to Cloudflare (Workers)

You only need **one** database: a D1 named `agentboard`. The Durable Object (`SessionStream`)
is provisioned by the `[[migrations]]` block in `web/wrangler.toml` on first deploy — nothing
to create by hand. No Redis / Postgres / R2 required.

**1. Create the D1 and wire up its id**

```bash
cd web
wrangler login                                   # or set CLOUDFLARE_API_TOKEN
wrangler d1 create agentboard                    # copy the printed database_id
# paste it into web/wrangler.toml -> database_id
npm run db:init:remote                           # create tables in the remote D1
```

**2. Deploy**

Either one-shot from your machine:

```bash
cd web && npm run deploy            # = npm run build && wrangler deploy
```

…or connect the repo for git auto-deploy: Cloudflare → **Workers & Pages → Create →
Workers → Connect to Git**, select the repo, set **Root directory = `web`** and build
command `npm install && npm run build`. Workers Builds reads `web/wrangler.toml`, so the
D1 binding, the Durable Object binding, and the migration all apply automatically.

**3. Set a real ingest key** (don't use the seeded `dev-local-key` in prod)

```bash
cd web && wrangler secret put AGENTBOARD_BOOTSTRAP_KEY    # paste `openssl rand -hex 24`
```

The Worker accepts that secret as a full-scope key. Alternatively insert a row into
`api_keys` via `wrangler d1 execute agentboard --remote --command "..."`.

**4. Point agents at the deployment**

```bash
export AGENTBOARD_URL=https://agentboard.<your-subdomain>.workers.dev
export AGENTBOARD_KEY=<the key from step 3>
```

## API summary

`/api/v1` — `POST /sessions`, `PATCH /sessions/:id`, `POST /sessions/:id/{events,logs,heartbeat}`,
`GET /sessions[/:id][/logs|/events]`, `GET /stats`,
`POST/GET /sessions/:id/commands`, `POST /sessions/:id/commands/:cid/ack`,
`GET /sessions/:id/stream` (WebSocket). Auth: `Authorization: Bearer <key>`.
Full reference in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status

First vertical slice: end-to-end ingest → persistence → realtime dashboard → monitoring
& management. Roadmap (R2 log overflow, auth UI, cost/metrics panels, MCP wrapper) in the
architecture doc.
