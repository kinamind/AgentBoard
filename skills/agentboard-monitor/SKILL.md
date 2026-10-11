---
name: agentboard-monitor
description: Observe, triage and manage the agents of an AgentBoard OPC (one-person company) console - by department, task and decision queue. Use when asked to "check what the agents are doing", "monitor running sessions", "find stuck/failed agents", "what is waiting for me", "department status", "tail another agent's output", or to remotely "cancel/pause/message" a session, answer a decision, or (re)assign sessions to departments. Also 监控 / 巡检 / 看看各部门 / 卡住的 agent / 待我决策.
---

# AgentBoard - Monitor & manage

Inspect and steer other agents through the AgentBoard API. Think of yourself as the
chief of staff: read the company state, flag what needs the founder, act within limits.

## Setup

```bash
export AGENTBOARD_URL=https://agentboard.frosty-poetry-59f5.workers.dev
export AGENTBOARD_KEY=dev-local-key          # needs read + manage scope
```

Use the installed `agentboard` CLI, or `PYTHONPATH=<repo>/agent/src python -m agentboard.cli ...`.
HTTP fallback: add `-A agentboard-client/0.1` to curl (Cloudflare blocks default Python UA).

## 1. Observe

```bash
agentboard dept                          # departments: active / total / failed
agentboard watch                         # all sessions (one-shot table)
agentboard watch --follow                # live board
agentboard watch --status error --json   # machine-readable, filtered
agentboard stats                         # totals + by_department
agentboard logs <session_id> --follow    # tail one session's terminal
agentboard task list                     # task board (ready / waiting)
agentboard decide list                   # decisions waiting for the founder
```

Sessions carry `department_id`, `task_id`, `tags`. Filter by department with
`GET /api/v1/sessions?department=<slug|none>`.

## 2. Triage (run this first)

```bash
python scripts/triage.py                  # whole company
python scripts/triage.py --department engineering --stale-min 10
```

It prints per-department health and flags: **stuck** (running/waiting but silent for N min),
**failed**, **pending decisions** (founder action needed), **unassigned** sessions,
and sessions with **no task** (work not tied to a goal). Exit code is 0 even when issues
exist; read the output.

Judgement guide:
- **Stuck**: read the last logs/events first (`agentboard logs <id>`); then `ctl <id> message`
  asking for status; only `cancel` if it is clearly looping or the founder agrees.
- **Failed**: summarise the last ~30 log lines + error events; say whether a retry is sensible.
- **Waiting**: usually a decision is pending - surface it to the founder verbatim.
- **No task / no department**: propose an assignment (below), do not guess silently.

## 3. Manage

```bash
agentboard ctl <session_id> message --text "summarise progress, then stop"
agentboard ctl <session_id> pause | resume | cancel
agentboard decide answer <decision_id> --text "yes"       # only with the founder's say-so
```

Notes:
- Commands to an already finished session fail with **409**; do not retry.
- Pending commands expire after 10 minutes if the agent never polls.
- Only sessions started via `agentboard wrap` (or agents that poll `/commands`) act on commands.
  `cancel` needs a `wrap`ped process.

## 4. Organize (assignment)

```bash
agentboard assign <session_id> marketing        # or: none
agentboard rule marketing --field project --op prefix --value landing-
agentboard reassign                              # apply task/roster/rules to unassigned sessions
agentboard roster add --name "Researcher" --agent-type opencode --department research
```

Resolution order for a new session: **explicit > task > roster > rules**.
Departments: `engineering` `marketing` `research` `strategy` `operations` `finance`.

## 5. Programmatic

```python
from agentboard import AgentBoardClient
c = AgentBoardClient()
for d in c.departments()["departments"]:
    print(d["slug"], d["status_counts"])
stuck = [s for s in c.list_sessions(status="running")]
events, logs = c.get_events(stuck[0]["id"]), c.get_logs(stuck[0]["id"])
```

## 6. Decision support

For goal alignment and "should we do this" questions use the **agentboard-insights** skill
(it pulls one context pack and posts structured analyses back).

## HTTP fallback

```bash
curl -s "$AGENTBOARD_URL/api/v1/departments"                 -H "Authorization: Bearer $AGENTBOARD_KEY" -A agentboard-client/0.1
curl -s "$AGENTBOARD_URL/api/v1/sessions?status=running"     -H "Authorization: Bearer $AGENTBOARD_KEY" -A agentboard-client/0.1
curl -s -X POST "$AGENTBOARD_URL/api/v1/sessions/<id>/commands" -H "Authorization: Bearer $AGENTBOARD_KEY" \
  -H 'Content-Type: application/json' -A agentboard-client/0.1 -d '{"kind":"cancel"}'
```
