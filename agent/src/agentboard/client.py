"""HTTP-push client for AgentBoard. Standard library only (urllib).

Configuration is read from arguments or environment variables:
    AGENTBOARD_URL    base URL of the server, e.g. http://127.0.0.1:8788
    AGENTBOARD_KEY    API key (Bearer token)

Typical use::

    client = AgentBoardClient()
    sid = client.start(agent_type="claude-code", title="refactor auth", project="myapp")
    client.log("running tests...\\n")
    client.status("running")
    client.done(exit_code=0)
"""

from __future__ import annotations

import json
import os
import socket
import time
import urllib.error
import urllib.request
from typing import Any, Iterable


class AgentBoardError(RuntimeError):
    pass


class AgentBoardClient:
    def __init__(
        self,
        url: str | None = None,
        key: str | None = None,
        session_id: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.url = (url or os.environ.get("AGENTBOARD_URL") or "http://127.0.0.1:8788").rstrip("/")
        self.key = key or os.environ.get("AGENTBOARD_KEY") or "dev-local-key"
        self.session_id = session_id or os.environ.get("AGENTBOARD_SESSION")
        self.timeout = timeout

    # --- low-level -------------------------------------------------------
    def _request(self, method: str, path: str, body: Any | None = None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            f"{self.url}/api/v1{path}",
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                # A non-default UA: Cloudflare's edge blocks the stock
                # "Python-urllib/x.y" signature with HTTP 403 (error 1010).
                "User-Agent": "agentboard-client/0.1",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            raise AgentBoardError(f"{method} {path} -> {e.code}: {detail}") from e
        except urllib.error.URLError as e:
            raise AgentBoardError(f"{method} {path} failed: {e.reason}") from e

    # --- lifecycle -------------------------------------------------------
    def start(
        self,
        agent_type: str = "unknown",
        title: str | None = None,
        project: str | None = None,
        cwd: str | None = None,
        host: str | None = None,
        pid: int | None = None,
        meta: dict | None = None,
        status: str = "running",
        department: str | None = None,
        task_id: str | None = None,
        tags: list[str] | None = None,
    ) -> str:
        # Department/task fall back to env so wrappers and skills can set them once.
        department = department or os.environ.get("AGENTBOARD_DEPARTMENT") or None
        task_id = task_id or os.environ.get("AGENTBOARD_TASK") or None
        body = {
            "agent_type": agent_type,
            "title": title,
            "project": project,
            "cwd": cwd if cwd is not None else os.getcwd(),
            "host": host if host is not None else socket.gethostname(),
            "pid": pid if pid is not None else os.getpid(),
            "meta": meta,
            "status": status,
            "department": department,
            "task_id": task_id,
            "tags": tags,
        }
        res = self._request("POST", "/sessions", body)
        self.session_id = res["id"]
        return self.session_id

    def status(self, status: str, exit_code: int | None = None) -> None:
        self._require()
        body: dict[str, Any] = {"status": status}
        if exit_code is not None:
            body["exit_code"] = exit_code
        self._request("PATCH", f"/sessions/{self.session_id}", body)

    def done(self, exit_code: int = 0) -> None:
        self.status("done" if exit_code == 0 else "error", exit_code=exit_code)

    def fail(self, message: str | None = None, exit_code: int = 1) -> None:
        if message:
            self.event("error", message=message, level="error")
        self.status("error", exit_code=exit_code)

    def event(
        self,
        type: str = "note",
        message: str | None = None,
        level: str = "info",
        data: dict | None = None,
    ) -> None:
        self._require()
        self._request(
            "POST",
            f"/sessions/{self.session_id}/events",
            {"type": type, "message": message, "level": level, "data": data},
        )

    def heartbeat(self) -> None:
        self._require()
        self._request("POST", f"/sessions/{self.session_id}/heartbeat", {})

    # --- logs ------------------------------------------------------------
    def log(self, content: str, stream: str = "stdout") -> None:
        self.log_lines([content], stream=stream)

    def log_lines(self, lines: Iterable[str], stream: str = "stdout") -> None:
        self._require()
        payload = [{"content": c, "stream": stream} for c in lines]
        if not payload:
            return
        self._request("POST", f"/sessions/{self.session_id}/logs", {"lines": payload})

    # --- monitoring / management ----------------------------------------
    def list_sessions(self, **filters: str) -> list[dict]:
        q = "&".join(f"{k}={v}" for k, v in filters.items() if v)
        path = "/sessions" + (f"?{q}" if q else "")
        return self._request("GET", path)["sessions"]

    def get_session(self, session_id: str | None = None) -> dict:
        sid = session_id or self.session_id
        return self._request("GET", f"/sessions/{sid}")["session"]

    def get_logs(self, session_id: str | None = None, after: int = 0) -> list[dict]:
        sid = session_id or self.session_id
        return self._request("GET", f"/sessions/{sid}/logs?after={after}")["lines"]

    def get_events(self, session_id: str | None = None) -> list[dict]:
        sid = session_id or self.session_id
        return self._request("GET", f"/sessions/{sid}/events")["events"]

    def stats(self) -> dict:
        return self._request("GET", "/stats")

    def send_command(self, session_id: str, kind: str, payload: dict | None = None) -> dict:
        return self._request(
            "POST", f"/sessions/{session_id}/commands", {"kind": kind, "payload": payload}
        )

    def poll_commands(self, session_id: str | None = None) -> list[dict]:
        sid = session_id or self.session_id
        return self._request("GET", f"/sessions/{sid}/commands")["commands"]

    def ack_command(
        self, command_id: str, status: str = "done", result: dict | None = None
    ) -> None:
        self._require()
        self._request(
            "POST",
            f"/sessions/{self.session_id}/commands/{command_id}/ack",
            {"status": status, "result": result},
        )

    # --- organization (departments / assignment) -------------------------
    def departments(self) -> dict:
        return self._request("GET", "/departments")

    def create_department(self, name: str, slug: str | None = None, description: str | None = None) -> dict:
        return self._request("POST", "/departments", {"name": name, "slug": slug, "description": description})

    def assign(self, session_id: str, department: str | None) -> None:
        self._request("PATCH", f"/sessions/{session_id}", {"department": department})

    def reassign(self, only_unassigned: bool = True) -> dict:
        return self._request("POST", "/sessions/reassign", {"only_unassigned": only_unassigned})

    def add_rule(self, department: str, field: str, value: str, op: str = "eq", priority: int = 100) -> dict:
        return self._request(
            "POST",
            "/assignment-rules",
            {"department": department, "match_field": field, "match_op": op, "match_value": value, "priority": priority},
        )

    def roster(self) -> list[dict]:
        return self._request("GET", "/agents")["agents"]

    def add_agent(self, name: str, agent_type: str, department: str | None = None, role: str | None = None) -> dict:
        return self._request("POST", "/agents", {"name": name, "agent_type": agent_type, "department": department, "role": role})

    # --- goals / tasks ----------------------------------------------------
    def goals(self) -> list[dict]:
        return self._request("GET", "/goals")["goals"]

    def create_goal(self, title: str, parent_id: str | None = None, outcome: dict | None = None, level: str | None = None) -> dict:
        return self._request("POST", "/goals", {"title": title, "parent_id": parent_id, "outcome": outcome, "level": level})

    def tasks(self, **filters: str) -> list[dict]:
        q = "&".join(f"{k}={v}" for k, v in filters.items() if v)
        return self._request("GET", "/tasks" + (f"?{q}" if q else ""))["tasks"]

    def create_task(self, title: str, goal_id: str | None = None, department: str | None = None,
                    description: str | None = None, depends_on: list[str] | None = None) -> dict:
        return self._request(
            "POST",
            "/tasks",
            {"title": title, "goal_id": goal_id, "department": department, "description": description, "depends_on": depends_on},
        )

    def claim_task(self, agent: str | None = None, department: str | None = None, lease_seconds: int = 900) -> dict | None:
        return self._request(
            "POST", "/tasks/claim", {"agent": agent, "department": department, "lease_seconds": lease_seconds}
        )["task"]

    def update_task(self, task_id: str, **fields: Any) -> None:
        self._request("PATCH", f"/tasks/{task_id}", fields)

    def task_heartbeat(self, task_id: str, lease_seconds: int = 900) -> dict:
        return self._request("POST", f"/tasks/{task_id}/heartbeat", {"lease_seconds": lease_seconds})

    # --- decisions inbox ---------------------------------------------------
    def ask_decision(self, question: str, options: list[str] | None = None, session_id: str | None = None,
                     task_id: str | None = None) -> dict:
        return self._request(
            "POST",
            "/decisions",
            {"question": question, "options": options, "session_id": session_id or self.session_id, "task_id": task_id},
        )

    def decisions(self, status: str | None = "pending") -> list[dict]:
        return self._request("GET", "/decisions" + (f"?status={status}" if status else ""))["decisions"]

    def answer_decision(self, decision_id: str, answer: str) -> None:
        self._request("POST", f"/decisions/{decision_id}/answer", {"answer": answer})

    # --- insights ------------------------------------------------------------
    def insights_context(self, scope: str = "company", scope_id: str | None = None) -> dict:
        q = f"?scope={scope}" + (f"&id={scope_id}" if scope_id else "")
        return self._request("GET", "/insights/context" + q)

    def post_analysis(self, framework: str, target_type: str, result: dict, target_id: str | None = None,
                      analyzer: str = "external:agent") -> dict:
        return self._request(
            "POST",
            "/analyses",
            {"framework": framework, "target_type": target_type, "target_id": target_id, "result": result, "analyzer": analyzer},
        )

    def analyses(self, **filters: str) -> list[dict]:
        q = "&".join(f"{k}={v}" for k, v in filters.items() if v)
        return self._request("GET", "/analyses" + (f"?{q}" if q else ""))["analyses"]

    def migrate(self) -> dict:
        return self._request("POST", "/admin/migrate", {})

    # --- helpers ---------------------------------------------------------
    def _require(self) -> None:
        if not self.session_id:
            raise AgentBoardError("no session_id set; call start() first or pass AGENTBOARD_SESSION")


def now_ms() -> int:
    return int(time.time() * 1000)
