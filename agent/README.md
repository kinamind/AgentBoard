# agentboard (agent-side client)

Zero-dependency Python client, CLI, and process wrapper that report a coding agent's
session, status, and live terminal output to an [AgentBoard](../README.md) server over
HTTP push.

## Install (uv)

```bash
cd agent
uv sync
uv run agentboard --help
```

## Configure

```bash
export AGENTBOARD_URL=http://127.0.0.1:8788   # server base URL
export AGENTBOARD_KEY=dev-local-key           # API key
```

## Use

Wrap any command and stream it:

```bash
uv run agentboard wrap --agent claude-code --project myapp -- pytest -q
```

Manual lifecycle (e.g. inside a skill):

```bash
export AGENTBOARD_SESSION=$(uv run agentboard start --agent aider --title "fix bug" --print-id)
uv run agentboard log "starting work"
uv run agentboard status running
uv run agentboard done
```

Monitor & manage other sessions:

```bash
uv run agentboard watch --follow
uv run agentboard logs <session_id> --follow
uv run agentboard ctl <session_id> cancel
uv run agentboard ctl <session_id> message --text "please summarize and stop"
```

See `python -m agentboard.cli --help` or `uv run agentboard <cmd> --help`.
