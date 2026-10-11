import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Goal, type Task } from "../api";
import { useData } from "../store";
import { useI18n, type Key } from "../lib/i18n";
import { Card, Empty, PageHeader } from "../components/ui";
import { DeptChip } from "../components/DeptChip";

const COLS: { id: string; statuses: string[]; key: Key }[] = [
  { id: "todo", statuses: ["todo"], key: "goal.col.todo" },
  { id: "running", statuses: ["claimed", "running"], key: "goal.col.running" },
  { id: "blocked", statuses: ["blocked"], key: "goal.col.blocked" },
  { id: "review", statuses: ["review"], key: "goal.col.review" },
  { id: "done", statuses: ["done"], key: "goal.col.done" },
];

export default function Goals() {
  const { departments, decisions, refresh } = useData();
  const { t } = useI18n();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [task, setTask] = useState({ title: "", goal_id: "", department: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [g, tk] = await Promise.all([api.goals(), api.tasks()]);
      setGoals(g.goals);
      setTasks(tk.tasks);
    } catch {
      /* surfaced by global banner */
    }
  }, []);
  useEffect(() => {
    load();
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await Promise.all([load(), refresh()]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const ordered = useMemo(() => {
    const out: { g: Goal; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const g of goals.filter((x) => x.parent_id === parent)) {
        out.push({ g, depth });
        walk(g.id, depth + 1);
      }
    };
    walk(null, 0);
    // goals whose parent no longer exists
    for (const g of goals) if (g.parent_id && !goalById.has(g.parent_id)) out.push({ g, depth: 0 });
    return out;
  }, [goals, goalById]);

  const moveTargets = ["todo", "running", "blocked", "review", "done", "cancelled"];

  return (
    <>
      <PageHeader title={t("goal.title")} desc={t("goal.desc")} />

      <Card title={`${t("goal.decisions")} (${decisions.length})`} flush>
        {decisions.length === 0 ? (
          <Empty title={t("goal.noDecisions")} />
        ) : (
          <ul className="list-plain static">
            {decisions.map((d) => (
              <li key={d.id}>
                <div className="decision">
                  <div className="li-title">{d.question}</div>
                  <div className="decision-actions">
                    {d.options.map((o) => (
                      <button key={o} className="btn" onClick={() => act(() => api.answerDecision(d.id, o))}>
                        {o}
                      </button>
                    ))}
                    <input
                      placeholder={t("goal.customAnswer")}
                      value={answers[d.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [d.id]: e.target.value })}
                    />
                    <button
                      className="btn btn-primary"
                      disabled={!(answers[d.id] || "").trim()}
                      onClick={() => act(() => api.answerDecision(d.id, answers[d.id].trim()))}
                    >
                      {t("goal.send")}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="spacer" />

      <div className="grid-2">
        <Card title={t("goal.goals")} flush>
          {ordered.length === 0 ? (
            <Empty title={t("goal.noGoals")} />
          ) : (
            <ul className="list-plain static">
              {ordered.map(({ g, depth }) => {
                const total = Object.values(g.task_counts).reduce((a, b) => a + b, 0);
                const done = g.task_counts.done ?? 0;
                return (
                  <li key={g.id} style={{ paddingLeft: 18 + depth * 20 }}>
                    <div style={{ flex: 1 }}>
                      <div className="li-title">{g.title}</div>
                      <div className="li-sub">
                        {t(`goal.status.${g.status}` as Key)} · {t("goal.tasksCount", { n: total })}
                        {total > 0 && ` · ${done}/${total}`}
                      </div>
                      {total > 0 && (
                        <div className="mini-bar"><span style={{ width: `${(done / total) * 100}%` }} /></div>
                      )}
                    </div>
                    {g.status === "active" && (
                      <button className="btn" onClick={() => act(() => api.updateGoal(g.id, { status: "achieved" }))}>
                        {t("goal.achieve")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={t("goal.newGoal")}>
          <div className="form-row">
            <input placeholder={t("goal.goalTitle")} value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
            <button
              className="btn btn-primary"
              disabled={!goalTitle.trim()}
              onClick={() => act(async () => { await api.createGoal(goalTitle.trim()); setGoalTitle(""); })}
            >
              {t("common.create")}
            </button>
          </div>
          <div className="spacer" />
          <div className="card-subtitle">{t("goal.newTask")}</div>
          <div className="form-stack">
            <input placeholder={t("goal.taskTitle")} value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
            <div className="form-row">
              <select value={task.goal_id} onChange={(e) => setTask({ ...task, goal_id: e.target.value })}>
                <option value="">{t("goal.noGoal")}</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <select value={task.department} onChange={(e) => setTask({ ...task, department: e.target.value })}>
                <option value="">{t("common.unassigned")}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button
                className="btn btn-primary"
                disabled={!task.title.trim()}
                onClick={() =>
                  act(async () => {
                    await api.createTask({ title: task.title.trim(), goal_id: task.goal_id || undefined, department: task.department || undefined });
                    setTask({ title: "", goal_id: "", department: "" });
                  })
                }
              >
                {t("common.create")}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="spacer" />
      <div className="card-subtitle big">{t("goal.board")}</div>
      <div className="kanban">
        {COLS.map((c) => {
          const items = tasks.filter((x) => c.statuses.includes(x.status));
          return (
            <div className="kcol" key={c.id}>
              <div className="kcol-head">
                {t(c.key)} <span className="count">{items.length}</span>
              </div>
              {items.map((x) => (
                <div className="kcard" key={x.id}>
                  <div className="kcard-title">{x.title}</div>
                  <div className="kcard-meta">
                    <DeptChip id={x.department_id} />
                    {x.goal_id && goalById.get(x.goal_id) && <span className="chip">{goalById.get(x.goal_id)!.title}</span>}
                  </div>
                  <div className="li-sub">
                    {x.status === "todo" && (x.ready ? t("goal.ready") : t("goal.waiting"))}
                    {x.claimed_by && ` ${t("goal.claimedBy", { who: x.claimed_by })}`}
                  </div>
                  <select
                    value=""
                    onChange={(e) => e.target.value && act(() => api.updateTask(x.id, { status: e.target.value === "running" ? "running" : e.target.value }))}
                  >
                    <option value="">{t("goal.moveTo")}</option>
                    {moveTargets.filter((m) => !c.statuses.includes(m)).map((m) => (
                      <option key={m} value={m}>{m === "cancelled" ? t("status.cancelled") : t(`goal.col.${m}` as Key)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
