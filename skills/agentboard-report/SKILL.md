---
name: agentboard-report
description: Report this coding agent's session, status, and live terminal output to an AgentBoard server so it shows up on the monitoring dashboard. Use at the start of any non-trivial task to register a session, stream command output, and mark progress/completion. Triggers when the user wants their agent run "tracked", "monitored", "visible on the board/dashboard", or asks to "report to AgentBoard".
---

# AgentBoard — Report a session

Make this agent run visible on the AgentBoard dashboard by pushing session info,
status changes, and live terminal output over HTTP.

## Prerequisites

The reporter CLI lives in the `agent/` package and needs two env vars:

```bash
export AGENTBOARD_URL=http://127.0.0.1:8788   # or your deployed Worker URL
export AGENTBOARD_KEY=<api-key>               # default local dev key: dev-local-key
```

Run the CLI with `uv` (from the repo's `agent/` dir) or via the installed `agentboard`
command. If unavailable, fall back to plain `curl` (see "HTTP fallback" below).

## Workflow

### 1. Register a session at the start of the task

The simplest robust pattern wraps the actual work command so output streams
automatically and completion is reported for you:

```bash
uv run agentboard wrap \
  --agent claude-code \
  --project "$(basename "$PWD")" \
  --title "implement feature X" \
  -- <the command you were going to run>
```

`wrap` registers the session, streams stdout/stderr live, applies any management
commands (cancel/pause/message), and reports the exit status.

### 2. Manual lifecycle (when you can't wrap a single command)

```bash
export AGENTBOARD_SESSION=$(uv run agentboard start \
  --agent claude-code --project myapp --title "refactor auth" --print-id)

uv run agentboard status running
uv run agentboard log "running test suite..."
uv run agentboard event "edited src/auth.ts" --type tool
# ... do work, log meaningful progress ...
uv run agentboard done            # or: agentboard fail --message "tests failed"
```

Guidance for the agent:
- Call `start` once, early, capturing the session id into `AGENTBOARD_SESSION`.
- Set `status running` while working; `waiting` when blocked on the user/input.
- `log` important command output and `event` significant steps (tool calls, file
  edits, errors). Keep it signal, not noise.
- Always finish with `done` (success) or `fail` (error) so the board reflects reality.
- Send a `heartbeat` every ~30s during long silent stretches.

### 3. Honor management commands

If you are running a long task without `wrap`, periodically poll for controller
commands and obey them:

```bash
uv run agentboard --session "$AGENTBOARD_SESSION" stats   # sanity check connectivity
```

`wrap` does this automatically: `cancel` terminates the child, `pause`/`resume` signal
it, and `message` is surfaced to you as a note — read and act on it.

## HTTP fallback (no Python)

```bash
SID=$(curl -s -X POST "$AGENTBOARD_URL/api/v1/sessions" \
  -H "Authorization: Bearer $AGENTBOARD_KEY" -H 'Content-Type: application/json' \
  -d '{"agent_type":"claude-code","title":"task","project":"myapp","status":"running"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

curl -s -X POST "$AGENTBOARD_URL/api/v1/sessions/$SID/logs" \
  -H "Authorization: Bearer $AGENTBOARD_KEY" -H 'Content-Type: application/json' \
  -d '{"content":"hello from the agent"}'

curl -s -X PATCH "$AGENTBOARD_URL/api/v1/sessions/$SID" \
  -H "Authorization: Bearer $AGENTBOARD_KEY" -H 'Content-Type: application/json' \
  -d '{"status":"done","exit_code":0}'
```

## Helper

`scripts/report.sh` wraps the common register→stream→finish flow; run
`bash scripts/report.sh --help`.
