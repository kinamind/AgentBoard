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
  Pages from GitHub with zero code changes.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Layout

```
web/      TypeScript web app — Cloudflare Pages (React+Vite dashboard,
          Advanced-Mode Worker API, Durable Object for WS, D1 for persistence)
agent/    Python (uv) agent-side client + reporter CLI + process wrapper
skills/   Agent skills: agentboard-report (publish) + agentboard-monitor (observe/manage)
docs/     Architecture & design
```

## Why this stack

Cloudflare Pages can't host a long-running Python server with WebSockets, so the web app
is TypeScript on CF primitives (Advanced-Mode Worker + Durable Objects + D1). The same
code runs locally via `wrangler pages dev` (Miniflare — no Docker) and deploys to CF Pages
on `git push`. `uv`/Python powers the agent-side skills that actually run next to each
coding agent and push data in.

## Quick start (local)

### 1. Web app + API

```bash
cd web
npm install
wrangler d1 create agentboard            # paste database_id into wrangler.toml
npm run db:init:local                    # create tables in local D1
npm run pages:dev                        # builds dist + serves Functions on :8788
```

Local dev API key: `dev-local-key` (seeded in `schema.sql`). Open the printed URL,
paste the key in the top-right field.

> Frontend hot-reload: run `npm run dev` (Vite on :5173, proxies `/api` to :8788)
> in a second terminal alongside `npm run pages:dev`.

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

## Deploy to Cloudflare Pages

You only need **one** database: a D1 named `agentboard`. The Durable Object (`SessionStream`)
is auto-provisioned by the `[[migrations]]` block in `web/wrangler.toml` — nothing to create
by hand. No Redis / Postgres / R2 required.

**1. Create the D1 and wire up its id**

```bash
cd web
wrangler login                                   # or set CLOUDFLARE_API_TOKEN
wrangler d1 create agentboard                    # copy the printed database_id
# paste it into web/wrangler.toml -> database_id (replaces REPLACE_AFTER_d1_create)
npm run db:init:remote                           # create tables in the remote D1
git commit -am "set D1 database_id" && git push
```

**2. Connect the repo in Cloudflare → Pages → Create → Connect to Git**

| Field | Value |
|---|---|
| Framework preset | None |
| **Root directory** | `web` |
| Build command | `npm install && npm run build` |
| Build output directory | `dist` |

Setting **Root directory = `web`** makes Pages read `web/wrangler.toml` automatically, so the
D1 binding, the Durable Object binding, and the DO migration all apply with no manual bindings
in the dashboard.

**3. Set a real ingest key** (don't use the seeded `dev-local-key` in prod)

In Pages → Settings → **Variables and Secrets**, add a **Secret** `AGENTBOARD_BOOTSTRAP_KEY`
(value: `openssl rand -hex 24`) — the Worker accepts it as a full-scope key. Alternatively
insert a row into `api_keys` via `wrangler d1 execute agentboard --remote --command "..."`.

**4. Point agents at the deployment**

```bash
export AGENTBOARD_URL=https://<project>.pages.dev
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
