---
description:
alwaysApply: true
---

# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility"/"configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style.
- Remove only the imports/variables YOUR changes orphaned.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"

For multi-step tasks, state a brief plan with verify checks per step.

## 5. Code Annotations (Mandatory)

- All exported functions/classes/methods must have JSDoc (intent, params, return, exceptions).
- All API/IPC methods must include a contract anchor: `@see docs/api-contracts/...`.
- All exception throw/catch must have inline comments explaining the reason.

---

## 项目身份

**ComicCanvas Studio — AIGC 漫剧画布 + Agent 自动编排桌面客户端**。一个离线优先（local-first）的 **Electron + TypeScript + Node.js** 应用。

核心价值：
1. **画布**：用户手动操作画布，生成图片 / 视频（text/image/video 三节点），节点化编排。
2. **Agent**：用自然语言驱动 Agent 自动「生成节点 → 连线 → 串行执行任务」。

**产品定位**：本产品**以「漫剧（comic drama）制作」为主**——围绕「文本 → 生图 → 生视频」这条漫剧生产链路组织画布与 Agent 能力。

参考来源（仅参考，不直接引用其代码）：
- `./hjwall`（画布 / 声明式 Plan 编排 / 异步任务 / 资产管线 / LTM / 治理范式）
- `./cc-haha-main`：**仅参考其内置 Agent 能力**（AsyncGenerator 主循环 / 统一 Tool 接口 / Skills / Hooks 的设计），作为 Agent 内核底座，不照搬其 CLI/终端形态、也不引用源码。

**Agent 可扩展**：当前 Agent 阵容（orchestrator / canvas / tooling / pm）面向漫剧主线；后期可按需新增其它 Agent（如分镜 storyboard-agent、配音 voice-agent、运营 ops-agent 等）。

Qoder 环境的原生入口是 `.qoder/agents/*.md`、`.qoder/rules/*.md`、`.qoder/skills/*/SKILL.md` 与 `.qoder/settings.json`
项目级需求、设计与任务 spec 的全局真源是根目录 `specs/`。 `.qoder/` 原生配置。

## 工程形态

| 层 | 路径 | 技术栈 |
| :--- | :--- | :--- |
| Electron 主进程 + Agent 运行时 + 本地服务 | `desktop/src/main/` | Node.js 20+ / TS strict |
| 渲染层（画布 UI） | `desktop/src/renderer/` | React 18 / Vite 5 / @xyflow/react / Zustand / TanStack Query |
| 数据持久化 | `desktop/src/main/db/` | SQLite（better-sqlite3 + Drizzle），DB 抽象层（可切 MySQL） |
| 任务队列 + 模型适配 | `desktop/src/main/jobs/`、`desktop/src/main/providers/` | 进程内持久化队列 + 模型网关适配器 |
| 共享契约 | `shared/` | 连接矩阵 / Plan 类型 / IPC 契约（前后端唯一真源） |

> 包管理、依赖锁定、前端/后端构建与 CI/CD 命令统一使用 **Bun 1.3.14**（`.bun-version` + `bun.lock`）。Electron 主进程运行时仍是 Electron/Node 环境；不要重新引入 `package-lock.json`、`.npmrc`、`npm run` 或 `npx` 作为项目入口。

> ⚠️ 桌面端**无 Redis / 无 BullMQ / 无 WS**：用进程内持久化任务队列 + Electron IPC 事件替代。
> ⚠️ 资产**不走 COS**：生成字节落本地 `appData/assets/`，DB 存相对路径，渲染走自定义安全协议。

## 🎭 Agent 分工

| sub-Agent | 角色 | Qoder 定义 |
| :--- | :--- | :--- |
| **orchestrator-agent** | 自然语言 → 声明式 Canvas Plan，编排全链路 | `.qoder/agents/orchestrator-agent.md` |
| **canvas-agent** | 渲染层画布 / 节点 / 连线 / React Flow 实现 | `.qoder/agents/canvas-agent.md` |
| **tooling-agent** | Agent 运行时 / Tool 接口 / 任务队列 / 模型适配 / DB | `.qoder/agents/tooling-agent.md` |
| **pm-agent** | 需求拆解、契约协调、进度、测试 | `.qoder/agents/pm-agent.md` |

会话开始时先声明角色。Qoder 环境第一件事是加载对应 `.qoder/agents/*.md`。

## Qoder 原生设置

Qoder 启动时自动读取本 `AGENTS.md` 作为项目级长期指导，同时加载 `.qoder/` 下的 agents、rules、skills 和 settings。项目内 Qoder 原生配置层如下：

| 类型 | 路径 | 用途 |
| :--- | :--- | :--- |
| Custom agents | `.qoder/agents/*.md` | Qoder 自定义 sub-agent 定义（YAML frontmatter + Markdown prompt） |
| Rules | `.qoder/rules/*.md` | Qoder 规则文件（always-apply / glob-matched，YAML frontmatter） |
| Skills | `.qoder/skills/*/SKILL.md` | Qoder 仓库级可复用 workflow skills |
| Hooks / Settings | `.qoder/settings.json` | 项目级 hooks（如 LTM capture on Stop） |

Codex 兼容层保留在 `.codex/`，Claude Code 兼容层保留在 `.claude/`。

## 🔴 上岗前必读（按角色）

- **orchestrator-agent（Qoder）**：本文件 + `.qoder/agents/orchestrator-agent.md` + `specs/canvas-agent-orchestration/`
- **canvas-agent（Qoder）**：本文件 + `.qoder/agents/canvas-agent.md` + `global/design/DESIGN.md` + `shared/`（连接矩阵 / Plan 类型）+ `docs/api-contracts/`
- **tooling-agent（Qoder）**：本文件 + `.qoder/agents/tooling-agent.md` + `docs/api-contracts/`
- **pm-agent（Qoder）**：本文件 + `.qoder/agents/pm-agent.md` + `specs/` + `docs/progress/`

Codex 环境按 `.codex/` 内配置上岗；Claude Code 环境按 `.claude/` 内 README 上岗；Qoder 环境只使用本节列出的 `.qoder/` 原生入口。

## 📊 共享真源（Source of Truth）

| 文档 | 用途 | 写入方 |
| :--- | :--- | :--- |
| `docs/api-contracts/` | IPC / 服务契约 | pm-agent 起草，tooling-agent 主改 |
| `global/design/DESIGN.md` | 全局 UI/UX 设计系统、前端视觉 token、组件与交互规范 | canvas-agent 主消费，pm-agent 协调 |
| `shared/connection-matrix.ts` | 节点连接矩阵（前后端唯一真源） | tooling-agent + canvas-agent |
| `shared/plan.ts` | 声明式 Canvas Plan 类型 | orchestrator-agent |
| `specs/` | 项目级 requirements / design / tasks spec 全局真源 | pm-agent 主改，全体消费 |
| `docs/progress/` | 需求 / 迭代 / 测试报告 | pm-agent |
| `docs/architecture/` | 系统架构 | 全体 |

## 🎨 全局 UI/UX 设计真源

- `global/design/DESIGN.md` 是当前项目所有前端 UI/UX 的全局设计系统入口。
- 凡涉及 `desktop/src/renderer/**`、画布节点、连线、面板、表单、按钮、状态反馈、主题 token 或动效的任务，负责实现的前端 agent 必须先读取并遵守 `global/design/DESIGN.md`。
- 组件不得绕过设计 token 直接硬编码颜色、圆角、阴影、字号或动效曲线；若规范缺少 token，先补充设计规范或在实现计划中说明新增语义 token。

## 🚫 全局禁止

- ❌ 直接引用 hjwall / cc-haha 的源码文件（仅参考其设计与契约）
- ❌ 把可执行代码塞进 Canvas Plan（Plan 必须是白名单清洗后的纯声明式 JSON）
- ❌ 前后端各自维护一份连接矩阵副本（必须消费 `shared/connection-matrix.ts`）
- ❌ 生图/生视频走同步阻塞路径（必须入本地任务队列，IPC 事件回推终态）
- ❌ 渲染进程开启 `nodeIntegration`、关闭 `contextIsolation`（见 electron 安全规则）
- ❌ 使用 `any`（用 `unknown` + 类型收窄）
- ❌ 未在 `docs/api-contracts/` 登记契约就开新 IPC 通道

## 项目记录（LTM）

本项目沿用 hjwall 的 **LTM 项目记录模式**（`ltm/`）。恢复工作、回忆决策、记录检查点的操作见 `ltm/README.md`。

## Command Output

Protect context usage. Any command with unknown/large output must be byte-capped:

```bash
COMMAND 2>&1 | head -c 4000
```

On Windows (cmd/PowerShell) 等价裁剪输出，避免污染上下文。

## 多 IDE 兼容层

| IDE 环境 | 配置目录 | 备注 |
| :--- | :--- | :--- |
| Qoder（主） | `.qoder/` | 原生 agent / rule / skill / hook 配置，本文件为其全局指导 |
| Codex | `.codex/` | 兼容保留，TOML agent + Starlark rules |
| Claude Code | `.claude/` | 兼容保留，Markdown agent + rules + commands |
| 共享 Skills | `.agents/skills/` | 英文规范版 skills，各 IDE 均可消费 |
