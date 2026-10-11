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
        department=args.department,
        task_id=args.task,
        tags=args.tag or None,
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
        department=args.department,
        task_id=args.task,
        tags=args.tag or None,
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


def _org_args(s) -> None:
    s.add_argument("--department", help="department slug/id (env AGENTBOARD_DEPARTMENT)")
    s.add_argument("--task", help="task id this session works on (env AGENTBOARD_TASK)")
    s.add_argument("--tag", action="append", help="tag (repeatable)")


def _dump(obj) -> int:
    print(json.dumps(obj, indent=2, ensure_ascii=False))
    return 0


def cmd_dept(args) -> int:
    c = _client(args)
    if args.action == "add":
        return _dump(c.create_department(args.name, slug=args.slug))
    data = c.departments()
    if args.json:
        return _dump(data)
    print(f"{'SLUG':<13} {'NAME':<14} {'ACTIVE':>6} {'TOTAL':>6} {'ERR':>4}")
    for d in data["departments"]:
        sc = d["status_counts"]
        active = sum(sc.get(k, 0) for k in ("running", "waiting", "starting"))
        print(f"{d['slug']:<13} {d['name']:<14} {active:>6} {sum(sc.values()):>6} {sc.get('error', 0):>4}")
    un = data["unassigned"]
    if un:
        print(f"{'(unassigned)':<28} {sum(un.values()):>13}")
    return 0


def cmd_assign(args) -> int:
    _client(args).assign(args.session_id, None if args.department == "none" else args.department)
    print(f"{args.session_id} -> {args.department}")
    return 0


def cmd_reassign(args) -> int:
    return _dump(_client(args).reassign(only_unassigned=not args.all))


def cmd_rule(args) -> int:
    return _dump(_client(args).add_rule(args.department, args.field, args.value, op=args.op, priority=args.priority))


def cmd_roster(args) -> int:
    c = _client(args)
    if args.action == "add":
        return _dump(c.add_agent(args.name, args.agent_type, department=args.department, role=args.role))
    return _dump(c.roster())


def cmd_goal(args) -> int:
    c = _client(args)
    if args.action == "add":
        return _dump(c.create_goal(args.title, parent_id=args.parent, level=args.level))
    return _dump(c.goals())


def cmd_task(args) -> int:
    c = _client(args)
    if args.action == "add":
        return _dump(
            c.create_task(
                args.title,
                goal_id=args.goal,
                department=args.department,
                description=args.description,
                depends_on=args.depends_on,
            )
        )
    if args.action == "claim":
        t = c.claim_task(agent=args.agent, department=args.department, lease_seconds=args.lease)
        if not t:
            print("no ready task")
            return 3
        return _dump(t)
    if args.action == "update":
        fields = {k: v for k, v in (("status", args.status), ("title", args.title)) if v}
        if args.result:
            fields["result"] = json.loads(args.result)
        c.update_task(args.task_id, **fields)
        print("ok")
        return 0
    if args.action == "heartbeat":
        return _dump(c.task_heartbeat(args.task_id, lease_seconds=args.lease))
    rows = c.tasks(status=args.status or "", department_id=args.department or "")
    if args.json:
        return _dump(rows)
    for t in rows:
        flag = "ready" if t["ready"] else ""
        print(f"{t['id']:<22} {t['status']:<9} {flag:<6} {t['title']}")
    return 0


def cmd_decide(args) -> int:
    c = _client(args)
    if args.action == "ask":
        return _dump(c.ask_decision(args.question, options=args.option, session_id=args.session or c.session_id))
    if args.action == "answer":
        c.answer_decision(args.decision_id, args.text)
        print("ok")
        return 0
    return _dump(c.decisions(status=None if args.all else "pending"))


def cmd_insights(args) -> int:
    c = _client(args)
    if args.action == "context":
        return _dump(c.insights_context(scope=args.scope, scope_id=args.id))
    if args.action == "post":
        result = json.load(open(args.file, encoding="utf-8")) if args.file else json.load(sys.stdin)
        return _dump(
            c.post_analysis(
                args.framework, args.target_type, result, target_id=args.target_id, analyzer=args.analyzer
            )
        )
    return _dump(c.analyses(framework=args.framework or "", target_id=args.target_id or ""))


def cmd_migrate(args) -> int:
    return _dump(_client(args).migrate())


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
    _org_args(s)
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
    _org_args(s)
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

    # --- organization ---
    s = sub.add_parser("dept", help="list / add departments")
    s.add_argument("action", nargs="?", default="list", choices=["list", "add"])
    s.add_argument("--name")
    s.add_argument("--slug")
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_dept)

    s = sub.add_parser("assign", help="assign a session to a department (or 'none')")
    s.add_argument("session_id")
    s.add_argument("department")
    s.set_defaults(func=cmd_assign)

    s = sub.add_parser("reassign", help="re-apply task/roster/rules to sessions")
    s.add_argument("--all", action="store_true", help="also re-evaluate sessions that already have a department")
    s.set_defaults(func=cmd_reassign)

    s = sub.add_parser("rule", help="add an auto-assignment rule")
    s.add_argument("department")
    s.add_argument("--field", required=True, choices=["agent_type", "project", "title", "cwd"])
    s.add_argument("--value", required=True)
    s.add_argument("--op", default="eq", choices=["eq", "prefix", "contains", "regex"])
    s.add_argument("--priority", type=int, default=100)
    s.set_defaults(func=cmd_rule)

    s = sub.add_parser("roster", help="list / add agents in the roster")
    s.add_argument("action", nargs="?", default="list", choices=["list", "add"])
    s.add_argument("--name")
    s.add_argument("--agent-type", dest="agent_type")
    s.add_argument("--department")
    s.add_argument("--role")
    s.set_defaults(func=cmd_roster)

    # --- goals / tasks ---
    s = sub.add_parser("goal", help="list / add goals")
    s.add_argument("action", nargs="?", default="list", choices=["list", "add"])
    s.add_argument("--title")
    s.add_argument("--parent")
    s.add_argument("--level")
    s.set_defaults(func=cmd_goal)

    s = sub.add_parser("task", help="task board: list|add|claim|update|heartbeat")
    s.add_argument("action", nargs="?", default="list", choices=["list", "add", "claim", "update", "heartbeat"])
    s.add_argument("task_id", nargs="?")
    s.add_argument("--title")
    s.add_argument("--description")
    s.add_argument("--goal")
    s.add_argument("--department")
    s.add_argument("--depends-on", dest="depends_on", action="append")
    s.add_argument("--agent", help="claimer name (claim)")
    s.add_argument("--lease", type=int, default=900, help="lease seconds (claim/heartbeat)")
    s.add_argument("--status")
    s.add_argument("--result", help="JSON result (update)")
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_task)

    s = sub.add_parser("decide", help="decision inbox: ask|list|answer")
    s.add_argument("action", nargs="?", default="list", choices=["list", "ask", "answer"])
    s.add_argument("decision_id", nargs="?")
    s.add_argument("--question")
    s.add_argument("--option", action="append")
    s.add_argument("--text", help="answer text")
    s.add_argument("--session")
    s.add_argument("--all", action="store_true")
    s.set_defaults(func=cmd_decide)

    # --- insights ---
    s = sub.add_parser("insights", help="decision support: context|post|list")
    s.add_argument("action", nargs="?", default="list", choices=["context", "post", "list"])
    s.add_argument("--scope", default="company", choices=["company", "department", "goal"])
    s.add_argument("--id")
    s.add_argument("--framework")
    s.add_argument("--target-type", dest="target_type", default="company")
    s.add_argument("--target-id", dest="target_id")
    s.add_argument("--analyzer", default="external:agent")
    s.add_argument("--file", help="JSON result file (post); default stdin")
    s.set_defaults(func=cmd_insights)

    s = sub.add_parser("migrate", help="apply server schema upgrades (idempotent)")
    s.set_defaults(func=cmd_migrate)

    return p


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # Windows consoles default to a legacy codepage
        except Exception:
            pass
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
