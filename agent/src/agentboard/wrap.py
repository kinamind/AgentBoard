"""Run a child command and stream its output to AgentBoard.

Captures stdout/stderr, batches lines, reports lifecycle, and polls for management
commands (e.g. ``cancel`` terminates the child). Used by ``agentboard wrap``.
"""

from __future__ import annotations

import os
import queue
import selectors
import signal
import subprocess
import threading
import time
from typing import Sequence

from .client import AgentBoardClient


def run_wrapped(
    client: AgentBoardClient,
    command: Sequence[str],
    agent_type: str = "shell",
    title: str | None = None,
    project: str | None = None,
    flush_interval: float = 0.4,
    poll_interval: float = 2.0,
) -> int:
    """Run ``command``, streaming output to AgentBoard. Returns the exit code."""
    title = title or " ".join(command)
    client.start(agent_type=agent_type, title=title, project=project, status="running")

    proc = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=1,
        universal_newlines=True,
    )

    line_q: "queue.Queue[tuple[str, str]]" = queue.Queue()

    def reader(stream, name: str) -> None:
        for line in iter(stream.readline, ""):
            line_q.put((name, line.rstrip("\n")))
        stream.close()

    threads = [
        threading.Thread(target=reader, args=(proc.stdout, "stdout"), daemon=True),
        threading.Thread(target=reader, args=(proc.stderr, "stderr"), daemon=True),
    ]
    for t in threads:
        t.start()

    stop = threading.Event()

    def command_poller() -> None:
        while not stop.is_set():
            try:
                for cmd in client.poll_commands():
                    _apply_command(client, proc, cmd)
            except Exception:
                pass
            stop.wait(poll_interval)

    poller = threading.Thread(target=command_poller, daemon=True)
    poller.start()

    # Drain the line queue, batching by flush_interval.
    last_flush = time.time()
    pending: dict[str, list[str]] = {"stdout": [], "stderr": []}

    def flush() -> None:
        for stream, lines in pending.items():
            if lines:
                # Echo locally too, so the wrapped command still feels normal.
                for ln in lines:
                    (os.sys.stderr if stream == "stderr" else os.sys.stdout).write(ln + "\n")
                try:
                    client.log_lines(lines, stream=stream)
                except Exception:
                    pass
                pending[stream] = []

    while True:
        try:
            stream, line = line_q.get(timeout=flush_interval)
            pending[stream].append(line)
        except queue.Empty:
            pass
        if time.time() - last_flush >= flush_interval:
            flush()
            last_flush = time.time()
        if proc.poll() is not None and line_q.empty():
            break

    for t in threads:
        t.join(timeout=2)
    flush()
    stop.set()

    code = proc.wait()
    try:
        client.done(exit_code=code)
    except Exception:
        pass
    return code


def _apply_command(client: AgentBoardClient, proc: subprocess.Popen, cmd: dict) -> None:
    kind = cmd.get("kind")
    cid = cmd.get("id")
    result: dict = {}
    try:
        if kind == "cancel":
            proc.terminate()
            client.event("command", message="cancel received → terminating", level="warn")
            result = {"action": "terminated"}
        elif kind == "pause":
            if hasattr(signal, "SIGSTOP"):
                proc.send_signal(signal.SIGSTOP)
                result = {"action": "paused"}
        elif kind == "resume":
            if hasattr(signal, "SIGCONT"):
                proc.send_signal(signal.SIGCONT)
                result = {"action": "resumed"}
        elif kind == "message":
            text = (cmd.get("payload") or {}).get("text", "")
            client.event("note", message=f"controller: {text}")
            result = {"action": "noted"}
        else:
            result = {"action": "ignored", "kind": kind}
        if cid:
            client.ack_command(cid, status="done", result=result)
    except Exception as e:  # noqa: BLE001
        if cid:
            client.ack_command(cid, status="failed", result={"error": str(e)})


# selectors import kept for potential future non-threaded implementation.
_ = selectors
