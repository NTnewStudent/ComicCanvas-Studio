---
description:
alwaysApply: false
---

# AGENTS_KIRO.md

**ComicCanvas Studio — Kiro IDE 治理入口**

本文件是 `AGENTS.md` 的 Kiro 环境迁移版，面向在 **Kiro IDE** 中开发本项目的场景。
原始 `AGENTS.md`（Codex/GPT 原生）与 `.claude/`（Claude Code）**保持原样，未修改**。

> Kiro 配置层的完整文件结构见 `.kiro/README.md`。

---

## 项目身份

**ComicCanvas Studio — AIGC 漫剧画布 + Agent 自动编排桌面客户端**（Electron + TypeScript + Node.js + SQLite，本地优先）

核心价值：
1. **画布**：用户手动操作 React Flow 画布，节点化生成图片 / 视频（text/image/video 三节点）
2. **Agent**：自然语言驱动 Agent 自动「生成节点 → 连线 → 串行执行任务」

**产品定位**：以「漫剧（comic drama）制作」为主——围绕「文本 → 生图 → 生视频」这条漫剧生产链路组织画布与 Agent 能力。

---

## 工程形态

| 层 | 路径 | 技术栈 |
| :--- | :--- | :--- |
| Electron 主进程 + Agent 运行时 + 本地服务 | `desktop/src/main/` | Node.js 20+ / TS strict |
| 渲染层（画布 UI） | `desktop/src/renderer/` | React 18 / Vite 5 / @xyflow/react / Zustand / TanStack Query |
| 数据持久化 | `desktop/src/main/db/` | SQLite（better-sqlite3 + Drizzle），DB 抽象层（可切 MySQL）|
| 任务队列 + 模型适配 | `desktop/src/main/jobs/`、`desktop/src/main/providers/` | 进程内持久化队列 + 模型网关适配器 |
| 共享契约 | `shared/` | 连接矩阵 / Plan 类型 / IPC 契约（前后端唯一真源）|

> 包管理：**Bun 1.3.14**（`.bun-version` + `bun.lock`）。不引入 `package-lock.json`、`npm run` 或 `npx`。

> ⚠️ 无 Redis / 无 BullMQ / 无 WebSocket：进程内持久化任务队列 + Electron IPC 事件替代。
> ⚠️ 资产不走 COS：生成字节落本地 `appData/assets/`，DB 存相对路径，渲染走 `cc-asset://` 安全协议。

---

## Kiro 治理层结构

```
.kiro/
├── README.md                        # 完整导航
├── steering/
│   ├── [始终加载]
│   │   ├── project-identity.md      # 项目身份、核心契约、全局禁止
│   │   ├── coding-standards.md      # 通用编码规范
│   │   └── ltm-operations.md        # LTM 记忆操作
│   │
│   ├── [文件匹配自动加载]
│   │   ├── electron-node.md         # desktop/src/main/**, desktop/src/preload/**
│   │   ├── agent-runtime.md         # desktop/src/main/agent/**
│   │   ├── canvas-engine.md         # desktop/src/renderer/canvas/**
│   │   ├── tool-contracts.md        # desktop/src/main/tools/**
│   │   ├── data-persistence.md      # desktop/src/main/db/**
│   │   ├── tests.md                 # **/*.test.ts, **/*.spec.ts
│   │   └── ltm-memory-format.md     # ltm/**
│   │
│   └── [手动激活，chat 中用 # 引用]
│       ├── agent-orchestrator.md    # orchestrator-agent 角色
│       ├── agent-canvas.md          # canvas-agent 角色
│       ├── agent-tooling.md         # tooling-agent 角色
│       ├── agent-pm.md              # pm-agent 角色
│       ├── skill-canvas-node-designer.md
│       ├── skill-pm-req-planner.md
│       └── skill-creator.md
│
└── hooks/
    ├── ltm-capture-on-stop.json     # agentStop → ltm.py capture-turn
    └── ltm-checkpoint-post-task.json # postTaskExecution → ltm checkpoint
```

---

## 🎭 Agent 分工（Kiro 激活方式）

| Agent | 角色 | Kiro chat 引用 | 对应源文件 |
| :--- | :--- | :--- | :--- |
| **orchestrator-agent** | 自然语言 → 声明式 Canvas Plan，编排全链路 | `#agent-orchestrator` | `.codex/agents/orchestrator-agent.toml` |
| **canvas-agent** | 渲染层画布 / 节点 / 连线 / React Flow 实现 | `#agent-canvas` | `.codex/agents/canvas-agent.toml` |
| **tooling-agent** | Agent 运行时 / Tool 接口 / 任务队列 / 模型适配 / DB | `#agent-tooling` | `.codex/agents/tooling-agent.toml` |
| **pm-agent** | 需求拆解、契约协调、进度、测试 | `#agent-pm` | `.codex/agents/pm-agent.toml` |

---

## 🔴 上岗前必读（按角色）

### orchestrator-agent
```
本文件
+ #agent-orchestrator（Kiro chat 引用）
+ specs/canvas-agent-orchestration/
```
对应 Codex：`AGENTS.md` + `.codex/agents/orchestrator-agent.toml` + `specs/canvas-agent-orchestration/`

### canvas-agent
```
本文件
+ #agent-canvas（Kiro chat 引用）
+ global/design/DESIGN.md
+ shared/（connection-matrix.ts / plan.ts / nodes.ts）
```
对应 Codex：`AGENTS.md` + `.codex/agents/canvas-agent.toml` + `global/design/DESIGN.md` + `shared/`

### tooling-agent
```
本文件
+ #agent-tooling（Kiro chat 引用）
+ docs/api-contracts/
```
对应 Codex：`AGENTS.md` + `.codex/agents/tooling-agent.toml` + `docs/api-contracts/`

### pm-agent
```
本文件
+ #agent-pm（Kiro chat 引用）
+ specs/
+ docs/progress/
```
对应 Codex：`AGENTS.md` + `.codex/agents/pm-agent.toml` + `specs/` + `docs/progress/`

---

## 📊 共享真源（Source of Truth）

与 `AGENTS.md` 完全一致，不另设副本：

| 文档 | 用途 | 写入方 |
| :--- | :--- | :--- |
| `docs/api-contracts/` | IPC / 服务契约 | pm-agent 起草，tooling-agent 主改 |
| `global/design/DESIGN.md` | 全局 UI/UX 设计系统、前端视觉 token | canvas-agent 主消费，pm-agent 协调 |
| `shared/connection-matrix.ts` | 节点连接矩阵（唯一真源）| tooling-agent + canvas-agent |
| `shared/plan.ts` | 声明式 Canvas Plan 类型 | orchestrator-agent |
| `specs/` | 项目级 requirements / design / tasks spec | pm-agent 主改，全体消费 |
| `docs/progress/` | 需求 / 迭代 / 测试报告 | pm-agent |
| `docs/architecture/` | 系统架构 | 全体 |

---

## 🚫 全局禁止

与 `AGENTS.md` 完全一致：

- ❌ 直接引用 hjwall / cc-haha 的源码文件（仅参考其设计与契约）
- ❌ 把可执行代码塞进 Canvas Plan（必须是白名单清洗后的纯声明式 JSON）
- ❌ 前后端各自维护一份连接矩阵副本（必须消费 `shared/connection-matrix.ts`）
- ❌ 生图/生视频走同步阻塞路径（必须入本地任务队列，IPC 事件回推终态）
- ❌ 渲染进程开启 `nodeIntegration`、关闭 `contextIsolation`
- ❌ 使用 `any`（用 `unknown` + 类型收窄）
- ❌ 未在 `docs/api-contracts/` 登记契约就开新 IPC 通道
- ❌ 密钥明文存储 / 写进日志 / 写进 LTM
- ❌ DB 查询散落业务层（走仓储层）
- ❌ 子 agent 提权（工具集超出父 agent）/ 递归深度超 `MAX_SPAWN_DEPTH(2)`
- ❌ `runNode` 同步等待生成；第三方网关轮询在 JobWorker 内部做，不阻塞入队入口

---

## Skill 速查（Kiro 手动激活）

| Skill | Kiro chat 引用 | 用途 | 对应源文件 |
| :--- | :--- | :--- | :--- |
| canvas-node-designer | `#skill-canvas-node-designer` | 新增/修改节点类型，保持六处一致 | `.agents/skills/canvas-node-designer/SKILL.md` |
| pm-req-planner | `#skill-pm-req-planner` | EARS 需求规格化三件套 | `.agents/skills/pm-req-planner/SKILL.md` |
| comiccanvas-skill-creator | `#skill-creator` | 创建新 Kiro steering skill | `.agents/skills/skill-creator/SKILL.md` |

---

## LTM 项目记录

本项目沿用 hjwall 的 **LTM 项目记录模式**（`ltm/`）。

Kiro 侧通过 `hooks/ltm-capture-on-stop.json` 自动在每次 agent 停止时触发 `ltm.py capture-turn`，等价于 `.claude/settings.json` 的 Stop 钩子和 `.codex/config.toml` 的 `[[hooks.Stop]]`。

```bash
# 恢复工作记忆
python ltm/bin/ltm.py files --limit 10
python ltm/bin/ltm.py sessions --limit 5

# 保存检查点
python ltm/bin/ltm.py checkpoint --from-json <path>
python ltm/bin/ltm.py regenerate

# Windows 上查 ltm/config.json 确认 python_cmd（python 或 py）
```

---

## 三套系统对照表

| 能力 | Codex（原生） | Claude Code（兼容） | Kiro（本文件）|
| :--- | :--- | :--- | :--- |
| 项目入口 | `AGENTS.md` + `.codex/config.toml` | `CLAUDE.md` + `.claude/README.md` | `AGENTS_KIRO.md`（本文件）|
| Agent 定义 | `.codex/agents/*.toml` | `.claude/agents/*.md` | `.kiro/steering/agent-*.md`（manual）|
| 代码规则 | `.codex/config.toml` 全局指令 | `.claude/rules/*.md`（globs）| `.kiro/steering/*.md`（fileMatch）|
| Skills | `.agents/skills/*/SKILL.md` | `.claude/skills/*/SKILL.md` | `.kiro/steering/skill-*.md`（manual）|
| Stop 钩子 | `.codex/config.toml [[hooks.Stop]]` | `.claude/settings.json` | `.kiro/hooks/ltm-capture-on-stop.json` |
| Spec 存档 | `specs/`（共享真源） | `specs/`（共享真源）| `specs/`（共享真源）|

> 三套系统共享同一个 `specs/` 目录——这是唯一的产品 spec 真源。
> `.codex/` `.claude/` `.kiro/` 都只是工具运行时/配置层，不承载产品 spec。
