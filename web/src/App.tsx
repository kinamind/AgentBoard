import { useCallback, useEffect, useState } from "react";
import { DataProvider, useData } from "./store";
import { NAV, Page, Sidebar, Topbar } from "./components/Shell";
import Overview from "./pages/Overview";
import Agents from "./pages/Agents";
import { Departments, Goals, Insights, Settings } from "./pages/Placeholders";

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

  const title = NAV.find((n) => n.id === route)?.label ?? "Overview";

  return (
    <div className="shell">
      <Sidebar route={route} onNavigate={(id) => go(id)} />
      <div className="content">
        <Topbar title={title} theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} />
        {error && <div className="banner-error">Unable to reach the API: {error}</div>}
        <main className="scroll">
          <Page>
            {route === "overview" && <Overview onOpen={(id) => go("agents", id)} />}
            {route === "agents" && <Agents selected={param} onSelect={(id) => go("agents", id)} />}
            {route === "departments" && <Departments />}
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
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}
