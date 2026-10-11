import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

const en = {
  "brand.sub": "OPC Console",
  "nav.workspace": "Workspace",
  "nav.company": "Company",
  "nav.system": "System",
  "nav.overview": "Overview",
  "nav.agents": "Agents & Sessions",
  "nav.departments": "Departments",
  "nav.goals": "Goals & Tasks",
  "nav.insights": "Insights",
  "nav.settings": "Settings",
  "nav.soon": "Soon",
  "foot.live": "Live · polling 3s",
  "top.console": "Console",
  "top.connected": "Connected",
  "top.disconnected": "Disconnected",
  "top.theme": "Toggle theme",
  "top.lang": "中文",
  "err.api": "Unable to reach the API: {msg}",
  "common.noData": "No data",
  "common.loading": "Loading…",
  "common.planned": "Planned",
  "status.starting": "starting",
  "status.running": "running",
  "status.waiting": "waiting",
  "status.done": "done",
  "status.error": "error",
  "status.cancelled": "cancelled",

  "ov.title": "Overview",
  "ov.desc": "Real-time health of every agent running in your company.",
  "ov.active": "Active agents",
  "ov.activeHint": "running · waiting · starting",
  "ov.total": "Total sessions",
  "ov.totalHint": "{n} agent types",
  "ov.success": "Success rate",
  "ov.successHint": "of finished sessions",
  "ov.attention": "Needs attention",
  "ov.attentionHint": "failed or stalled > 10m",
  "ov.dist": "Status distribution",
  "ov.types": "Agent types",
  "ov.needs": "Needs attention",
  "ov.allClear": "All clear",
  "ov.allClearDesc": "No failed or stalled sessions.",
  "ov.recent": "Recent activity",
  "ov.noSessions": "No sessions yet",
  "ov.noSessionsDesc": "Run `agentboard wrap -- <cmd>` to report your first agent.",
  "ov.exit": "exit {code}",
  "ov.silent": "silent {t}",
  "ov.ago": "{t} ago",

  "ag.title": "Agents & Sessions",
  "ag.desc": "Inspect live terminals and control running agents.",
  "ag.sessions": "Sessions",
  "ag.search": "Search title, agent, path…",
  "ag.f.all": "All",
  "ag.f.active": "Active",
  "ag.f.error": "Failed",
  "ag.f.done": "Done",
  "ag.noMatch": "No matching sessions",
  "ag.select": "Select a session",
  "ag.selectDesc": "Pick one on the left to see its live terminal, events and controls.",
  "ag.agent": "Agent",
  "ag.host": "Host",
  "ag.duration": "Duration",
  "ag.exit": "Exit",
  "ag.path": "Path",
  "ag.message": "Message",
  "ag.pause": "Pause",
  "ag.resume": "Resume",
  "ag.cancel": "Cancel",
  "ag.promptMsg": "Message to send to this agent:",
  "ag.confirmCancel": "Cancel this session?",
  "ag.terminal": "Terminal",
  "ag.events": "Events",
  "ag.noEvents": "No events yet",

  "dep.title": "Departments",
  "dep.desc": "Organize agents into functional teams, like a real company.",
  "dep.1t": "Department groups",
  "dep.1d": "Engineering, Marketing, Support, Finance… assign each agent to a department.",
  "dep.2t": "Per-department dashboards",
  "dep.2d": "Workload, success rate and cost rolled up by team.",
  "dep.3t": "Agent roster",
  "dep.3d": "Role, capabilities and ownership for every agent in the company.",
  "goal.title": "Goals & Tasks",
  "goal.desc": "Connect everyday agent work to your company objectives.",
  "goal.1t": "Objectives & key results",
  "goal.1d": "Define company-level goals and break them into measurable results.",
  "goal.2t": "Task pipeline",
  "goal.2d": "Tasks flow between agents and departments with explicit hand-offs.",
  "goal.3t": "Goal alignment",
  "goal.3d": "Every session is linked to a task and a goal so progress is traceable.",
  "ins.title": "Insights",
  "ins.desc": "Decision support on top of raw monitoring.",
  "ins.1t": "Task analysis",
  "ins.1d": "Assess whether current work actually serves the overall goal.",
  "ins.2t": "Decision briefs",
  "ins.2d": "Structured options and recommendations for the founder.",
  "ins.3t": "Automated reviews",
  "ins.3d": "Scheduled analysis of agent activity with proactive alerts.",
  "set.title": "Settings",
  "set.desc": "Connection and workspace configuration.",
  "set.api": "API access",
  "set.apiHint": "The key is stored in this browser and sent with every request.",
  "set.save": "Save",
  "set.keyPh": "API key",
  "set.connect": "Connect an agent",
  "set.connectHint": "Report any coding agent to this workspace:",
};

const zh: Record<keyof typeof en, string> = {
  "brand.sub": "一人公司控制台",
  "nav.workspace": "工作区",
  "nav.company": "公司",
  "nav.system": "系统",
  "nav.overview": "总览",
  "nav.agents": "Agent 与会话",
  "nav.departments": "部门",
  "nav.goals": "目标与任务",
  "nav.insights": "洞察",
  "nav.settings": "设置",
  "nav.soon": "即将推出",
  "foot.live": "实时 · 每 3 秒刷新",
  "top.console": "控制台",
  "top.connected": "已连接",
  "top.disconnected": "连接断开",
  "top.theme": "切换主题",
  "top.lang": "English",
  "err.api": "无法连接 API:{msg}",
  "common.noData": "暂无数据",
  "common.loading": "加载中…",
  "common.planned": "规划中",
  "status.starting": "启动中",
  "status.running": "运行中",
  "status.waiting": "等待中",
  "status.done": "已完成",
  "status.error": "失败",
  "status.cancelled": "已取消",

  "ov.title": "总览",
  "ov.desc": "实时掌握公司内每一个 Agent 的运行状况。",
  "ov.active": "活跃 Agent",
  "ov.activeHint": "运行中 · 等待中 · 启动中",
  "ov.total": "会话总数",
  "ov.totalHint": "{n} 种 Agent 类型",
  "ov.success": "成功率",
  "ov.successHint": "已结束会话中的占比",
  "ov.attention": "需要关注",
  "ov.attentionHint": "失败或停滞超过 10 分钟",
  "ov.dist": "状态分布",
  "ov.types": "Agent 类型",
  "ov.needs": "需要关注",
  "ov.allClear": "一切正常",
  "ov.allClearDesc": "没有失败或停滞的会话。",
  "ov.recent": "最近活动",
  "ov.noSessions": "还没有会话",
  "ov.noSessionsDesc": "运行 `agentboard wrap -- <命令>` 上报你的第一个 Agent。",
  "ov.exit": "退出码 {code}",
  "ov.silent": "已静默 {t}",
  "ov.ago": "{t}前",

  "ag.title": "Agent 与会话",
  "ag.desc": "查看实时终端,并远程控制运行中的 Agent。",
  "ag.sessions": "会话",
  "ag.search": "搜索标题、Agent、路径…",
  "ag.f.all": "全部",
  "ag.f.active": "活跃",
  "ag.f.error": "失败",
  "ag.f.done": "完成",
  "ag.noMatch": "没有匹配的会话",
  "ag.select": "请选择一个会话",
  "ag.selectDesc": "在左侧选择会话,查看实时终端、事件和控制操作。",
  "ag.agent": "Agent",
  "ag.host": "主机",
  "ag.duration": "时长",
  "ag.exit": "退出码",
  "ag.path": "路径",
  "ag.message": "发消息",
  "ag.pause": "暂停",
  "ag.resume": "继续",
  "ag.cancel": "取消",
  "ag.promptMsg": "发送给该 Agent 的消息:",
  "ag.confirmCancel": "确定取消该会话吗?",
  "ag.terminal": "终端",
  "ag.events": "事件",
  "ag.noEvents": "暂无事件",

  "dep.title": "部门",
  "dep.desc": "像真正的公司一样,把 Agent 按职能编组。",
  "dep.1t": "部门分组",
  "dep.1d": "研发、市场、客服、财务……为每个 Agent 指定所属部门。",
  "dep.2t": "部门看板",
  "dep.2d": "按团队汇总工作量、成功率与成本。",
  "dep.3t": "Agent 花名册",
  "dep.3d": "记录每个 Agent 的角色、能力与负责人。",
  "goal.title": "目标与任务",
  "goal.desc": "把 Agent 的日常工作与公司目标连接起来。",
  "goal.1t": "目标与关键结果",
  "goal.1d": "设定公司级目标,并拆解为可衡量的关键结果。",
  "goal.2t": "任务流水线",
  "goal.2d": "任务在 Agent 与部门之间流转,交接清晰。",
  "goal.3t": "目标对齐",
  "goal.3d": "每个会话都关联任务与目标,进展可追溯。",
  "ins.title": "洞察",
  "ins.desc": "在监控之上提供决策支持。",
  "ins.1t": "任务分析",
  "ins.1d": "评估当前工作是否真正服务于总体目标。",
  "ins.2t": "决策简报",
  "ins.2d": "为创始人提供结构化的选项与建议。",
  "ins.3t": "自动复盘",
  "ins.3d": "定时分析 Agent 活动,并主动预警。",
  "set.title": "设置",
  "set.desc": "连接与工作区配置。",
  "set.api": "API 访问",
  "set.apiHint": "密钥保存在本浏览器中,并随每次请求发送。",
  "set.save": "保存",
  "set.keyPh": "API 密钥",
  "set.connect": "接入 Agent",
  "set.connectHint": "把任意编码 Agent 上报到此工作区:",
};

export type Key = keyof typeof en;
const DICT = { en, zh } as const;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  const saved = localStorage.getItem("agentboard.lang");
  if (saved === "en" || saved === "zh") return saved;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem("agentboard.lang", l);
    setLangState(l);
  }, []);

  const t = useCallback<I18n["t"]>(
    (key, vars) => {
      let s: string = DICT[lang][key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
