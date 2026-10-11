import { useCallback, useEffect, useState } from "react";
import { api, getToken, type Analysis, type Framework } from "../api";
import { useI18n, type Key } from "../lib/i18n";
import { Card, Empty, PageHeader } from "../components/ui";
import { ago } from "../lib/format";

const MODES = ["external", "builtin", "manual"] as const;

export default function Insights() {
  const { t } = useI18n();
  const [mode, setMode] = useState<string>("external");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, s, f] = await Promise.all([api.analyses(), api.settings(), api.frameworks()]);
      setAnalyses(a.analyses);
      setMode(s.settings["analyzer.mode"] || "external");
      setFrameworks(f.frameworks);
    } catch {
      /* global banner shows connectivity errors */
    }
  }, []);
  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [load]);

  const cmd = `export AGENTBOARD_URL=${location.origin}
export AGENTBOARD_KEY=${getToken()}
agentboard insights context --scope company > context.json
# analyse context.json with the framework prompts it contains, then:
agentboard insights post --framework meta_model --target-type goal --target-id <goal_id> --file result.json`;

  const setStatus = async (id: string, status: string) => {
    await api.setAnalysisStatus(id, status);
    load();
  };

  return (
    <>
      <PageHeader title={t("ins.title")} desc={t("ins.desc")} />

      <div className="grid-2">
        <Card title={t("ins.mode")}>
          <p className="hint">{t("ins.modeDesc")}</p>
          <div className="radio-list">
            {MODES.map((m) => (
              <label key={m} className={"radio" + (mode === m ? " on" : "") + (m === "builtin" ? " disabled" : "")}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === m}
                  disabled={m === "builtin"}
                  onChange={async () => {
                    setMode(m);
                    await api.setSetting("analyzer.mode", m);
                  }}
                />
                {t(`ins.mode.${m}` as Key)}
              </label>
            ))}
          </div>
          {mode === "external" && (
            <>
              <p className="hint" style={{ marginTop: 14 }}>{t("ins.externalHow")}</p>
              <pre className="code">{cmd}</pre>
              <button
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(cmd);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? t("ins.copied") : t("ins.copy")}
              </button>
            </>
          )}
        </Card>

        <Card title={t("ins.frameworks")}>
          <ul className="fw-list">
            {frameworks.map((f) => (
              <li key={f.id}>
                <b>{t(`fw.${f.id}.name` as Key)}</b>
                <span>{t(`fw.${f.id}.sum` as Key)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="spacer" />
      <div className="note-warn">{t("ins.heuristic")}</div>
      <div className="spacer" />

      <Card title={`${t("ins.results")} (${analyses.length})`} flush>
        {analyses.length === 0 ? (
          <Empty title={t("ins.noResults")} />
        ) : (
          <div className="analysis-list">
            {analyses.map((a) => {
              const r = a.result;
              return (
                <article className={"analysis st-" + a.status} key={a.id}>
                  <header>
                    <div>
                      <span className="tag">{t(`fw.${a.framework}.name` as Key)}</span>
                      {r.verdict && <span className={"verdict v-" + r.verdict}>{t(`ins.verdict.${r.verdict}` as Key)}</span>}
                    </div>
                    <div className="li-sub">
                      {a.target_type}{a.target_id ? ` · ${a.target_id}` : ""} · {a.analyzer} · {ago(a.created_at)}
                      {r.confidence != null && ` · ${t("ins.confidence", { n: Math.round(r.confidence * 100) })}`}
                    </div>
                  </header>
                  {r.recommendation && (
                    <p><b>{t("ins.recommendation")}: </b>{r.recommendation}</p>
                  )}
                  {!!r.findings?.length && (
                    <ul className="findings">
                      {r.findings.map((f, i) => (
                        <li key={i} className={f.ok ? "ok" : "bad"}>
                          <b>{f.item}</b> {f.note}
                          {f.quote && <em> “{f.quote}”</em>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!!r.questions?.length && (
                    <>
                      <div className="card-subtitle">{t("ins.questions")}</div>
                      <ul className="plain-bullets">{r.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                    </>
                  )}
                  <footer>
                    <span className="li-sub">{t(`ins.status.${a.status}` as Key)}</span>
                    {a.status === "new" && (
                      <>
                        <button className="btn" onClick={() => setStatus(a.id, "accepted")}>{t("ins.accept")}</button>
                        <button className="btn" onClick={() => setStatus(a.id, "dismissed")}>{t("ins.dismiss")}</button>
                      </>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
