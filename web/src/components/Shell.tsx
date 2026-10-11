import { useState, type ReactNode } from "react";
import { getToken, setToken } from "../api";
import { useData } from "../store";
import { useI18n, type Key } from "../lib/i18n";

export interface NavItem {
  id: string;
  label: Key;
  icon: string; // svg path (24x24, stroke)
  badge?: number;
  soon?: boolean;
}

const I = {
  overview: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  agents: "M12 2a4 4 0 100 8 4 4 0 000-8zM4 20a8 8 0 0116 0",
  dept: "M3 21V8l9-5 9 5v13M9 21v-6h6v6",
  goals: "M12 22a10 10 0 100-20 10 10 0 000 20zm0-5a5 5 0 100-10 5 5 0 000 10zm0-3a2 2 0 100-4 2 2 0 000 4z",
  insights: "M3 3v18h18M7 15l4-4 3 3 5-6",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
};

export const NAV: NavItem[] = [
  { id: "overview", label: "nav.overview", icon: I.overview },
  { id: "agents", label: "nav.agents", icon: I.agents },
  { id: "departments", label: "nav.departments", icon: I.dept, soon: true },
  { id: "goals", label: "nav.goals", icon: I.goals, soon: true },
  { id: "insights", label: "nav.insights", icon: I.insights, soon: true },
  { id: "settings", label: "nav.settings", icon: I.settings },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Sidebar({ route, onNavigate }: { route: string; onNavigate: (id: string) => void }) {
  const { sessions } = useData();
  const { t } = useI18n();
  const active = sessions.filter((s) => s.status === "running" || s.status === "waiting").length;
  return (
    <aside className="sidebar-nav">
      <div className="brand">
        <div className="logo">A</div>
        <div>
          <div className="brand-name">AgentBoard</div>
          <div className="brand-sub">{t("brand.sub")}</div>
        </div>
      </div>
      <nav>
        <div className="nav-group">{t("nav.workspace")}</div>
        {NAV.slice(0, 2).map((n) => (
          <NavButton key={n.id} n={n} route={route} onNavigate={onNavigate} badge={n.id === "agents" ? active : undefined} />
        ))}
        <div className="nav-group">{t("nav.company")}</div>
        {NAV.slice(2, 5).map((n) => (
          <NavButton key={n.id} n={n} route={route} onNavigate={onNavigate} />
        ))}
        <div className="nav-group">{t("nav.system")}</div>
        {NAV.slice(5).map((n) => (
          <NavButton key={n.id} n={n} route={route} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="live-dot" /> {t("foot.live")}
      </div>
    </aside>
  );
}

function NavButton({
  n,
  route,
  onNavigate,
  badge,
}: {
  n: NavItem;
  route: string;
  onNavigate: (id: string) => void;
  badge?: number;
}) {
  const { t } = useI18n();
  return (
    <button className={"nav-item" + (route === n.id ? " active" : "")} onClick={() => onNavigate(n.id)}>
      <Icon d={n.icon} />
      <span className="nav-label">{t(n.label)}</span>
      {n.soon && <span className="nav-soon">{t("nav.soon")}</span>}
      {!!badge && <span className="nav-badge">{badge}</span>}
    </button>
  );
}

export function Topbar({
  title,
  theme,
  onToggleTheme,
}: {
  title: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const { error } = useData();
  const { t, lang, setLang } = useI18n();
  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="crumb-root">{t("top.console")}</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-cur">{title}</span>
      </div>
      <div className="topbar-right">
        <span className={"conn " + (error ? "bad" : "ok")}>
          <i /> {error ? t("top.disconnected") : t("top.connected")}
        </span>
        <button className="btn lang-btn" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {t("top.lang")}
        </button>
        <button className="icon-btn" onClick={onToggleTheme} title={t("top.theme")}>
          {theme === "light" ? "☾" : "☀"}
        </button>
      </div>
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="page">{children}</div>;
}

export function ApiKeyForm() {
  const { refresh } = useData();
  const { t } = useI18n();
  const [v, setV] = useState(getToken());
  return (
    <div className="form-row">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={t("set.keyPh")} spellCheck={false} />
      <button
        className="btn btn-primary"
        onClick={() => {
          setToken(v);
          refresh();
        }}
      >
        {t("set.save")}
      </button>
    </div>
  );
}
