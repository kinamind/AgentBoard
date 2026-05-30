# AgentBoard — Architecture

AgentBoard is a monitoring panel for coding agents (Claude Code, OpenCode, Cursor,
Codex, Aider, custom agents, …). Agents push session / project / process info and
live terminal output to a central server; a web dashboard shows the real-time status
of every agent session. A monitoring/management API lets other agents (or humans)
observe, analyze, and control sessions.

## Goals

- **Pluggable reporting via skills** — any agent gains reporting by invoking a small
  skill/CLI; no deep integration required.
- **HTTP Push ingest** — agents only need outbound HTTP (works in restricted/sandboxed
  envs). No inbound port on the agent side.
- **Realtime + persistent** — live terminal stream to browsers over WebSocket, plus
  durable history in a database.
- **SaaS + self-host** — multi-tenant by API key; runs locally for free, deploys to
  Cloudflare Workers unchanged.
- **Monitoring/management surface** — read APIs for analysis + a command channel so an
  external controller can steer a session (pause / stop / send-message / annotate).

## Topology

```
┌──────────────┐   HTTP push (events, logs)     ┌──────────────────────────────┐
│ Coding agent │ ─────────────────────────────▶ │  Worker (TS) + static assets  │
│  + skill/CLI │   GET commands (poll)          │  /api/v1/*  ── auth, ingest   │
└──────────────┘ ◀───────────────────────────── │        │            │         │
                                                 │        ▼            ▼         │
                                                 │   D1 (SQLite)   SessionStream │
                                                 │   persistence   Durable Object│
                                                 └────────────────────┬─────────┘
                                                            WS broadcast│
┌──────────────┐   WS subscribe (live terminal + status)              ▼
│  Browser     │ ◀──────────────────────────────────────────  fan-out to clients
│  dashboard   │   REST (history, list, stats)
└──────────────┘
```

- **Agent → server**: HTTP POST only. Simple, firewall-friendly, retry-safe.
- **Server → browser**: WebSocket via a Durable Object that fans out to subscribers and
  keeps a recent-line ring buffer for instant backlog on connect.
- **Persistence**: every write hits D1 first (source of truth); the DO is the realtime
  bus. Large log blobs can overflow to R2 (optional, off by default).

## Why this fits Cloudflare Workers

CF can't host a long-running Python server, but a single Worker natively runs:
- **Static assets** (the React/Vite build) — the dashboard, via the `[assets]` binding.
- **Worker** — the API (`/api/v1/*`, Workers runtime, TypeScript).
- **Durable Objects** — the only correct primitive for WebSocket coordination + live
  session state on CF. (Pages can't self-host a DO — it rejects `[[migrations]]` and
  requires an external `script_name` — so the app is a Worker, not a Pages project.)
- **D1** — SQLite-compatible serverless DB for persistence.

Local dev uses `wrangler dev`, which emulates Workers + DO + D1 via Miniflare —
no Docker, identical code path to production. Deploy = `wrangler deploy` (or git
auto-deploy via Workers Builds).

`uv`/Python owns the **agent side** (the skill + reporter CLI + process wrapper), which
is what actually runs next to each coding agent.

## Components

### 1. Web app (`web/`, TypeScript)
- `worker/index.ts` — single Worker entrypoint: routes `/api/v1/*` to the handlers,
  exports the `SessionStream` Durable Object, and falls back to static assets (the SPA).
- `routes/api/v1/*` — request handlers for `/api/v1/*` and the WS upgrade endpoint.
- `do/SessionStream.ts` — Durable Object: holds subscriber sockets, broadcasts
  status/log frames, keeps an in-memory ring buffer (last N lines).
- `src/` — React + Vite + Tailwind dashboard; xterm.js for terminal rendering.
- `schema.sql` — D1 schema + migrations.

### 2. Agent side (`agent/`, Python + uv)
- `agentboard.client` — typed HTTP client (push events/logs, poll commands).
- `agentboard.cli` — `agentboard` CLI: `start`, `event`, `log`, `done`, `fail`,
  `wrap` (run a command and stream its output), `watch` (monitor sessions),
  `ctl` (send management commands).
- Designed to be dependency-light (stdlib `urllib` fallback; `httpx` optional).

### 3. Skills (`skills/`)
- `agentboard-report` — instructs an agent how to register a session and stream output.
- `agentboard-monitor` — instructs an agent how to observe/analyze/manage other
  sessions through the monitoring API.

## Data model (D1)

```
projects(id, name, created_at)
sessions(id, project_id, agent_type, title, status, cwd, host, pid,
         started_at, updated_at, ended_at, exit_code, meta_json)
events(id, session_id, ts, type, level, message, data_json)
logs(id, session_id, seq, ts, stream, content)          -- stream: stdout|stderr
commands(id, session_id, ts, kind, payload_json, status) -- status: pending|delivered|done
api_keys(key, name, scopes, created_at)
```

Status enum for `sessions`: `starting | running | waiting | done | error | cancelled`.

## HTTP API (`/api/v1`)

Auth: `Authorization: Bearer <api_key>` (ingest + management). Read endpoints can be
opened to a dashboard session token.

| Method | Path | Purpose |
|---|---|---|
| POST | `/sessions` | Register a session → returns `id`, `ws_url` |
| PATCH | `/sessions/:id` | Update status / metadata |
| POST | `/sessions/:id/events` | Append a lifecycle event |
| POST | `/sessions/:id/logs` | Append a batch of log lines (stdout/stderr) |
| POST | `/sessions/:id/heartbeat` | Liveness ping |
| GET | `/sessions` | List sessions (filter: status, project, agent_type) |
| GET | `/sessions/:id` | Session detail |
| GET | `/sessions/:id/logs?after=seq` | Historical log paging |
| GET | `/sessions/:id/events` | Event history |
| GET | `/stats` | Aggregate counts (for panels) |
| POST | `/sessions/:id/commands` | Enqueue a management command |
| GET | `/sessions/:id/commands?wait=1` | Agent polls/long-polls pending commands |
| POST | `/sessions/:id/commands/:cid/ack` | Agent acks command result |
| GET | `/sessions/:id/stream` (Upgrade) | Browser WS subscribe (via SessionStream DO) |

### Realtime frames (WS, server → browser)
```jsonc
{ "t": "snapshot", "session": {...}, "lines": [{seq,stream,content,ts}, ...] }
{ "t": "log",    "seq": 42, "stream": "stdout", "content": "...", "ts": 123 }
{ "t": "status", "status": "running", "ts": 123 }
{ "t": "event",  "event": {type, level, message, ts} }
```

## Management / monitoring flow

1. A controller (agent or human) `POST /sessions/:id/commands` with e.g.
   `{ "kind": "cancel" }`, `{ "kind": "message", "payload": {"text": "..."} }`,
   `{ "kind": "pause" }`.
2. The reporting agent's wrapper polls `GET /sessions/:id/commands?wait=1`, receives the
   command, applies it (signal the child process / inject a note), and acks.
3. Read endpoints (`/sessions`, `/stats`, `/events`) provide the analysis surface.

This keeps the agent push-only (no inbound socket) while still allowing remote control.

## Security / multi-tenancy

- API keys scope writes to a tenant; `scopes` gates ingest vs. management vs. read.
- All session ids are random (ULID-ish); the WS subscribe path requires a read token.
- CORS configured for the dashboard origin; same-origin in the CF Workers deployment.

## Roadmap (post-slice)

- R2 overflow for very long logs; log retention policy.
- Auth UI + per-tenant dashboards; OAuth.
- Metrics/cost panels (tokens, duration, success rate) and alerting.
- MCP server wrapper around the monitoring API.
