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
          Pages Functions API, Durable Object for WS, D1 for persistence)
agent/    Python (uv) agent-side client + reporter CLI + process wrapper
skills/   Agent skills: agentboard-report (publish) + agentboard-monitor (observe/manage)
docs/     Architecture & design
```

## Why this stack

Cloudflare Pages can't host a long-running Python server with WebSockets, so the web app
is TypeScript on CF primitives (Functions + Durable Objects + D1). The same code runs
locally via `wrangler pages dev` (Miniflare — no Docker) and deploys to CF Pages on
`git push`. `uv`/Python powers the agent-side skills that actually run next to each
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

1. Push this repo to GitHub (`kinamind/AgentBoard`).
2. In Cloudflare → **Pages → Create → Connect to Git**, select the repo.
   - Build command: `cd web && npm install && npm run build`
   - Build output dir: `web/dist`
   - Root `web/wrangler.toml` provides the D1 + Durable Object bindings.
3. Create the prod D1 + schema:
   ```bash
   cd web
   wrangler d1 create agentboard            # set database_id in wrangler.toml
   npm run db:init:remote
   ```
4. Set a real ingest key: insert a row into `api_keys`, or set the
   `AGENTBOARD_BOOTSTRAP_KEY` secret (`wrangler pages secret put AGENTBOARD_BOOTSTRAP_KEY`).
5. Point agents at the Pages URL via `AGENTBOARD_URL`.

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
