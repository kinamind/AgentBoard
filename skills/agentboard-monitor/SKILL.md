---
name: agentboard-monitor
description: Observe, analyze, and manage other coding-agent sessions running on AgentBoard. Use when asked to "check what the agents are doing", "monitor running sessions", "find stuck/failed agents", "tail another agent's output", or to remotely "cancel/pause/message" a session. Provides read APIs for analysis and a command channel for control.
---

# AgentBoard — Monitor & manage sessions

Inspect and steer other agent sessions through the AgentBoard monitoring API.

## Setup

```bash
export AGENTBOARD_URL=http://127.0.0.1:8788
export AGENTBOARD_KEY=<api-key-with-read+manage-scope>
```

## Observe

List sessions (optionally filtered) and watch live:

```bash
uv run agentboard watch                       # one-shot table
uv run agentboard watch --follow              # live-updating
uv run agentboard watch --status error --json # machine-readable, filtered
uv run agentboard stats                       # aggregate counts for analysis
```

Tail a specific session's terminal output:

```bash
uv run agentboard logs <session_id> --follow
```

Inspect history programmatically (for analysis):

```python
from agentboard import AgentBoardClient
c = AgentBoardClient()
for s in c.list_sessions(status="running"):
    print(s["id"], s["agent_type"], s["title"])
events = c.get_events("<session_id>")        # tool calls, errors, status changes
logs = c.get_logs("<session_id>", after=0)   # full terminal history
```

## Analyze (suggested checks)

- **Stuck**: status `running`/`waiting` but `updated_at` older than N minutes → likely
  hung; inspect logs, consider `message` or `cancel`.
- **Failing**: status `error` with non-zero `exit_code` → read last log lines + events.
- **Throughput**: use `stats` (counts by status/agent) to summarize fleet health.

## Manage

Send management commands; the target agent's wrapper applies them and acks the result:

```bash
uv run agentboard ctl <session_id> message --text "please summarize progress and stop"
uv run agentboard ctl <session_id> pause
uv run agentboard ctl <session_id> resume
uv run agentboard ctl <session_id> cancel
```

Commands are queued and delivered when the target polls (push-only agents stay
firewall-friendly). Only sessions started with `agentboard wrap` (or an agent that polls
`/commands`) will act on them automatically; otherwise the command is recorded for the
agent/operator to honor.

## HTTP fallback

```bash
curl -s "$AGENTBOARD_URL/api/v1/sessions?status=running" \
  -H "Authorization: Bearer $AGENTBOARD_KEY"

curl -s -X POST "$AGENTBOARD_URL/api/v1/sessions/<id>/commands" \
  -H "Authorization: Bearer $AGENTBOARD_KEY" -H 'Content-Type: application/json' \
  -d '{"kind":"cancel"}'
```

## Helper

`scripts/triage.py` prints a health summary and flags stuck/failed sessions:
`uv run python scripts/triage.py`.
