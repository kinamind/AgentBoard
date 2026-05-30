import { useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, type Session, type Stats, type AgentEvent } from "./api";
import LiveTerminal from "./Terminal";

const STATUS_COLORS: Record<string, string> = {
  starting: "#94a3b8",
  running: "#3b82f6",
  waiting: "#f59e0b",
  done: "#10b981",
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
    <span className={`badge badge-${status}`}>
      <i className="badge-dot" />
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
          <div className="logo" />
          <div>
            <div className="brand-name">AgentBoard</div>
            <div className="brand-sub">coding agent monitor</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="token">
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="API key"
              spellCheck={false}
            />
            <button
              className="btn-primary"
              onClick={() => {
                setToken(tokenInput);
                refresh();
              }}
            >
              Set key
            </button>
          </div>
        </div>
      </header>

      {error && <div className="error">⚠ {error}</div>}

      <div className="stats">
        <div className="pill">
          <span className="pill-dot" style={{ background: "var(--accent)" }} />
          <span className="pill-text">
            <span className="pill-n">{stats?.total ?? 0}</span>
            <span className="pill-l">total</span>
          </span>
        </div>
        {stats &&
          Object.entries(stats.status).map(([k, v]) => (
            <div className="pill" key={k}>
              <span className="pill-dot" style={{ background: STATUS_COLORS[k] || "#888" }} />
              <span className="pill-text">
                <span className="pill-n">{v}</span>
                <span className="pill-l">{k}</span>
              </span>
            </div>
          ))}
      </div>

      <div className="main">
        <aside className="sidebar">
          <div className="sidebar-head">
            <span>Sessions</span>
            <span className="count">{sessions.length}</span>
          </div>
          <div className="list">
            {sessions.length === 0 && <div className="empty">No sessions yet.</div>}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={"row" + (s.id === selected ? " active" : "")}
                onClick={() => setSelected(s.id)}
              >
                <div className="row-top">
                  <span className="row-title">{s.title || s.id}</span>
                  <span className="row-time">{ago(s.updated_at)}</span>
                </div>
                <div className="row-meta">
                  <StatusBadge status={s.status} />
                  <span className="agent">{s.agent_type}</span>
                </div>
                {s.cwd && <div className="row-cwd">{s.cwd}</div>}
              </div>
            ))}
          </div>
        </aside>

        <section className="detail">
          {!current && (
            <div className="empty big">
              <div className="empty-icon">◎</div>
              Select a session to inspect its live terminal and events.
            </div>
          )}
          {current && (
            <>
              <div className="detail-head">
                <div>
                  <div className="detail-title">
                    {current.title || current.id} <StatusBadge status={current.status} />
                  </div>
                  <div className="detail-meta">
                    <span>agent <b>{current.agent_type}</b></span>
                    <span>host <b>{current.host || "?"}</b></span>
                    <span>pid <b>{current.pid ?? "?"}</b></span>
                    {current.cwd && <span>cwd <b>{current.cwd}</b></span>}
                    {current.exit_code != null && <span>exit <b>{current.exit_code}</b></span>}
                  </div>
                </div>
                <div className="controls">
                  <button onClick={() => sendCmd("message")}>Message</button>
                  <button onClick={() => sendCmd("pause")}>Pause</button>
                  <button onClick={() => sendCmd("resume")}>Resume</button>
                  <button className="btn-danger" onClick={() => sendCmd("cancel")}>
                    Cancel
                  </button>
                </div>
              </div>

              <div className="terminal-wrap">
                <div className="terminal-bar">
                  <span className="tdot r" />
                  <span className="tdot y" />
                  <span className="tdot g" />
                  <span className="terminal-bar-label">live terminal · {current.id}</span>
                </div>
                <LiveTerminal key={current.id} sessionId={current.id} />
              </div>

              <div className="events">
                <div className="events-head">Events</div>
                <div className="events-body">
                  {events.length === 0 && <div className="empty">No events yet.</div>}
                  {events.map((e) => (
                    <div className={"event lvl-" + e.level} key={e.id}>
                      <span className="event-time">
                        {new Date(e.ts).toLocaleTimeString()}
                      </span>
                      <span className="etype">{e.type}</span>
                      <span className="event-msg">{e.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
