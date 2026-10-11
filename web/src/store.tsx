import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Decision, type Department, type Session, type Stats } from "./api";

interface DataState {
  sessions: Session[];
  stats: Stats | null;
  departments: Department[];
  decisions: Decision[];
  error: string | null;
  loaded: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

/** Single polling source shared by every page. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, st, d, q] = await Promise.all([
        api.listSessions(),
        api.stats(),
        api.departments().catch(() => ({ departments: [] as Department[] })),
        api.decisions("pending").catch(() => ({ decisions: [] as Decision[] })),
      ]);
      setSessions(s.sessions);
      setStats(st);
      setDepartments(d.departments);
      setDecisions(q.decisions);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const value = useMemo(
    () => ({ sessions, stats, departments, decisions, error, loaded, refresh }),
    [sessions, stats, departments, decisions, error, loaded, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
