# AgentBoard → OPC(一人公司)管理平台:升级方案

> 状态:已确认并实施(M1-M4)。M5(内置模型分析、护栏策略、WebSocket 控制通道)暂不做。
>
> **已确认的决定**:
> - 部门为 6 个:研发部、市场部、研究部、产品与战略部、运营部、财务部。
> - 不使用 `demo` 标签,整个环境都是演示。
> - AnnaAgent 分享幻灯片归市场部。
> - 自动化频率:公司级复盘每天一次,卡死/失败检测每小时一次(由 TRAE 自动化执行)。
> - 暂不做多用户协作(单租户、单 key)。
> - 分析方式默认由外部 Agent 执行,可在洞察页切换。

## 1. 目标

把 AgentBoard 从"单个 Agent 进程的监控面板"升级为"一人公司的管理平台":

1. **组织化**:Agent 按部门编组,像真实公司一样划分职能。
2. **更好的协同与管理**:从"盯进程"升级为"派任务、管交接、控风险"。
3. **决策辅助**:除监控进程状态外,分析任务是否对齐总体目标,给创始人提供决策简报。分析方法基于神经语言程序学(NLP)的结构化框架,分析执行者默认为外部 Agent,可切换。

设计原则:

- **向后兼容**:现有 `agentboard wrap` 上报流程不变,新字段全部可选。
- **推送式、出站 HTTP**:延续现有架构,Agent 侧不开放入站端口。
- **渐进交付**:每个里程碑都能独立上线、独立验收。
- **不在 Worker 里放模型密钥**(默认模式下),分析交给外部 Agent。

## 2. 现状

| 层 | 现状 |
|---|---|
| 数据 | D1 六张表:`projects` `sessions` `events` `logs` `commands` `api_keys`;`sessions.project_id` 已有但无部门概念 |
| 上报 | `agentboard wrap --agent X --project Y -- <cmd>`,流式日志、轮询命令(2s) |
| 控制 | `commands` 队列:cancel / pause / resume / message / annotate / custom |
| 实时 | Durable Object `SessionStream` 做 WebSocket 扇出 |
| 前端 | 控制台外壳 + 总览 + Agent 与会话 + 设置;部门/目标/洞察为占位页 |

已发现的问题(来自此前的演示):

- **命令发给已结束的会话仍被接收**:`message` 命令在会话 `done` 之后才入库,无人执行也无提示。需在服务端拒绝或明确标记。
- **会话与"为什么做"脱节**:`sessions` 只有 `title`,无法回答"这个会话服务于哪个目标"。
- **没有"待人决策"通道**:Agent 进入 `waiting` 时,人只能自己盯着看。

## 3. 信息架构

```
Company(租户)
 ├─ Goal(目标 / OKR)            ← 公司级,可分层
 │    └─ Task(任务)             ← 目标拆解出来的工作单元
 │         └─ Session(会话)     ← Agent 执行任务的一次运行(现有实体)
 └─ Department(部门)
      └─ Agent(花名册:角色、能力)
```

关键关系:

- **Department ← Agent**:Agent 属于一个部门(多数情况)。
- **Task → Goal**:每个任务对齐至少一个目标(允许为空,但会被"对齐分析"标记为"孤儿任务")。
- **Session → Task / Department**:会话可关联任务,并归属部门。归属解析顺序:显式上报 > Task 的部门 > Agent 花名册 > 自动规则 > 未分组。

## 4. 数据模型(D1 迁移 `0002_opc.sql`)

全部为新增,不改动现有列;对 `sessions` 仅追加可空列。

```sql
CREATE TABLE departments (
  id TEXT PRIMARY KEY,            -- d_xxx
  tenant TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  slug TEXT NOT NULL,             -- engineering / marketing ...
  description TEXT,
  color TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE agents (            -- 花名册:一个"员工"
  id TEXT PRIMARY KEY,            -- a_xxx
  tenant TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,             -- 对外显示名
  agent_type TEXT NOT NULL,       -- 与 sessions.agent_type 对应
  department_id TEXT,
  role TEXT,                      -- 职责说明
  capabilities TEXT,              -- JSON 数组
  created_at INTEGER NOT NULL
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,            -- g_xxx
  tenant TEXT NOT NULL DEFAULT 'default',
  parent_id TEXT,                 -- 目标层级(chunk up/down)
  title TEXT NOT NULL,
  outcome_json TEXT,              -- Well-Formed Outcome 结构化字段,见 §7
  level TEXT,                     -- Dilts 逻辑层次,见 §7
  status TEXT NOT NULL DEFAULT 'active',  -- draft|active|achieved|dropped
  due_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,            -- t_xxx
  tenant TEXT NOT NULL DEFAULT 'default',
  goal_id TEXT,
  department_id TEXT,
  assignee_agent_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',    -- todo|claimed|running|blocked|review|done|cancelled
  depends_on TEXT,                -- JSON 数组,任务依赖
  lease_until INTEGER,            -- 认领租约,见 §6
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE analyses (          -- 决策辅助产出
  id TEXT PRIMARY KEY,            -- an_xxx
  tenant TEXT NOT NULL DEFAULT 'default',
  framework TEXT NOT NULL,        -- well_formed_outcome|logical_levels|meta_model|...
  target_type TEXT NOT NULL,      -- goal|task|session|company|department
  target_id TEXT,
  result_json TEXT NOT NULL,      -- 结构化结果,见 §7.4
  analyzer TEXT NOT NULL,         -- external:<name> | builtin:<model> | manual
  created_at INTEGER NOT NULL
);

CREATE TABLE settings (          -- 键值配置,如 analyzer.mode
  tenant TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (tenant, key)
);

CREATE TABLE assignment_rules (  -- 自动归组规则
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL DEFAULT 'default',
  department_id TEXT NOT NULL,
  match_field TEXT NOT NULL,      -- agent_type|project|title|cwd
  match_op TEXT NOT NULL,         -- eq|prefix|contains|regex
  match_value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100
);

ALTER TABLE sessions ADD COLUMN department_id TEXT;
ALTER TABLE sessions ADD COLUMN task_id TEXT;
ALTER TABLE sessions ADD COLUMN tags TEXT;      -- JSON 数组,如 ["demo"]
```

## 5. API 增量(`/api/v1`,沿用 Bearer key + scope)

| 资源 | 端点 | scope |
|---|---|---|
| 部门 | `GET/POST /departments`,`PATCH/DELETE /departments/:id` | read / manage |
| 花名册 | `GET/POST /agents`,`PATCH /agents/:id` | read / manage |
| 目标 | `GET/POST /goals`,`PATCH /goals/:id`,`GET /goals/:id/tree` | read / manage |
| 任务 | `GET/POST /tasks`,`PATCH /tasks/:id` | read / manage |
| 会话归属 | `PATCH /sessions/:id` 新增 `department_id` `task_id` `tags` | manage |
| 规则 | `GET/POST /assignment-rules`,`POST /sessions/reassign`(按规则批量重算) | manage |
| 分析 | `GET /analyses?target=`,`POST /analyses` | read / ingest |
| 洞察上下文 | `GET /insights/context?scope=company\|department\|goal` | read |
| 配置 | `GET/PUT /settings/:key` | manage |
| 统计 | `GET /stats` 增加 `by_department` | read |

统计与列表接口增加 `?department_id=` 过滤。

## 6. 进程协同与管理:更好的实现方式

### 6.1 现有机制的局限

- 控制通道是 **2 秒轮询**,命令延迟高;`message` 只变成一条事件,Agent 本身并不会"读到并响应"。
- 协同靠"人来派活":没有任务队列,Agent 之间没有交接和依赖。
- 命令没有生命周期约束:可发给已结束的会话;`delivered` 之后无超时。
- `waiting` 状态没有对应的"待办决策"出口。

### 6.2 方案对比

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A 现状加固 | 保持轮询;命令加 TTL、拒绝发往已结束会话、`delivered` 超时回收 | 改动最小,无架构变化 | 延迟仍是秒级 | **M2 采用**(必做,修已发现的问题) |
| B 任务看板 + 认领租约 | Agent 主动拉取任务(`claim` 带租约),完成后回写;依赖由服务端判定可执行性;租约过期自动回收 | 适合推送式/出站 HTTP;天然支持多 Agent 与失败恢复;一人公司最需要"派活不盯人" | 需要 Agent 侧约定任务协议 | **M3 采用**(协同核心) |
| C 审批/决策收件箱 | Agent 进入 `waiting` 时附带"需要的决策"(问题 + 选项);人在控制台点选,结果回写为 `message` | 把"盯着看"变成"被通知",契合创始人时间稀缺 | 需 Agent 配合产出结构化提问 | **M3 采用**(与 B 配套) |
| D WebSocket 控制通道 | Agent 出站 WS 订阅自己的会话,命令实时下发 | 低延迟 | 长连接在沙箱/防火墙下不稳;增加 DO 复杂度 | **M5 可选**,先不做 |
| E 护栏策略 | 部门级预算/超时/并发上限;超限自动 `pause` 并通知 | 防止失控成本 | 需要成本数据上报 | **M4 可选** |

推荐路线:**A → B + C → (E, D 按需)**。

### 6.3 任务协议(M3)

```
Agent:  POST /tasks/claim {agent_type, department_id?}   → 返回一个可执行任务 + lease_until
Agent:  agentboard wrap --task t_xxx -- <cmd>             → 会话自动关联任务
Agent:  POST /tasks/:id/heartbeat                         → 续租
Agent:  PATCH /tasks/:id {status:"review"|"done", result} → 交接/完成
Server: 租约过期且无心跳 → 状态回到 todo,事件记录 "lease expired"
```

依赖:`depends_on` 中所有任务 `done` 后,该任务才会出现在可认领列表。

### 6.4 命令生命周期(M2)

- 发往 `done|error|cancelled` 的会话返回 `409`。
- `pending → delivered → done|failed|expired`,`pending` 超过 TTL(默认 10 分钟)转 `expired`。
- `message` 命令除记录事件外,在 `wrap` 中写入子进程可读的文件/环境(如 `$AGENTBOARD_INBOX` 目录),让 Agent 真正能读到。

## 7. NLP 决策辅助

> 说明:此处 NLP 指**神经语言程序学**。它在心理治疗效果上缺乏实证,因此本平台**只把它当作结构化提问与检查清单**,用于澄清目标、检查对齐,不当作事实依据。分析结果统一标注为"启发式建议",并附证据引用。

### 7.1 框架与平台功能的映射

| NLP 概念 | 含义 | 在平台中的用途 |
|---|---|---|
| **良构结果** Well-Formed Outcome | 目标需正向表述、可感知证据、有情境、符合整体生态、有资源、有第一步 | 创建/审查**目标**时的校验清单;缺项即给出补全问题 |
| **逻辑层次** Logical Levels(Dilts) | 环境 → 行为 → 能力 → 信念/价值 → 身份 → 愿景 | 给目标和任务标注层次;检查**任务(行为层)是否支撑上层(价值/身份层)**,发现层次错位 |
| **元模型** Meta Model | 识别语言中的省略、泛化、扭曲(如"提升产品体验") | 对目标/任务描述做**模糊度检查**,生成澄清追问(谁?多少?怎么衡量?) |
| **上切/下切** Chunking up/down | 向上追问"为了什么",向下追问"具体怎么做" | 任务关联目标(上切)、目标拆任务(下切);找出孤儿任务与过大的任务 |
| **TOTE 模型** Test-Operate-Test-Exit | 先测试、操作、再测试,达标则退出 | 与现有监控天然对应:Session = Operate,监控 = Test;要求任务写**退出条件** |
| **感知位置** Perceptual Positions | 第一位(自己)/第二位(对方)/第三位(旁观) | **决策简报**从创始人、客户/用户、旁观审计三个视角给出利弊 |
| **迪士尼策略** | 梦想家 / 现实家 / 批评家 | 决策简报的另一种模板,适合新方向的取舍 |

### 7.2 分析类型(首批)

1. **目标审查**(Well-Formed Outcome + Meta Model):输出缺失项与追问。
2. **任务对齐分析**(Logical Levels + 上切/下切):输出每个任务与目标的对齐度、孤儿任务、过载部门。
3. **进展判断**(TOTE):结合会话状态/日志,判断任务是在逼近退出条件、空转还是跑偏。
4. **决策简报**(感知位置 / 迪士尼):针对创始人待决策事项,给出选项、三视角利弊与建议。

### 7.3 分析执行者:可选,默认外部 Agent

`settings.analyzer.mode`:

| 模式 | 谁来分析 | 适用 |
|---|---|---|
| `external`(**默认**) | 外部 Agent(如 TRAE 自动化、Claude Code、任意能发 HTTP 的 Agent)定时拉取上下文,分析后回写 | 不在 Worker 放密钥;复用你已有的 Agent 与额度 |
| `builtin` | Worker 调用 Workers AI 或配置的 LLM 密钥 | 想要"点一下立即出结果"的体验 |
| `manual` | 人工填写或仅使用清单 | 离线/省成本 |

外部模式流程:

```
1) 外部 Agent  GET  /insights/context?scope=company     ← 拿到目标树、任务、部门负载、最近会话摘要、待分析项
2) 外部 Agent  按框架的提示词模板分析(模板随 skill 分发)
3) 外部 Agent  POST /analyses {framework,target,result_json,analyzer:"external:trae"}
4) 控制台      在"洞察"页与对应目标/任务上展示结果;可对结果"采纳/忽略"
```

配套交付一个新 skill:`agentboard-insights`,内含各框架的提示词模板、`context → analyze → post` 的脚本,以及适配 **TRAE 自动化**的定时调用说明(例如每天一次公司级复盘、每小时一次卡死检测)。

### 7.4 分析结果结构(`result_json`)

```json
{
  "framework": "well_formed_outcome",
  "target": {"type": "goal", "id": "g_123"},
  "verdict": "needs_work",
  "findings": [
    {"item": "evidence", "ok": false, "note": "未说明如何判断达成", "quote": "提升产品体验"}
  ],
  "questions": ["具体提升哪项指标?目标值与期限是什么?"],
  "recommendation": "先补全可衡量证据,再拆分任务",
  "confidence": 0.7,
  "evidence": [{"type": "session", "id": "s_xxx"}],
  "disclaimer": "heuristic"
}
```

要求每条结论必须能追溯到目标/任务/会话证据,不允许无引用的论断。

## 8. 上报协议(遵循现有流程)

现有流程保持不变:

```bash
export AGENTBOARD_URL=https://agentboard.frosty-poetry-59f5.workers.dev
export AGENTBOARD_KEY=dev-local-key        # 演示阶段使用默认 key
agentboard wrap --agent claude-code \
  --project my-app -- <command>
```

新增**可选**参数与环境变量(不传则走自动归组规则):

```bash
agentboard wrap --agent claude-code --project my-app \
  --department engineering \        # 部门 slug
  --task t_xxx \                    # 关联任务
  --tag demo \
  -- <command>
# 或
export AGENTBOARD_DEPARTMENT=engineering
export AGENTBOARD_TASK=t_xxx
```

`agentboard-report` skill 同步更新,并在 skill 中约定:**Agent 每次启动非平凡任务时先上报**,有任务 ID 时必须带上 `--task`。

## 9. 前端变更

| 页面 | 变更 |
|---|---|
| 总览 | 增加"按部门"视图:各部门活跃数、成功率、待决策数;顶部加"待我决策"计数 |
| Agent 与会话 | 增加部门筛选;会话详情显示部门、关联任务/目标;可手动改归属 |
| 部门(现占位) | 部门列表与创建;部门详情:成员(花名册)、负载、会话、规则 |
| 目标与任务(现占位) | 目标树(OKR);任务看板(todo/running/blocked/review/done);任务详情关联会话 |
| 洞察(现占位) | 分析结果流;按框架/目标过滤;采纳/忽略;分析模式切换;"生成上下文包"按钮方便手动喂给外部 Agent |
| 设置 | 分析模式、自动归组规则管理 |
| 全局 | 中英文词典同步扩充 |

## 10. 里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| **M1 组织模型** | 迁移 `0002`;departments / agents / assignment_rules API;sessions 增加归属字段;前端部门页与筛选;`wrap --department` | 能创建部门、把会话归入部门、总览按部门统计;旧流程不受影响 |
| **M2 管理加固** | 命令生命周期(拒绝已结束会话、TTL、expired);`message` 可被 Agent 读取;事件补充 | 向已结束会话发命令得到 409;过期命令不再悬挂 |
| **M3 协同** | goals / tasks;认领租约;依赖;决策收件箱;`wrap --task` | 两个 Agent 可从同一任务池认领、交接;租约过期自动回收 |
| **M4 洞察** | analyses / settings;`/insights/context`;`agentboard-insights` skill;洞察页;TRAE 自动化接入 | 外部 Agent 定时拉取并回写分析;洞察页可见并可采纳 |
| **M5 可选** | 内置分析模式;护栏策略;WS 控制通道 | 按需 |

建议顺序 M1 → M2 → M3 → M4。M1 完成后即可执行第 11 节的存量会话归组。

## 11. 升级后:存量会话归组(已执行)

部门(标识):研发部 `engineering`、市场部 `marketing`、研究部 `research`、产品与战略部 `strategy`、运营部 `operations`、财务部 `finance`。

| 会话 | Agent / 项目 | 归属 | 依据 |
|---|---|---|---|
| OPC 升级规划 / 实施 | opencode / AgentBoard | 产品与战略部 | 方案设计 |
| OPC landing page(像素动画等) | claude-code / AgentBoard | 市场部 | 落地页 |
| Create AnnaAgent share slides | solo / AnnaAgent | 市场部 | 分享幻灯片(已确认) |
| Survey: persona shift in machine psychology | opencode / persona-shift-survey | 研究部 | 文献调研 |
| Fix failing fizzbuzz test | opencode / demo-fizzbuzz | 研发部 | 代码修复 |
| live worker smoke test | opencode / cloud-demo | 研发部 | 冒烟测试 |
| 手动创建的会话 | manual-demo / playground | 研发部 | 演示 |
| ua-curl | test / 无项目 | 研发部 | 测试 |

实现方式:先建立自动规则(项目前缀、`agent_type` 等),再对规则覆盖不到的会话显式 `agentboard assign`。此后新增的会话按 任务 → 花名册 → 规则 自动归组;凡是带 `--department` 上报的会话以显式值为准。
## 12. 实施记录

| 里程碑 | 状态 | 说明 |
|---|---|---|
| M1 组织模型 | 完成 | `0002_opc` 迁移(经 `POST /admin/migrate` 幂等执行)、部门/花名册/规则 API、会话部门字段、前端部门页 |
| M2 管理加固 | 完成 | 已结束会话拒绝命令(409);命令 10 分钟过期;`wrap` 提供 `AGENTBOARD_INBOX`,`message` 真正可被 Agent 读取 |
| M3 协同 | 完成 | 目标、任务看板、认领租约与依赖、决策收件箱(答复自动作为 `message` 下发) |
| M4 洞察 | 完成 | `analyses` / `settings` / `GET /insights/context` / 7 个 NLP 框架提示词;新增 `agentboard-insights` 技能;洞察页 |
| M5 可选 | 未做 | 内置模型分析、护栏策略、WebSocket 控制通道 |

技能同步:`agentboard-report`(部门/任务/决策/收件箱)、`agentboard-monitor`(按部门巡检、决策、归组)、`agentboard-insights`(新)。
## 13. 风险与取舍

- **NLP 方法的可信度**:仅作结构化提问,不输出确定性结论;所有分析可追溯证据、可被忽略。
- **外部分析的稳定性**:依赖外部 Agent 按时运行;控制台需显示"上次分析时间",超时给出提示。
- **数据迁移**:D1 的 `ALTER TABLE ADD COLUMN` 对现有数据安全;迁移脚本需幂等,并先在本地 `wrangler dev` 验证再 `db:init:remote`。
- **范围蔓延**:M3 的任务系统最容易膨胀,第一版只做认领、租约、依赖、交接,不做甘特图、工时等。
- **默认 key**:`dev-local-key` 仅用于演示阶段;进入真实使用前需轮换并通过 secret 注入。
