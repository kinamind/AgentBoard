import { useData } from "../store";
import { useI18n } from "../lib/i18n";
import { Card, DistributionBar, Empty, KpiCard, PageHeader, StatusBadge } from "../components/ui";
import { api } from "../api";
import { ago, isActive, isStale, STATUS_COLORS } from "../lib/format";

export default function Overview({ onOpen }: { onOpen: (id: string) => void }) {
  const { sessions, stats, loaded, departments, decisions, refresh } = useData();
  const { t } = useI18n();
  const active = sessions.filter((s) => isActive(s.status));
  const errors = sessions.filter((s) => s.status === "error");
  const stale = sessions.filter((s) => isStale(s));
  const attention = [...errors, ...stale.filter((s) => !errors.includes(s))];
  const done = stats?.status.done ?? 0;
  const finished = done + (stats?.status.error ?? 0) + (stats?.status.cancelled ?? 0);
  const successRate = finished ? Math.round((done / finished) * 100) : null;

  return (
    <>
      <PageHeader title={t("ov.title")} desc={t("ov.desc")} />

      <div className="kpi-grid">
        <KpiCard label={t("ov.active")} value={active.length} hint={t("ov.activeHint")} color={STATUS_COLORS.running} />
        <KpiCard label={t("ov.total")} value={stats?.total ?? 0} hint={t("ov.totalHint", { n: Object.keys(stats?.agents ?? {}).length })} />
        <KpiCard label={t("ov.success")} value={successRate == null ? "—" : `${successRate}%`} hint={t("ov.successHint")} color={STATUS_COLORS.done} />
        <KpiCard
          label={t("ov.attention")}
          value={attention.length}
          hint={t("ov.attentionHint")}
          color={attention.length ? STATUS_COLORS.error : undefined}
        />
      </div>

      <Card title={t("ov.byDept")} flush>
        <table className="table">
          <thead>
            <tr>
              <th>{t("ov.deptName")}</th>
              <th className="num">{t("ov.deptActive")}</th>
              <th className="num">{t("ov.deptTotal")}</th>
              <th className="num">{t("ov.deptFailed")}</th>
              <th>{t("ov.success")}</th>
            </tr>
          </thead>
          <tbody>
            {[...departments.map((d) => ({ id: d.id, name: d.name, color: d.color, sc: stats?.by_department?.[d.id] ?? {} })),
              { id: "none", name: t("common.unassigned"), color: "#9ca3af", sc: stats?.by_department?.none ?? {} }]
              .filter((r) => r.id !== "none" || Object.keys(r.sc).length)
              .map((r) => {
                const total = Object.values(r.sc).reduce((a, b) => a + b, 0);
                const act = (r.sc.running ?? 0) + (r.sc.waiting ?? 0) + (r.sc.starting ?? 0);
                const fin = (r.sc.done ?? 0) + (r.sc.error ?? 0) + (r.sc.cancelled ?? 0);
                const rate = fin ? Math.round(((r.sc.done ?? 0) / fin) * 100) : null;
                return (
                  <tr key={r.id}>
                    <td><span className="dot" style={{ background: r.color || "#9ca3af" }} />{r.name}</td>
                    <td className="num">{act}</td>
                    <td className="num">{total}</td>
                    <td className="num">{r.sc.error ?? 0}</td>
                    <td>{rate == null ? "—" : `${rate}%`}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Card>

      <div className="spacer" />

      <div className="grid-2">
        <Card title={t("ov.dist")}>
          <DistributionBar data={stats?.status ?? {}} />
        </Card>
        <Card title={t("ov.types")}>
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
            <div className="dist-empty">{t("common.noData")}</div>
          )}
        </Card>
      </div>

      <Card title={`${t("ov.decisions")} (${decisions.length})`} flush>
        {decisions.length === 0 ? (
          <Empty title={t("ov.noDecisions")} />
        ) : (
          <ul className="list-plain static">
            {decisions.map((d) => (
              <li key={d.id}>
                <div className="decision">
                  <div className="li-title">{d.question}</div>
                  <div className="decision-actions">
                    {d.options.map((o) => (
                      <button key={o} className="btn" onClick={async () => { await api.answerDecision(d.id, o); refresh(); }}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="spacer" />

      <div className="grid-2">
        <Card title={t("ov.needs")} flush>
          {attention.length === 0 ? (
            <Empty title={t("ov.allClear")} desc={t("ov.allClearDesc")} />
          ) : (
            <ul className="list-plain">
              {attention.map((s) => (
                <li key={s.id} onClick={() => onOpen(s.id)}>
                  <div>
                    <div className="li-title">{s.title || s.id}</div>
                    <div className="li-sub">
                      {s.agent_type} · {s.status === "error" ? t("ov.exit", { code: s.exit_code ?? "?" }) : t("ov.silent", { t: ago(s.updated_at) })}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t("ov.recent")} flush>
          {!loaded ? (
            <Empty title={t("common.loading")} />
          ) : sessions.length === 0 ? (
            <Empty title={t("ov.noSessions")} desc={t("ov.noSessionsDesc")} />
          ) : (
            <ul className="list-plain">
              {sessions.slice(0, 6).map((s) => (
                <li key={s.id} onClick={() => onOpen(s.id)}>
                  <div>
                    <div className="li-title">{s.title || s.id}</div>
                    <div className="li-sub">
                      {s.agent_type} · {t("ov.ago", { t: ago(s.updated_at) })}
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
