import { useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, type Session, type Stats, type AgentEvent } from "./api";
import LiveTerminal from "./Terminal";

const STATUS_COLORS: Record<string, string> = {
  starting: "#a0a0a0",
  running: "#3b82f6",
  waiting: "#eab308",
  done: "#22c55e",
  error: "#ef4444",
  cancelled: "#6b7280",
};

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="badge" style={{ background: STATUS_COLORS[status] || "#888" }}>
      {status}
    </span>
  );
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [tokenInput, setTokenInput] = useState(getToken());
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([api.listSessions(), api.stats()]);
      setSessions(s.sessions);
      setStats(st);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    api.events(selected).then((e) => setEvents(e.events)).catch(() => setEvents([]));
    const t = setInterval(
      () => api.events(selected).then((e) => setEvents(e.events)).catch(() => {}),
      4000,
    );
    return () => clearInterval(t);
  }, [selected]);

  const current = sessions.find((s) => s.id === selected) || null;

  const sendCmd = async (kind: string) => {
    if (!selected) return;
    let payload: Record<string, unknown> | undefined;
    if (kind === "message") {
      const text = prompt("Message to inject into the agent session:");
      if (!text) return;
      payload = { text };
    }
    try {
      await api.sendCommand(selected, kind, payload);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          AgentBoard <span className="muted">· coding agent monitor</span>
        </div>
        <div className="token">
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="API key"
          />
          <button
            onClick={() => {
              setToken(tokenInput);
              refresh();
            }}
          >
            Set key
          </button>
        </div>
      </header>

      {error && <div className="error">⚠ {error}</div>}

      <div className="stats">
        <div className="stat">
          <div className="stat-n">{stats?.total ?? 0}</div>
          <div className="stat-l">total</div>
        </div>
        {stats &&
          Object.entries(stats.status).map(([k, v]) => (
            <div className="stat" key={k}>
              <div className="stat-n" style={{ color: STATUS_COLORS[k] }}>
                {v}
              </div>
              <div className="stat-l">{k}</div>
            </div>
          ))}
      </div>

      <div className="main">
        <aside className="list">
          {sessions.length === 0 && <div className="empty">No sessions yet.</div>}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={"row" + (s.id === selected ? " active" : "")}
              onClick={() => setSelected(s.id)}
            >
              <div className="row-top">
                <StatusBadge status={s.status} />
                <span className="agent">{s.agent_type}</span>
                <span className="muted small">{ago(s.updated_at)} ago</span>
              </div>
              <div className="title">{s.title || s.id}</div>
              <div className="muted small">{s.cwd || ""}</div>
            </div>
          ))}
        </aside>

        <section className="detail">
          {!current && <div className="empty big">Select a session to inspect.</div>}
          {current && (
            <>
              <div className="detail-head">
                <div>
                  <div className="detail-title">
                    {current.title || current.id} <StatusBadge status={current.status} />
                  </div>
                  <div className="muted small">
                    {current.agent_type} · {current.host || "?"} · pid {current.pid ?? "?"} ·{" "}
                    {current.cwd || ""}
                    {current.exit_code != null && ` · exit ${current.exit_code}`}
                  </div>
                </div>
                <div className="controls">
                  <button onClick={() => sendCmd("message")}>Message</button>
                  <button onClick={() => sendCmd("pause")}>Pause</button>
                  <button onClick={() => sendCmd("resume")}>Resume</button>
                  <button className="danger" onClick={() => sendCmd("cancel")}>
                    Cancel
                  </button>
                </div>
              </div>

              <LiveTerminal key={current.id} sessionId={current.id} />

              <div className="events">
                <div className="events-head">Events</div>
                {events.map((e) => (
                  <div className={"event lvl-" + e.level} key={e.id}>
                    <span className="muted small">{new Date(e.ts).toLocaleTimeString()}</span>
                    <span className="etype">{e.type}</span>
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
