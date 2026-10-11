---
name: agentboard-report
description: Report this coding agent's session, department, task, status, decisions and live terminal output to an AgentBoard (OPC company console) server. Use at the start of any non-trivial task to register a session, stream output, claim/attach to a task, ask the founder for a decision, and mark completion. Triggers when the user wants the run "tracked", "monitored", "visible on the board/dashboard", asks to "report to AgentBoard", or says 上报 / 汇报 / 同步到看板 / 登记会话.
---

# AgentBoard - Report a session

AgentBoard is the console of a one-person company (OPC). Agents are grouped into
**departments**, work on **tasks** that serve **goals**, and ask the founder for
**decisions** when blocked. Reporting makes this run visible, attributable and steerable.

## 1. Connect (always)

```bash
export AGENTBOARD_URL=https://agentboard.frosty-poetry-59f5.workers.dev
export AGENTBOARD_KEY=dev-local-key      # default demo key
```

The `agentboard` CLI is the preferred transport. If it is not installed, run it from the
repo: `PYTHONPATH=<repo>/agent/src python -m agentboard.cli ...` (Python 3.9+, stdlib only),
or use the pure-HTTP fallback in section 6.

## 2. Standard report flow

Wrap the real command; session registration, live log streaming, remote-command handling
and the final status are automatic:

```bash
agentboard wrap --agent claude-code \
  --project my-app \
  --department engineering \
  -- <command>
```

Options (all optional; unset ones are auto-resolved):

| Option | Meaning |
|---|---|
| `--agent` | who you are (`claude-code`, `opencode`, `cursor`, ...) |
| `--project` | project name |
| `--department` | department slug: `engineering` `marketing` `research` `strategy` `operations` `finance` (or a custom one) |
| `--task` | task id (`t_...`) this session works on; also moves the task to *running* |
| `--tag` | free-form tag (repeatable) |
| env `AGENTBOARD_DEPARTMENT` / `AGENTBOARD_TASK` | same as the flags, set once per shell |

If you omit `--department`, AgentBoard resolves it: **task -> roster -> assignment rules**.
Pass it explicitly whenever you know it.

## 3. Interactive / non-wrappable work (a chat session like this one)

When you cannot wrap one command (you are the agent doing many steps), use the manual lifecycle:

```bash
export AGENTBOARD_SESSION=$(agentboard start --agent opencode --project my-app \
  --department strategy --title "short task title" --print-id)

agentboard log "what I am doing now"            # meaningful progress, not noise
agentboard event "edited src/auth.ts" --type tool
agentboard status waiting                       # blocked on the user
agentboard done                                 # or: agentboard fail --message "why"
```

Rules:
- Register **once, early**; keep the id in `AGENTBOARD_SESSION`.
- Title = the task in plain words. It is what the founder reads.
- Use `waiting` only when you truly need the founder; pair it with a decision (section 5).
- Always end with `done` or `fail` so the board reflects reality.
- Send `agentboard heartbeat` every ~30 s during long silent stretches.

## 4. Working from the task board (recommended for autonomous agents)

```bash
agentboard task claim --agent claude-code --department engineering   # lease 15 min
# -> prints the task JSON (id, title, description); exit code 3 if nothing is ready
export AGENTBOARD_TASK=<task id>
agentboard wrap --agent claude-code --department engineering -- <command>
agentboard task heartbeat <task id>                                  # extend the lease
agentboard task update <task id> --status review --result '{"summary":"..."}'
agentboard task update <task id> --status done
```

- A task becomes claimable only when all its `depends_on` tasks are `done`.
- If you stop heartbeating, the lease expires and the task returns to `todo` for others.
- Hand-off: set `--status review` with a `--result` summary instead of `done` when someone must check.

## 5. Ask the founder for a decision (instead of guessing)

```bash
agentboard decide ask --question "Ship the pricing page as-is?" --option yes --option no
agentboard status waiting
```

The founder answers in the console (Goals & Tasks / Overview). The answer arrives as a
`message` command: when running under `wrap`, it is appended to the file in
`$AGENTBOARD_INBOX` - **read that file** (poll it) and continue. Do not proceed on the
disputed point until it is answered.

## 6. Management commands you may receive

Under `wrap`: `cancel` terminates the child, `pause`/`resume` signal it (POSIX),
`message` is written to `$AGENTBOARD_INBOX` and noted as an event - read and act on it.
Commands sent after your session ended are rejected (409) and expire after 10 minutes.

## 7. HTTP fallback (no Python, no CLI) - also the one-paste prompt for online agents

```bash
B="$AGENTBOARD_URL/api/v1"; H=(-H "Authorization: Bearer $AGENTBOARD_KEY" -H 'Content-Type: application/json')
SID=$(curl -s -X POST "$B/sessions" "${H[@]}" \
  -d '{"agent_type":"claude-code","title":"task","project":"myapp","department":"engineering","status":"running"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X POST  "$B/sessions/$SID/logs" "${H[@]}" -d '{"content":"progress line"}'
curl -s -X PATCH "$B/sessions/$SID"      "${H[@]}" -d '{"status":"done","exit_code":0}'
```

Custom `User-Agent` is required by the Cloudflare edge for non-browser clients
(e.g. `-A agentboard-client/0.1`); the bare `Python-urllib` UA is blocked (error 1010).

For an online agent that can only receive text, paste this:

```
While you work, report progress to AgentBoard with curl only.
base=https://agentboard.frosty-poetry-59f5.workers.dev  header: Authorization: Bearer dev-local-key  (+ -A agentboard-client/0.1)
1) start:  POST {base}/api/v1/sessions {"agent_type":"<you>","title":"<task>","department":"<engineering|marketing|research|strategy|operations|finance>","status":"running"} -> remember id
2) during: POST {base}/api/v1/sessions/{id}/logs {"content":"<one line>"}
3) blocked on a human choice: POST {base}/api/v1/decisions {"session_id":"{id}","question":"...","options":["a","b"]}
4) finish: PATCH {base}/api/v1/sessions/{id} {"status":"done","exit_code":0}   (failure: "error", non-zero)
```

## Helper

`scripts/report.sh` wraps the flow: `bash scripts/report.sh --agent X --project P --department D --task T --title "..." -- <command>`.
