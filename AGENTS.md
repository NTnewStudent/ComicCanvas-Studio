# ComicCanvas Studio

**AIGC 漫剧画布 + Agent 自动编排桌面客户端**（Electron + TypeScript + Node.js + SQLite，本地优先）

本文件是 **Cursor** 项目治理入口。配置层导航见 `.cursor/README.md`。

---

## 项目身份

核心价值：
1. **画布**：用户手动操作 React Flow 画布，节点化生成图片 / 视频（text/image/video 三节点）
2. **Agent**：自然语言驱动 Agent 自动「生成节点 → 连线 → 串行执行任务」

**产品定位**：以「漫剧（comic drama）制作」为主——围绕「文本 → 生图 → 生视频」组织画布与 Agent 能力。

---

## 工程形态

| 层 | 路径 | 技术栈 |
| :--- | :--- | :--- |
| Electron 主进程 + Agent 运行时 + 本地服务 | `desktop/src/main/` | Node.js 20+ / TS strict |
| 渲染层（画布 UI） | `desktop/src/renderer/` | React 18 / Vite 5 / @xyflow/react / Zustand / TanStack Query |
| 数据持久化 | `desktop/src/main/db/` | SQLite（better-sqlite3 + Drizzle），DB 抽象层（可切 MySQL）|
| 任务队列 + 模型适配 | `desktop/src/main/jobs/`、`desktop/src/main/providers/` | 进程内持久化队列 + 模型网关适配器 |
| 共享契约 | `shared/` | 连接矩阵 / Plan 类型 / IPC 契约（前后端唯一真源）|

> 包管理：**Bun 1.3.14**（`.bun-version` + `bun.lock`）。不引入 `package-lock.json`、`npm run` 或 `npx` 作为项目入口。

> ⚠️ 无 Redis / 无 BullMQ / 无 WebSocket：进程内持久化任务队列 + Electron IPC 事件替代。
> ⚠️ 资产落本地 `appData/assets/`，DB 存相对路径，渲染走 `cc-asset://` 安全协议。

---

## Cursor 治理层

```
.cursor/
├── README.md
├── mcp.json
├── rules/                    # Project Rules（.mdc）
│   ├── project-identity.mdc  # alwaysApply
│   ├── coding-standards.mdc  # alwaysApply
│   ├── ltm-operations.mdc    # alwaysApply
│   ├── project-commands.mdc  # Apply Intelligently
│   ├── electron-node.mdc     # globs: main + preload
│   ├── agent-runtime.mdc     # globs: main/agent
│   ├── canvas-engine.mdc     # globs: renderer/canvas
│   ├── tool-contracts.mdc
│   ├── data-persistence.mdc
│   ├── tests.mdc
│   ├── agent-*.mdc           # 纯手动 @
│   └── skill-*.mdc
└── agents/                   # Subagents（.md）
    ├── orchestrator-agent.md
    ├── canvas-agent.md
    ├── tooling-agent.md
    └── pm-agent.md
```

### Rules 与 Subagents

| 机制 | 位置 | 激活 | 用途 |
| :--- | :--- | :--- | :--- |
| **Project Rules** | `.cursor/rules/*.mdc` | `@规则名`、globs、alwaysApply | 向当前 Agent 注入指令 |
| **Subagents** | `.cursor/agents/*.md` | `/subagent名`、Agent 自动委托 | 独立 context 执行子任务 |

> [Cursor Rules](https://cursor.com/docs/rules) · [Subagents](https://cursor.com/docs/subagents)

---

## Agent 分工

| Agent | 角色 | Rule | Subagent |
| :--- | :--- | :--- | :--- |
| **orchestrator-agent** | CanvasPlan 编排 | `@agent-orchestrator` | `/orchestrator-agent` |
| **canvas-agent** | 画布 / 节点 / 连线 | `@agent-canvas` | `/canvas-agent` |
| **tooling-agent** | 主进程 / Tool / DB | `@agent-tooling` | `/tooling-agent` |
| **pm-agent** | 需求 / 契约 / 进度 | `@agent-pm` | `/pm-agent` |

- **Rule `@`**：当前对话注入角色约束
- **Subagent `/`**：长链路、并行子任务、隔离 verbose 输出

```
@agent-tooling 审查 desktop/src/main/ipc/canvas.handler.ts
/tooling-agent 重构 jobs 队列入队路径并跑 vitest
```

---

## 上岗前必读（按角色）

### orchestrator-agent
```
AGENTS.md + @agent-orchestrator + specs/canvas-agent-orchestration/
```

### canvas-agent
```
AGENTS.md + @agent-canvas + global/design/DESIGN.md + shared/
```

### tooling-agent
```
AGENTS.md + @agent-tooling + docs/api-contracts/
```

### pm-agent
```
AGENTS.md + @agent-pm + specs/ + docs/progress/
```

---

## 核心契约

### 节点连接矩阵（`shared/connection-matrix.ts`，唯一真源）

| 上游 | 允许下游 |
|------|---------|
| text | image, video |
| image | image, video |
| video | video |

### CanvasPlan（`shared/plan.ts`）

`kind: 'plan' | 'clarify'`；`runSteps.action` 白名单：`imageRun` | `videoRun` | `textPolish`。

### IPC（`shared/ipc.ts`，`domain.action`）

`canvas.*` / `job.*` / `settings.*` / `asset.*`

---

## 共享真源

| 文档 | 用途 | 写入方 |
| :--- | :--- | :--- |
| `docs/api-contracts/` | IPC / 服务契约 | pm-agent 起草，tooling-agent 主改 |
| `global/design/DESIGN.md` | UI/UX design token | canvas-agent 主消费，pm-agent 协调 |
| `shared/connection-matrix.ts` | 连接矩阵 | tooling-agent + canvas-agent |
| `shared/plan.ts` | CanvasPlan 类型 | orchestrator-agent |
| `specs/` | requirements / design / tasks | pm-agent 主改，全体消费 |
| `docs/progress/` | 迭代与测试报告 | pm-agent |
| `docs/architecture/` | 系统架构 | 全体 |

---

## 全局禁止

- ❌ 直接引用 hjwall / cc-haha 源码（仅参考设计与契约）
- ❌ Canvas Plan 含可执行代码 / 脚本字符串
- ❌ 前后端各自维护连接矩阵副本
- ❌ 生图/生视频同步阻塞（必须入队 + IPC 终态）
- ❌ `contextIsolation: false` 或 `nodeIntegration: true`
- ❌ TypeScript `any`
- ❌ 未在 `docs/api-contracts/` 登记就开新 IPC
- ❌ 密钥明文存储 / 写进日志
- ❌ DB 查询散落业务层（走仓储层）
- ❌ 子 agent 提权 / 递归深度超 `MAX_SPAWN_DEPTH(2)`
- ❌ `runNode` 同步等待生成
- ❌ 渲染层 `setInterval` 轮询资产状态

---

## Skill 速查

| Skill | 激活 | 用途 |
| :--- | :--- | :--- |
| canvas-node-designer | `@skill-canvas-node-designer` | 新增/修改节点类型（六处一致）|
| pm-req-planner | `@skill-pm-req-planner` | EARS 需求三件套 → `specs/` |
| skill-creator | `@skill-creator` | 创建新 `.cursor/rules` 规则 |

规则定义见 `.cursor/rules/skill-*.mdc`。

---

## 项目记录

不使用 LTM。不要运行 `ltm/bin/ltm.py`。任务状态以 `specs/`、`docs/progress/`、git 与用户最新指令为准。

---

## 编码规范快查

- 导出符号 JSDoc；IPC/服务 `@see docs/api-contracts/...`
- 异常 throw/catch 行内注释；禁止吞异常
- 纯逻辑放 `lib/`；IPC handler 薄、service 厚

详细规则见 `.cursor/rules/coding-standards.mdc`。
