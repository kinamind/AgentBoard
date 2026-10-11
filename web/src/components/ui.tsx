import type { ReactNode } from "react";
import { STATUS_COLORS } from "../lib/format";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status}`}>
      <i className="badge-dot" />
      {status}
    </span>
  );
}

export function Card({
  title,
  extra,
  children,
  flush,
}: {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="card">
      {(title || extra) && (
        <header className="card-head">
          <h3>{title}</h3>
          <div>{extra}</div>
        </header>
      )}
      <div className={flush ? "card-body flush" : "card-body"}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}

export function Empty({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-mark" />
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
    </div>
  );
}

/** Horizontal stacked bar for status distribution. */
export function DistributionBar({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (!total) return <div className="dist-empty">No data</div>;
  return (
    <div>
      <div className="dist-bar">
        {Object.entries(data).map(([k, v]) => (
          <span key={k} style={{ width: `${(v / total) * 100}%`, background: STATUS_COLORS[k] || "#94a3b8" }} title={`${k}: ${v}`} />
        ))}
      </div>
      <div className="dist-legend">
        {Object.entries(data).map(([k, v]) => (
          <span key={k}>
            <i style={{ background: STATUS_COLORS[k] || "#94a3b8" }} />
            {k} <b>{v}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ComingSoon({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <div className="roadmap">
      {items.map((i) => (
        <div className="roadmap-item" key={i.title}>
          <span className="tag">Planned</span>
          <div className="roadmap-title">{i.title}</div>
          <div className="roadmap-desc">{i.desc}</div>
        </div>
      ))}
    </div>
  );
}
