import { useCallback, useEffect, useState } from "react";
import { DataProvider, useData } from "./store";
import { I18nProvider, useI18n } from "./lib/i18n";
import { NAV, Page, Sidebar, Topbar } from "./components/Shell";
import Overview from "./pages/Overview";
import Agents from "./pages/Agents";
import Departments from "./pages/Departments";
import Goals from "./pages/Goals";
import Insights from "./pages/Insights";
import { Settings } from "./pages/Placeholders";

function parseHash(): { route: string; param: string | null } {
  const [route, param] = location.hash.replace(/^#\/?/, "").split("/");
  return { route: NAV.some((n) => n.id === route) ? route : "overview", param: param || null };
}

function Shell() {
  const [{ route, param }, setLoc] = useState(parseHash);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("agentboard.theme") as "light" | "dark") || "light",
  );
  const { error } = useData();
  const { t } = useI18n();

  useEffect(() => {
    const on = () => setLoc(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("agentboard.theme", theme);
  }, [theme]);

  const go = useCallback((id: string, p?: string | null) => {
    location.hash = p ? `/${id}/${p}` : `/${id}`;
  }, []);

  const navItem = NAV.find((n) => n.id === route) ?? NAV[0];
  const title = t(navItem.label);

  return (
    <div className="shell">
      <Sidebar route={route} onNavigate={(id) => go(id)} />
      <div className="content">
        <Topbar title={title} theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} />
        {error && <div className="banner-error">{t("err.api", { msg: error })}</div>}
        <main className="scroll">
          <Page>
            {route === "overview" && <Overview onOpen={(id) => go("agents", id)} />}
            {route === "agents" && <Agents selected={param} onSelect={(id) => go("agents", id)} />}
            {route === "departments" && <Departments onOpenSession={(id) => go("agents", id)} />}
            {route === "goals" && <Goals />}
            {route === "insights" && <Insights />}
            {route === "settings" && <Settings />}
          </Page>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <DataProvider>
        <Shell />
      </DataProvider>
    </I18nProvider>
  );
}
