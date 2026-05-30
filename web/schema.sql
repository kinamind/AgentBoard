-- AgentBoard D1 schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  tenant     TEXT NOT NULL DEFAULT 'default',
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  tenant      TEXT NOT NULL DEFAULT 'default',
  project_id  TEXT,
  agent_type  TEXT NOT NULL DEFAULT 'unknown',
  title       TEXT,
  status      TEXT NOT NULL DEFAULT 'starting', -- starting|running|waiting|done|error|cancelled
  cwd         TEXT,
  host        TEXT,
  pid         INTEGER,
  started_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  exit_code   INTEGER,
  last_seq    INTEGER NOT NULL DEFAULT 0,
  meta_json   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_updated ON sessions (tenant, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (tenant, status);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ts         INTEGER NOT NULL,
  type       TEXT NOT NULL,            -- start|status|note|tool|error|done|heartbeat|command
  level      TEXT NOT NULL DEFAULT 'info', -- debug|info|warn|error
  message    TEXT,
  data_json  TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events (session_id, ts);

CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  seq        INTEGER NOT NULL,
  ts         INTEGER NOT NULL,
  stream     TEXT NOT NULL DEFAULT 'stdout', -- stdout|stderr
  content    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_session_seq ON logs (session_id, seq);

CREATE TABLE IF NOT EXISTS commands (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  ts         INTEGER NOT NULL,
  kind       TEXT NOT NULL,           -- cancel|pause|resume|message|annotate|custom
  payload_json TEXT,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending|delivered|done|failed
  result_json TEXT,
  acked_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_commands_session ON commands (session_id, status, ts);

CREATE TABLE IF NOT EXISTS api_keys (
  key        TEXT PRIMARY KEY,
  tenant     TEXT NOT NULL DEFAULT 'default',
  name       TEXT NOT NULL,
  scopes     TEXT NOT NULL DEFAULT 'ingest,read,manage', -- comma list
  created_at INTEGER NOT NULL
);

-- A convenient local-dev key. Replace/rotate for real deployments.
INSERT OR IGNORE INTO api_keys (key, tenant, name, scopes, created_at)
VALUES ('dev-local-key', 'default', 'local-dev', 'ingest,read,manage', 0);
