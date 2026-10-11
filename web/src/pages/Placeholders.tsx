import { Card, PageHeader } from "../components/ui";
import { ApiKeyForm } from "../components/Shell";
import { useI18n } from "../lib/i18n";

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
  --project my-app --department engineering -- <command>`}</pre>
        </Card>
      </div>
    </>
  );
}
