#!/usr/bin/env python3
"""triage.py - company-wide health summary for the AgentBoard OPC console.

Per-department health, plus: stuck sessions (active but silent), failed sessions,
pending founder decisions, unassigned sessions, and sessions with no task.
Reads AGENTBOARD_URL / AGENTBOARD_KEY from the environment.

Usage:
    python scripts/triage.py [--department engineering] [--stale-min 10] [--json]

Needs the `agentboard` package importable (installed, or PYTHONPATH=<repo>/agent/src).
"""

from __future__ import annotations

import argparse
import json
import sys
import time

try:
    from agentboard import AgentBoardClient
except ImportError:
    sys.exit("agentboard package not importable; install it or set PYTHONPATH=<repo>/agent/src")


ACTIVE = ("running", "waiting", "starting")


def main() -> int:
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except Exception:
            pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--stale-min", type=float, default=10.0, help="staleness threshold (minutes)")
    ap.add_argument("--department", help="limit to one department slug")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    c = AgentBoardClient()
    deps = c.departments()["departments"]
    by_id = {d["id"]: d for d in deps}
    sessions = c.list_sessions(limit="500")
    decisions = c.decisions("pending")
    now = time.time() * 1000
    stale_ms = args.stale_min * 60_000

    if args.department:
        want = next((d["id"] for d in deps if d["slug"] == args.department or d["id"] == args.department), None)
        if not want:
            sys.exit(f"unknown department: {args.department}")
        sessions = [s for s in sessions if s.get("department_id") == want]

    def dname(s: dict) -> str:
        return by_id.get(s.get("department_id"), {}).get("name", "(unassigned)")

    stuck = [s for s in sessions if s["status"] in ("running", "waiting") and now - s["updated_at"] > stale_ms]
    failed = [s for s in sessions if s["status"] == "error"]
    unassigned = [s for s in sessions if not s.get("department_id")]
    no_task = [s for s in sessions if s["status"] in ACTIVE and not s.get("task_id")]

    rows = {}
    for s in sessions:
        r = rows.setdefault(dname(s), {"active": 0, "total": 0, "error": 0, "done": 0})
        r["total"] += 1
        r["active"] += s["status"] in ACTIVE
        r["error"] += s["status"] == "error"
        r["done"] += s["status"] == "done"

    if args.json:
        print(json.dumps({
            "departments": rows,
            "stuck": [s["id"] for s in stuck],
            "failed": [s["id"] for s in failed],
            "pending_decisions": [d["id"] for d in decisions],
            "unassigned": [s["id"] for s in unassigned],
            "active_without_task": [s["id"] for s in no_task],
        }, ensure_ascii=False, indent=2))
        return 0

    print(f"{'DEPARTMENT':<16} {'ACTIVE':>6} {'TOTAL':>6} {'FAILED':>6} {'DONE':>6}")
    for name, r in sorted(rows.items()):
        print(f"{name:<16} {r['active']:>6} {r['total']:>6} {r['error']:>6} {r['done']:>6}")

    if decisions:
        print(f"\n? {len(decisions)} decision(s) waiting for the founder:")
        for d in decisions:
            print(f"  {d['id']}  {d['question']}  options={d.get('options')}")

    if stuck:
        print(f"\n! {len(stuck)} possibly stuck (silent > {args.stale_min:g}m):")
        for s in stuck:
            mins = int((now - s["updated_at"]) / 60000)
            print(f"  {s['id']}  [{dname(s)}] {s['agent_type']:<12} {mins}m idle  {s['title'] or ''}")

    if failed:
        print(f"\nx {len(failed)} failed:")
        for s in failed:
            print(f"  {s['id']}  [{dname(s)}] exit={s.get('exit_code')}  {s['title'] or ''}")

    if no_task:
        print(f"\n- {len(no_task)} active session(s) not tied to a task (goal alignment unknown):")
        for s in no_task:
            print(f"  {s['id']}  [{dname(s)}] {s['title'] or ''}")

    if unassigned:
        print(f"\n- {len(unassigned)} session(s) without a department (run: agentboard reassign / assign)")

    if not (stuck or failed or decisions):
        print("\nOK: nothing stuck, failed or waiting on the founder")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
