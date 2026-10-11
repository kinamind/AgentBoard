// Idempotent schema upgrades, applied via POST /api/v1/admin/migrate.
// Keeping them in the Worker means a deploy + one call upgrades any database
// (local, remote, fresh or existing) without needing wrangler credentials.

export const MIGRATIONS: { id: string; sql: string[] }[] = [
  {
    id: "0002_opc",
    sql: [
      `CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        color TEXT,
        sort INTEGER NOT NULL DEFAULT 100,
        created_at INTEGER NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_slug ON departments (tenant, slug)`,
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        department_id TEXT,
        role TEXT,
        capabilities TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL DEFAULT 'default',
        parent_id TEXT,
        title TEXT NOT NULL,
        outcome_json TEXT,
        level TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        due_at INTEGER,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL DEFAULT 'default',
        goal_id TEXT,
        department_id TEXT,
        assignee_agent_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        depends_on TEXT,
        lease_until INTEGER,
        claimed_by TEXT,
        result_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (tenant, status)`,
      `CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL DEFAULT 'default',
        session_id TEXT,
        task_id TEXT,
        question TEXT NOT NULL,
        options_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        answer TEXT,
        created_at INTEGER NOT NULL,
        answered_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL DEFAULT 'default',
        framework TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        result_json TEXT NOT NULL,
        analyzer TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_analyses_target ON analyses (tenant, target_type, target_id)`,
      `CREATE TABLE IF NOT EXISTS settings (
        tenant TEXT NOT NULL DEFAULT 'default',
        key TEXT NOT NULL,
        value TEXT,
        PRIMARY KEY (tenant, key)
      )`,
      `CREATE TABLE IF NOT EXISTS assignment_rules (
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL DEFAULT 'default',
        department_id TEXT NOT NULL,
        match_field TEXT NOT NULL,
        match_op TEXT NOT NULL,
        match_value TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 100,
        created_at INTEGER NOT NULL
      )`,
      `ALTER TABLE sessions ADD COLUMN department_id TEXT`,
      `ALTER TABLE sessions ADD COLUMN task_id TEXT`,
      `ALTER TABLE sessions ADD COLUMN tags TEXT`,
      `ALTER TABLE commands ADD COLUMN expires_at INTEGER`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_department ON sessions (tenant, department_id)`,
      // Default departments for the OPC (one-person company) tenant.
      `INSERT OR IGNORE INTO departments (id, tenant, name, slug, description, color, sort, created_at) VALUES
        ('d_engineering','default','研发部','engineering','写代码、测试、部署与基础设施','#4f46e5',10,0),
        ('d_marketing','default','市场部','marketing','落地页、演示稿、对外内容与品牌','#db2777',20,0),
        ('d_research','default','研究部','research','文献调研、实验与分析','#0891b2',30,0),
        ('d_strategy','default','产品与战略部','strategy','方案设计、规划与决策支持','#d97706',40,0),
        ('d_operations','default','运营部','operations','日常运营、流程与客户事务','#059669',50,0),
        ('d_finance','default','财务部','finance','预算、成本、账务与合规','#7c3aed',60,0)`,
      `INSERT OR IGNORE INTO settings (tenant, key, value) VALUES ('default','analyzer.mode','external')`,
    ],
  },
];
