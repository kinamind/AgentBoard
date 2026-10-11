import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type AgentRow, type Rule } from "../api";
import { useData } from "../store";
import { useI18n } from "../lib/i18n";
import { Card, Empty, PageHeader, StatusBadge } from "../components/ui";
import { ago, isActive } from "../lib/format";

export default function Departments({ onOpenSession }: { onOpenSession: (id: string) => void }) {
  const { departments, sessions, stats, refresh } = useData();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [ag, setAg] = useState({ name: "", agent_type: "", department: "", role: "" });
  const [rule, setRule] = useState({ department: "", match_field: "project", match_op: "eq", match_value: "" });

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([api.agents().catch(() => ({ agents: [] })), api.rules().catch(() => ({ rules: [] }))]);
    setAgents(a.agents);
    setRules(r.rules);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;
  const unassigned = stats?.by_department?.none ?? {};
  const unCount = Object.values(unassigned).reduce((a, b) => a + b, 0);

  const rows = useMemo(
    () =>
      sessions
        .filter((s) => (selected === "none" ? !s.department_id : s.department_id === selected))
        .sort((a, b) => b.updated_at - a.updated_at),
    [sessions, selected],
  );

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await Promise.all([refresh(), load()]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <>
      <PageHeader title={t("dep.title")} desc={t("dep.desc")} />

      <div className="dept-grid">
        {departments.map((d) => {
          const sc = d.status_counts;
          const active = (sc.running ?? 0) + (sc.waiting ?? 0) + (sc.starting ?? 0);
          const total = Object.values(sc).reduce((a, b) => a + b, 0);
          return (
            <button
              key={d.id}
              className={"dept-card" + (selected === d.id ? " active" : "")}
              style={{ ["--dc" as any]: d.color || "#9ca3af" }}
              onClick={() => setSelected(d.id)}
            >
              <div className="dept-card-top">
                <span className="dept-name">{d.name}</span>
                <span className="dept-slug">{d.slug}</span>
              </div>
              <div className="dept-desc">{d.description}</div>
              <div className="dept-stats">
                <span><b>{active}</b> {t("dep.active")}</span>
                <span><b>{total}</b> {t("dep.total")}</span>
                <span><b>{sc.error ?? 0}</b> {t("dep.failed")}</span>
                <span><b>{d.members}</b> {t("dep.members")}</span>
              </div>
            </button>
          );
        })}
        <button
          className={"dept-card muted-card" + (selected === "none" ? " active" : "")}
          style={{ ["--dc" as any]: "#9ca3af" }}
          onClick={() => setSelected("none")}
        >
          <div className="dept-card-top">
            <span className="dept-name">{t("common.unassigned")}</span>
          </div>
          <div className="dept-stats">
            <span><b>{unCount}</b> {t("dep.total")}</span>
          </div>
        </button>
      </div>

      <div className="grid-2">
        <Card title={selected ? (selected === "none" ? t("common.unassigned") : deptName(selected)) : t("dep.sessions")} flush>
          {!selected ? (
            <Empty title={t("dep.pick")} />
          ) : rows.length === 0 ? (
            <Empty title={t("dep.noSessions")} />
          ) : (
            <ul className="list-plain">
              {rows.map((s) => (
                <li key={s.id} onClick={() => onOpenSession(s.id)}>
                  <div>
                    <div className="li-title">{s.title || s.id}</div>
                    <div className="li-sub">
                      {s.agent_type} · {ago(s.updated_at)}
                      {isActive(s.status) ? " · live" : ""}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("dep.new")}>
          <div className="form-stack">
            <div className="form-row">
              <input placeholder={t("dep.name")} value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input placeholder={t("dep.slug")} value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
              <button
                className="btn btn-primary"
                disabled={!newName.trim()}
                onClick={() =>
                  act(async () => {
                    await api.createDepartment(newName.trim(), newSlug.trim() || undefined);
                    setNewName("");
                    setNewSlug("");
                  })
                }
              >
                {t("common.create")}
              </button>
            </div>
            {selected && selected !== "none" && (
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (!confirm(t("dep.confirmDelete"))) return;
                  act(async () => {
                    await api.deleteDepartment(selected);
                    setSelected(null);
                  });
                }}
              >
                {t("common.delete")} · {deptName(selected)}
              </button>
            )}
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title={t("dep.roster")}>
          <p className="hint">{t("dep.rosterDesc")}</p>
          {agents.length === 0 ? (
            <div className="dist-empty">{t("dep.rosterEmpty")}</div>
          ) : (
            <ul className="chip-list">
              {agents.map((a) => (
                <li key={a.id}>
                  <b>{a.name}</b>
                  <span className="chip">{a.agent_type}</span>
                  <span className="li-sub">{a.department_id ? deptName(a.department_id) : t("common.unassigned")}</span>
                  <button className="x" onClick={() => act(() => api.deleteAgent(a.id))}>×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="form-grid">
            <input placeholder={t("dep.agentName")} value={ag.name} onChange={(e) => setAg({ ...ag, name: e.target.value })} />
            <input placeholder={t("dep.agentType")} value={ag.agent_type} onChange={(e) => setAg({ ...ag, agent_type: e.target.value })} />
            <select value={ag.department} onChange={(e) => setAg({ ...ag, department: e.target.value })}>
              <option value="">{t("common.unassigned")}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input placeholder={t("dep.role")} value={ag.role} onChange={(e) => setAg({ ...ag, role: e.target.value })} />
            <button
              className="btn"
              disabled={!ag.name.trim() || !ag.agent_type.trim()}
              onClick={() =>
                act(async () => {
                  await api.createAgent({ name: ag.name.trim(), agent_type: ag.agent_type.trim(), department: ag.department || undefined, role: ag.role || undefined });
                  setAg({ name: "", agent_type: "", department: "", role: "" });
                })
              }
            >
              {t("common.add")}
            </button>
          </div>
        </Card>

        <Card
          title={t("dep.rules")}
          extra={
            <button
              className="btn"
              onClick={() =>
                act(async () => {
                  const r = await api.reassign(true);
                  setMsg(t("dep.reapplied", { n: r.changed, total: r.total }));
                })
              }
            >
              {t("dep.reapply")}
            </button>
          }
        >
          <p className="hint">{t("dep.rulesDesc")}</p>
          {msg && <div className="note-ok">{msg}</div>}
          {rules.length === 0 ? (
            <div className="dist-empty">{t("dep.rulesEmpty")}</div>
          ) : (
            <ul className="chip-list">
              {rules.map((r) => (
                <li key={r.id}>
                  <span className="chip">{r.match_field}</span>
                  <span className="li-sub">{r.match_op}</span>
                  <b>{r.match_value}</b>
                  <span className="li-sub">→ {deptName(r.department_id)}</span>
                  <button className="x" onClick={() => act(() => api.deleteRule(r.id))}>×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="form-grid">
            <select value={rule.match_field} onChange={(e) => setRule({ ...rule, match_field: e.target.value })}>
              {["project", "agent_type", "title", "cwd"].map((f) => <option key={f}>{f}</option>)}
            </select>
            <select value={rule.match_op} onChange={(e) => setRule({ ...rule, match_op: e.target.value })}>
              {["eq", "prefix", "contains", "regex"].map((f) => <option key={f}>{f}</option>)}
            </select>
            <input placeholder={t("dep.value")} value={rule.match_value} onChange={(e) => setRule({ ...rule, match_value: e.target.value })} />
            <select value={rule.department} onChange={(e) => setRule({ ...rule, department: e.target.value })}>
              <option value="">{t("ag.dept")}…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button
              className="btn"
              disabled={!rule.match_value.trim() || !rule.department}
              onClick={() =>
                act(async () => {
                  await api.createRule({ ...rule, match_value: rule.match_value.trim() });
                  setRule({ ...rule, match_value: "" });
                })
              }
            >
              {t("common.add")}
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
