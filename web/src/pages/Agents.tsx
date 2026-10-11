import { useEffect, useMemo, useState } from "react";
import { api, type AgentEvent, type Session } from "../api";
import { useData } from "../store";
import LiveTerminal from "../Terminal";
import { Card, Empty, PageHeader, StatusBadge } from "../components/ui";
import { ago, duration, STATUS_ORDER } from "../lib/format";

const FILTERS = ["all", "active", "error", "done"] as const;
type Filter = (typeof FILTERS)[number];

function matches(s: Session, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "active") return s.status === "running" || s.status === "waiting" || s.status === "starting";
  return s.status === f;
}

export default function Agents({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const { sessions } = useData();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sessions
      .filter((s) => matches(s, filter))
      .filter((s) => !needle || `${s.title ?? ""} ${s.agent_type} ${s.cwd ?? ""} ${s.id}`.toLowerCase().includes(needle))
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.updated_at - a.updated_at);
  }, [sessions, filter, q]);

  const current = sessions.find((s) => s.id === selected) || null;

  return (
    <>
      <PageHeader title="Agents & Sessions" desc="Inspect live terminals and control running agents." />
      <div className="split">
        <Card
          flush
          title="Sessions"
          extra={<span className="count">{rows.length}</span>}
        >
          <div className="toolbar">
            <input className="search" placeholder="Search title, agent, path…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="seg">
              {FILTERS.map((f) => (
                <button key={f} className={f === filter ? "on" : ""} onClick={() => setFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="session-list">
            {rows.length === 0 && <Empty title="No matching sessions" />}
            {rows.map((s) => (
              <div key={s.id} className={"srow" + (s.id === selected ? " active" : "")} onClick={() => onSelect(s.id)}>
                <div className="srow-top">
                  <span className="srow-title">{s.title || s.id}</span>
                  <span className="srow-time">{ago(s.updated_at)}</span>
                </div>
                <div className="srow-meta">
                  <StatusBadge status={s.status} />
                  <span className="chip">{s.agent_type}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="detail-col">{current ? <SessionDetail session={current} /> : <Card><Empty title="Select a session" desc="Pick one on the left to see its live terminal, events and controls." /></Card>}</div>
      </div>
    </>
  );
}

function SessionDetail({ session }: { session: Session }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const id = session.id;

  useEffect(() => {
    const load = () => api.events(id).then((e) => setEvents(e.events)).catch(() => setEvents([]));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [id]);

  const send = async (kind: string) => {
    let payload: Record<string, unknown> | undefined;
    if (kind === "message") {
      const text = prompt("Message to send to this agent:");
      if (!text) return;
      payload = { text };
    } else if (kind === "cancel" && !confirm("Cancel this session?")) return;
    try {
      await api.sendCommand(id, kind, payload);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const live = session.status === "running" || session.status === "waiting" || session.status === "starting";

  return (
    <>
      <div className="card detail-head">
        <div>
          <div className="detail-title">
            {session.title || session.id} <StatusBadge status={session.status} />
          </div>
          <dl className="meta">
            <div><dt>Agent</dt><dd>{session.agent_type}</dd></div>
            <div><dt>Host</dt><dd>{session.host || "—"}</dd></div>
            <div><dt>PID</dt><dd>{session.pid ?? "—"}</dd></div>
            <div><dt>Duration</dt><dd>{duration(session.started_at, session.ended_at)}</dd></div>
            {session.exit_code != null && <div><dt>Exit</dt><dd>{session.exit_code}</dd></div>}
            {session.cwd && <div className="wide"><dt>Path</dt><dd>{session.cwd}</dd></div>}
          </dl>
        </div>
        <div className="controls">
          <button className="btn" onClick={() => send("message")}>Message</button>
          <button className="btn" disabled={!live} onClick={() => send("pause")}>Pause</button>
          <button className="btn" disabled={!live} onClick={() => send("resume")}>Resume</button>
          <button className="btn btn-danger" disabled={!live} onClick={() => send("cancel")}>Cancel</button>
        </div>
      </div>

      <div className="terminal-wrap">
        <div className="terminal-bar">
          <span className="terminal-title">Terminal</span>
          <span className="terminal-id">{session.id}</span>
        </div>
        <LiveTerminal key={id} sessionId={id} />
      </div>

      <Card title="Events" flush>
        <div className="events-body">
          {events.length === 0 && <Empty title="No events yet" />}
          {events.map((e) => (
            <div className={"event lvl-" + e.level} key={e.id}>
              <span className="event-time">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className="etype">{e.type}</span>
              <span>{e.message}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
