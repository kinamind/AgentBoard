import { Card, ComingSoon, PageHeader } from "../components/ui";
import { ApiKeyForm } from "../components/Shell";
import { useI18n } from "../lib/i18n";

function useItems(prefix: "dep" | "goal" | "ins") {
  const { t } = useI18n();
  return [1, 2, 3].map((n) => ({ title: t(`${prefix}.${n}t` as any), desc: t(`${prefix}.${n}d` as any) }));
}

export function Departments() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("dep.title")} desc={t("dep.desc")} />
      <ComingSoon items={useItems("dep")} />
    </>
  );
}

export function Goals() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("goal.title")} desc={t("goal.desc")} />
      <ComingSoon items={useItems("goal")} />
    </>
  );
}

export function Insights() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("ins.title")} desc={t("ins.desc")} />
      <ComingSoon items={useItems("ins")} />
    </>
  );
}

export function Settings() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("set.title")} desc={t("set.desc")} />
      <div className="grid-2">
        <Card title={t("set.api")}>
          <p className="hint">{t("set.apiHint")}</p>
          <ApiKeyForm />
        </Card>
        <Card title={t("set.connect")}>
          <p className="hint">{t("set.connectHint")}</p>
          <pre className="code">{`export AGENTBOARD_URL=${location.origin}
export AGENTBOARD_KEY=<your-key>
agentboard wrap --agent claude-code \\
  --project my-app -- <command>`}</pre>
        </Card>
      </div>
    </>
  );
}
