#!/usr/bin/env python3
"""pack.py - turn an AgentBoard insights context into a ready-to-use analysis prompt.

Usage:
    python scripts/pack.py context.json --framework meta_model \
        --target-type goal --target-id g_xxx

It prints a prompt (framework instructions + the relevant slice of the context) that you
feed to your LLM; the model's JSON answer is then posted with `agentboard insights post`.
Standard library only.
"""

from __future__ import annotations

import argparse
import json
import sys


def pick(ctx: dict, ttype: str, tid: str | None) -> dict:
    """Return the slice of the context relevant to the target."""
    if ttype == "goal" and tid:
        ids = {tid}
        for _ in range(5):
            ids |= {g["id"] for g in ctx["goals"] if g.get("parent_id") in ids}
        return {
            "goals": [g for g in ctx["goals"] if g["id"] in ids],
            "tasks": [t for t in ctx["tasks"] if t.get("goal_id") in ids],
            "sessions": [s for s in ctx["sessions"] if s.get("task_id") in {t["id"] for t in ctx["tasks"] if t.get("goal_id") in ids}],
        }
    if ttype == "task" and tid:
        task = next((t for t in ctx["tasks"] if t["id"] == tid), None)
        goal = next((g for g in ctx["goals"] if task and g["id"] == task.get("goal_id")), None)
        return {
            "task": task,
            "goal": goal,
            "sessions": [s for s in ctx["sessions"] if s.get("task_id") == tid],
        }
    if ttype == "session" and tid:
        s = next((x for x in ctx["sessions"] if x["id"] == tid), None)
        t = next((x for x in ctx["tasks"] if s and x["id"] == s.get("task_id")), None)
        return {"session": s, "task": t, "now": ctx["generated_at"]}
    return {k: ctx[k] for k in ("goals", "tasks", "departments", "sessions", "pending_decisions", "signals")}


def main() -> int:
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("context", help="context.json from `agentboard insights context`")
    ap.add_argument("--framework", required=True)
    ap.add_argument("--target-type", default="company")
    ap.add_argument("--target-id")
    args = ap.parse_args()

    ctx = json.load(open(args.context, encoding="utf-8"))
    fw = next((f for f in ctx["frameworks"] if f["id"] == args.framework), None)
    if not fw:
        sys.exit(f"unknown framework {args.framework}; available: {[f['id'] for f in ctx['frameworks']]}")

    data = pick(ctx, args.target_type, args.target_id)
    print(f"# Framework: {fw['name']}\n")
    print(fw["prompt"])
    print(f"\n# Target: {args.target_type} {args.target_id or '(whole scope)'}")
    print("# Context (cite ids from this data only)\n")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    print("\n# Answer with the JSON object only.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
