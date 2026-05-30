#!/usr/bin/env python3
"""triage.py — quick health summary of AgentBoard sessions.

Flags sessions that look stuck (running/waiting but stale) or failed. Reads
AGENTBOARD_URL / AGENTBOARD_KEY from the environment.

Usage:
    uv run python scripts/triage.py [--stale-min 10]
"""

from __future__ import annotations

import argparse
import sys
import time

try:
    from agentboard import AgentBoardClient
except ImportError:
    sys.exit("agentboard package not importable; run from the agent/ uv environment")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stale-min", type=float, default=10.0, help="staleness threshold (minutes)")
    args = ap.parse_args()

    c = AgentBoardClient()
    sessions = c.list_sessions()
    stats = c.stats()
    now = time.time() * 1000
    stale_ms = args.stale_min * 60_000

    print(f"total={stats['total']} " + " ".join(f"{k}={v}" for k, v in stats["status"].items()))

    stuck, failed = [], []
    for s in sessions:
        if s["status"] in ("running", "waiting") and (now - s["updated_at"]) > stale_ms:
            stuck.append(s)
        if s["status"] == "error":
            failed.append(s)

    if stuck:
        print(f"\n⚠ {len(stuck)} possibly stuck (no update > {args.stale_min}m):")
        for s in stuck:
            mins = int((now - s["updated_at"]) / 60000)
            print(f"  {s['id']}  {s['agent_type']:<12} {mins}m idle  {s['title'] or ''}")

    if failed:
        print(f"\n✖ {len(failed)} failed:")
        for s in failed:
            print(f"  {s['id']}  exit={s.get('exit_code')}  {s['title'] or ''}")

    if not stuck and not failed:
        print("\n✔ no stuck or failed sessions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
