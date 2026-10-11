import { useData } from "../store";
import { Card, DistributionBar, Empty, KpiCard, PageHeader, StatusBadge } from "../components/ui";
import { ago, isActive, isStale, STATUS_COLORS } from "../lib/format";

export default function Overview({ onOpen }: { onOpen: (id: string) => void }) {
  const { sessions, stats, loaded } = useData();
  const active = sessions.filter((s) => isActive(s.status));
  const errors = sessions.filter((s) => s.status === "error");
  const stale = sessions.filter((s) => isStale(s));
  const attention = [...errors, ...stale.filter((s) => !errors.includes(s))];
  const done = stats?.status.done ?? 0;
  const finished = done + (stats?.status.error ?? 0) + (stats?.status.cancelled ?? 0);
  const successRate = finished ? Math.round((done / finished) * 100) : null;

  return (
    <>
      <PageHeader title="Overview" desc="Real-time health of every agent running in your company." />

      <div className="kpi-grid">
        <KpiCard label="Active agents" value={active.length} hint="running · waiting · starting" color={STATUS_COLORS.running} />
        <KpiCard label="Total sessions" value={stats?.total ?? 0} hint={`${Object.keys(stats?.agents ?? {}).length} agent types`} />
        <KpiCard label="Success rate" value={successRate == null ? "—" : `${successRate}%`} hint="of finished sessions" color={STATUS_COLORS.done} />
        <KpiCard
          label="Needs attention"
          value={attention.length}
          hint="failed or stalled > 10m"
          color={attention.length ? STATUS_COLORS.error : undefined}
        />
      </div>

      <div className="grid-2">
        <Card title="Status distribution">
          <DistributionBar data={stats?.status ?? {}} />
        </Card>
        <Card title="Agent types">
          {stats && Object.keys(stats.agents).length ? (
            <div className="bar-list">
              {Object.entries(stats.agents)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div className="bar-row" key={k}>
                    <span className="bar-name">{k}</span>
                    <span className="bar-track">
                      <span style={{ width: `${(v / stats.total) * 100}%` }} />
                    </span>
                    <b>{v}</b>
                  </div>
                ))}
            </div>
          ) : (
            <div className="dist-empty">No data</div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Needs attention" flush>
          {attention.length === 0 ? (
            <Empty title="All clear" desc="No failed or stalled sessions." />
          ) : (
            <ul className="list-plain">
              {attention.map((s) => (
                <li key={s.id} onClick={() => onOpen(s.id)}>
                  <div>
                    <div className="li-title">{s.title || s.id}</div>
                    <div className="li-sub">
                      {s.agent_type} · {s.status === "error" ? `exit ${s.exit_code ?? "?"}` : `silent ${ago(s.updated_at)}`}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent activity" flush>
          {!loaded ? (
            <Empty title="Loading…" />
          ) : sessions.length === 0 ? (
            <Empty title="No sessions yet" desc="Run `agentboard wrap -- <cmd>` to report your first agent." />
          ) : (
            <ul className="list-plain">
              {sessions.slice(0, 6).map((s) => (
                <li key={s.id} onClick={() => onOpen(s.id)}>
                  <div>
                    <div className="li-title">{s.title || s.id}</div>
                    <div className="li-sub">
                      {s.agent_type} · {ago(s.updated_at)} ago
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
