import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Session, type Stats } from "./api";

interface DataState {
  sessions: Session[];
  stats: Stats | null;
  error: string | null;
  loaded: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

/** Single polling source shared by every page. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([api.listSessions(), api.stats()]);
      setSessions(s.sessions);
      setStats(st);
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

  const value = useMemo(() => ({ sessions, stats, error, loaded, refresh }), [sessions, stats, error, loaded, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
