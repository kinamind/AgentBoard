import { Card, ComingSoon, PageHeader } from "../components/ui";
import { ApiKeyForm } from "../components/Shell";

export function Departments() {
  return (
    <>
      <PageHeader title="Departments" desc="Organize agents into functional teams, like a real company." />
      <ComingSoon
        items={[
          { title: "Department groups", desc: "Engineering, Marketing, Support, Finance… assign each agent to a department." },
          { title: "Per-department dashboards", desc: "Workload, success rate and cost rolled up by team." },
          { title: "Agent roster", desc: "Role, capabilities and ownership for every agent in the company." },
        ]}
      />
    </>
  );
}

export function Goals() {
  return (
    <>
      <PageHeader title="Goals & Tasks" desc="Connect everyday agent work to your company objectives." />
      <ComingSoon
        items={[
          { title: "Objectives & key results", desc: "Define company-level goals and break them into measurable results." },
          { title: "Task pipeline", desc: "Tasks flow between agents and departments with explicit hand-offs." },
          { title: "Goal alignment", desc: "Every session is linked to a task and a goal so progress is traceable." },
        ]}
      />
    </>
  );
}

export function Insights() {
  return (
    <>
      <PageHeader title="Insights" desc="Decision support on top of raw monitoring." />
      <ComingSoon
        items={[
          { title: "Task analysis", desc: "Assess whether current work actually serves the overall goal." },
          { title: "Decision briefs", desc: "Structured options and recommendations for the founder." },
          { title: "Automated reviews", desc: "Scheduled analysis of agent activity with proactive alerts." },
        ]}
      />
    </>
  );
}

export function Settings() {
  return (
    <>
      <PageHeader title="Settings" desc="Connection and workspace configuration." />
      <div className="grid-2">
        <Card title="API access">
          <p className="hint">The key is stored in this browser and sent with every request.</p>
          <ApiKeyForm />
        </Card>
        <Card title="Connect an agent">
          <p className="hint">Report any coding agent to this workspace:</p>
          <pre className="code">{`export AGENTBOARD_URL=${location.origin}
export AGENTBOARD_KEY=<your-key>
agentboard wrap --agent claude-code \\
  --project my-app -- <command>`}</pre>
        </Card>
      </div>
    </>
  );
}
