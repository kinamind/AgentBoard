"""``agentboard`` command-line interface.

Examples::

    # Run a command and stream everything to the board:
    agentboard wrap --agent claude-code --project myapp -- pytest -q

    # Manual lifecycle (for embedding in a script or skill):
    export AGENTBOARD_SESSION=$(agentboard start --agent aider --title "fix bug" --print-id)
    agentboard log "starting work"
    agentboard status running
    agentboard done

    # Monitoring / management (controller side):
    agentboard watch --follow
    agentboard ctl <session_id> cancel
    agentboard ctl <session_id> message --text "please stop and summarize"
"""

from __future__ import annotations

import argparse
import json
import sys
import time

from .client import AgentBoardClient, AgentBoardError
from .wrap import run_wrapped

STATUS_GLYPH = {
    "starting": "○",
    "running": "▶",
    "waiting": "◐",
    "done": "✔",
    "error": "✖",
    "cancelled": "⊘",
}


def _client(args) -> AgentBoardClient:
    return AgentBoardClient(url=args.url, key=args.key, session_id=getattr(args, "session", None))


def cmd_start(args) -> int:
    c = _client(args)
    sid = c.start(
        agent_type=args.agent,
        title=args.title,
        project=args.project,
        status=args.status,
    )
    if args.print_id:
        print(sid)
    else:
        print(f"session {sid} started")
    return 0


def cmd_status(args) -> int:
    _client(args).status(args.value, exit_code=args.exit_code)
    return 0


def cmd_log(args) -> int:
    c = _client(args)
    text = args.text if args.text is not None else sys.stdin.read()
    c.log(text, stream=args.stream)
    return 0


def cmd_event(args) -> int:
    _client(args).event(type=args.type, message=args.message, level=args.level)
    return 0


def cmd_done(args) -> int:
    _client(args).done(exit_code=args.exit_code)
    return 0


def cmd_fail(args) -> int:
    _client(args).fail(message=args.message, exit_code=args.exit_code)
    return 0


def cmd_heartbeat(args) -> int:
    _client(args).heartbeat()
    return 0


def cmd_wrap(args) -> int:
    c = _client(args)
    if not args.command:
        print("error: no command given after --", file=sys.stderr)
        return 2
    return run_wrapped(
        c,
        args.command,
        agent_type=args.agent,
        title=args.title,
        project=args.project,
    )


def cmd_watch(args) -> int:
    c = _client(args)
    while True:
        sessions = c.list_sessions(status=args.status or "", agent_type=args.agent or "")
        if args.json:
            print(json.dumps(sessions))
        else:
            _print_clear()
            print(f"{'STATUS':<9} {'AGENT':<14} {'UPDATED':<9} TITLE")
            for s in sessions:
                glyph = STATUS_GLYPH.get(s["status"], "?")
                age = _ago(s["updated_at"])
                print(
                    f"{glyph} {s['status']:<7} {s['agent_type'][:13]:<14} {age:<9} "
                    f"{(s['title'] or s['id'])[:50]}"
                )
        if not args.follow:
            return 0
        time.sleep(args.interval)


def cmd_logs(args) -> int:
    c = _client(args)
    after = 0
    while True:
        lines = c.get_logs(session_id=args.session_id, after=after)
        for ln in lines:
            after = max(after, ln["seq"])
            out = sys.stderr if ln["stream"] == "stderr" else sys.stdout
            out.write(ln["content"] + "\n")
        if not args.follow:
            return 0
        time.sleep(args.interval)


def cmd_ctl(args) -> int:
    c = _client(args)
    payload = None
    if args.kind == "message":
        payload = {"text": args.text or ""}
    elif args.payload:
        payload = json.loads(args.payload)
    res = c.send_command(args.session_id, args.kind, payload)
    print(f"command {res['id']} queued ({args.kind})")
    return 0


def cmd_stats(args) -> int:
    print(json.dumps(_client(args).stats(), indent=2))
    return 0


def _ago(ts: int) -> str:
    s = int(time.time() - ts / 1000)
    if s < 60:
        return f"{s}s"
    if s < 3600:
        return f"{s // 60}m"
    if s < 86400:
        return f"{s // 3600}h"
    return f"{s // 86400}d"


def _print_clear() -> None:
    sys.stdout.write("\x1b[2J\x1b[H")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="agentboard", description="AgentBoard reporter & monitor")
    p.add_argument("--url", help="server base URL (env AGENTBOARD_URL)")
    p.add_argument("--key", help="API key (env AGENTBOARD_KEY)")
    p.add_argument("--session", help="session id (env AGENTBOARD_SESSION)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("start", help="register a new session")
    s.add_argument("--agent", default="unknown")
    s.add_argument("--title")
    s.add_argument("--project")
    s.add_argument("--status", default="running")
    s.add_argument("--print-id", action="store_true", help="print only the session id")
    s.set_defaults(func=cmd_start)

    s = sub.add_parser("status", help="update session status")
    s.add_argument("value", choices=["starting", "running", "waiting", "done", "error", "cancelled"])
    s.add_argument("--exit-code", type=int)
    s.set_defaults(func=cmd_status)

    s = sub.add_parser("log", help="append a log line (or stdin)")
    s.add_argument("text", nargs="?")
    s.add_argument("--stream", default="stdout", choices=["stdout", "stderr"])
    s.set_defaults(func=cmd_log)

    s = sub.add_parser("event", help="append a lifecycle event")
    s.add_argument("message")
    s.add_argument("--type", default="note")
    s.add_argument("--level", default="info", choices=["debug", "info", "warn", "error"])
    s.set_defaults(func=cmd_event)

    s = sub.add_parser("done", help="mark session done")
    s.add_argument("--exit-code", type=int, default=0)
    s.set_defaults(func=cmd_done)

    s = sub.add_parser("fail", help="mark session error")
    s.add_argument("--message")
    s.add_argument("--exit-code", type=int, default=1)
    s.set_defaults(func=cmd_fail)

    s = sub.add_parser("heartbeat", help="liveness ping")
    s.set_defaults(func=cmd_heartbeat)

    s = sub.add_parser("wrap", help="run a command and stream its output")
    s.add_argument("--agent", default="shell")
    s.add_argument("--title")
    s.add_argument("--project")
    s.add_argument("command", nargs=argparse.REMAINDER, help="-- command args...")
    s.set_defaults(func=cmd_wrap)

    s = sub.add_parser("watch", help="list / monitor sessions")
    s.add_argument("--follow", action="store_true")
    s.add_argument("--interval", type=float, default=2.0)
    s.add_argument("--status")
    s.add_argument("--agent")
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_watch)

    s = sub.add_parser("logs", help="print a session's logs")
    s.add_argument("session_id")
    s.add_argument("--follow", action="store_true")
    s.add_argument("--interval", type=float, default=1.5)
    s.set_defaults(func=cmd_logs)

    s = sub.add_parser("ctl", help="send a management command to a session")
    s.add_argument("session_id")
    s.add_argument("kind", choices=["cancel", "pause", "resume", "message", "annotate", "custom"])
    s.add_argument("--text", help="for 'message'")
    s.add_argument("--payload", help="JSON payload for 'custom'")
    s.set_defaults(func=cmd_ctl)

    s = sub.add_parser("stats", help="aggregate stats")
    s.set_defaults(func=cmd_stats)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    # `wrap` uses REMAINDER which keeps a leading "--"; strip it.
    if getattr(args, "command", None) and args.command and args.command[0] == "--":
        args.command = args.command[1:]
    try:
        return args.func(args)
    except AgentBoardError as e:
        print(f"agentboard: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
