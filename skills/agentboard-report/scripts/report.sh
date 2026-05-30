#!/usr/bin/env bash
# report.sh — register an AgentBoard session, run a command with live streaming,
# and report completion. Thin wrapper over `agentboard wrap`.
#
# Usage:
#   AGENTBOARD_URL=... AGENTBOARD_KEY=... \
#   bash report.sh --agent claude-code --project myapp --title "task" -- <command...>
set -euo pipefail

AGENT="unknown"
PROJECT=""
TITLE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --) shift; break ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ $# -eq 0 ]]; then
  echo "error: no command after --" >&2
  exit 2
fi

# Prefer uv from the agent package; fall back to an installed agentboard.
if command -v agentboard >/dev/null 2>&1; then
  RUN=(agentboard)
else
  RUN=(uv run --project "$(dirname "$0")/../../../agent" agentboard)
fi

exec "${RUN[@]}" wrap --agent "$AGENT" --project "$PROJECT" --title "$TITLE" -- "$@"
