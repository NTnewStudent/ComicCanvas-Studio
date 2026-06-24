---
description:
alwaysApply: true
---

# ComicCanvas Studio

**AIGC 漫剧画布 + Agent 自动编排桌面客户端**（Electron + TypeScript + Node.js + SQLite，本地优先）

两条核心能力：
1. **画布**：用户手动操作 React Flow 画布，节点化生成图片 / 视频
2. **Agent**：自然语言驱动 Agent 自动「生成节点 → 连线 → 串行执行任务」

---

## 技术栈

| 层 | 选型 |
|----|------|
| 桌面外壳 | Electron + TypeScript 5+（strict）|
| 渲染层 | React 18 + Vite 5 + @xyflow/react + Zustand v4 + TanStack Query v5 + Tailwind |
| 主进程 | Node.js 20+ |
| 数据库 | SQLite（better-sqlite3 + Drizzle ORM），DB 抽象层可切 MySQL |
| 任务队列 | 进程内持久化队列（落 SQLite `jobs` 表），无 BullMQ / Redis |
| 实时 | Electron IPC 事件（无 WebSocket）|
| Agent | AsyncGenerator 主循环 + 统一 Tool 接口（参考 cc-haha 设计）|
| 资产 | 本地 `appData/assets/`，DB 存相对路径，渲染走 `cc-asset://` 安全协议 |

---

## 仓库结构

```
comic-canvas/
├── CLAUDE.md / AGENTS.md          # 本文件（项目规则） / 编码行为准则
├── .claude/                       # Claude Code 治理层
│   ├── settings.json              # 权限 + Stop 钩子（LTM 自动捕获）
│   ├── README.md                  # 治理层导航
│   ├── agents/                    # 4 个子 agent 定义（自包含）
│   │   ├── orchestrator-agent.md
│   │   ├── canvas-agent.md
│   │   ├── tooling-agent.md
│   │   └── pm-agent.md
│   ├── rules/                     # alwaysApply 或按 globs 自动激活
│   │   ├── coding-standards.md    → alwaysApply
│   │   ├── ltm-operations.md      → alwaysApply
│   │   ├── ltm-memory-format.md   → ltm/**
│   │   ├── electron-node.md       → desktop/src/main|preload/**
│   │   ├── agent-runtime.md       → desktop/src/main/agent/**
│   │   ├── canvas-engine.md       → desktop/src/renderer/canvas/**
│   │   ├── tool-contracts.md      → desktop/src/main/tools/**
│   │   ├── data-persistence.md    → desktop/src/main/db/**
│   │   └── tests.md               → **/*.{test,spec}.{ts,tsx}
│   ├── commands/                  # 斜杠命令（/orchestrator /canvas /tooling /pm /ltm-*）
│   ├── skills/                    # pm-req-planner / canvas-node-designer / skill-creator
│   └── specs/                     # 需求/设计/任务三件套
│       └── canvas-agent-orchestration/
├── ltm/                           # 项目长期记忆（LTM 项目记录模式）
├── shared/                        # 前后端唯一真源契约
│   ├── connection-matrix.ts       # 节点连接矩阵
│   ├── plan.ts                    # 声明式 CanvasPlan 类型
│   ├── nodes.ts                   # 节点 / 边类型
│   └── ipc.ts                     # IPC 通道契约
├── desktop/
│   └── src/
│       ├── main/                  # 主进程（Node）
│       │   ├── agent/             # Agent 主循环 + 编排
│       │   ├── tools/             # 统一 Tool 接口 + Canvas 工具集
│       │   ├── jobs/              # 任务队列 + JobWorker
│       │   ├── providers/         # 模型网关适配器（image/video/text）
│       │   ├── db/                # Drizzle schema + 仓储层
│       │   ├── assets/            # 本地资产管线
│       │   └── ipc/               # IPC handler
│       ├── preload/               # contextBridge 白名单 API
│       └── renderer/              # 渲染层（React）
│           └── canvas/            # React Flow 画布
└── docs/
    ├── research-report.md
    ├── architecture/
    ├── api-contracts/             # IPC / 服务契约（契约先行）
    └── progress/                  # 需求 / 迭代 / 测试报告
```

---

## Agent 角色

| Agent | 职责 | 文件范围 | 激活方式 |
|-------|------|----------|---------|
| **orchestrator-agent** | 自然语言 → CanvasPlan 编排 | `main/agent/` + `shared/plan.ts` | `@orchestrator-agent` |
| **canvas-agent** | React Flow 画布 / 节点 / 连线 | `renderer/canvas/` | `@canvas-agent` |
| **tooling-agent** | Agent 运行时 / Tool / Queue / DB | `main/**` | `@tooling-agent` |
| **pm-agent** | 需求 / 契约 / 进度 / 测试 | `docs/` + `.claude/specs/` | `@pm-agent` |

完整角色定义在 `.claude/agents/<name>.md`（自包含）。

---

## 核心契约

### 节点连接矩阵（`shared/connection-matrix.ts`，唯一真源）

三种节点：`text` / `image` / `video`。

| 上游 | 允许下游 |
|------|---------|
| text | image, video |
| image | image, video |
| video | video |

### CanvasPlan（`shared/plan.ts`）

```typescript
interface CanvasPlan {
  kind: 'plan' | 'clarify'
  summary: string
  nodes: { ref: string; type: string; title: string; data: Record<string, unknown> }[]
  edges: { source: string; target: string; edgeType: string }[]
  runSteps: { ref: string; action: RunAction }[]
  question: string | null
  dropped: string[]
}
type RunAction = 'imageRun' | 'videoRun' | 'textPolish'
```

### Tools & Agents 系统（`shared/tools-agents.ts`）

- **统一 Tool 接口**：手动操作与 Agent 编排共用同一套 Tool 实现（区别只在触发源）。
- **Canvas 工具集**：queryGraph / proposePlan / createNode / connectNodes / updateNodeData / deleteNode(ask) / runNode。
- **super-agent**：`allowedTools: '*'`，默认对话入口，持有全部工具。
- **spawnSubAgent**：内联定义模式 spawn 子 agent 跑长任务；权限 ⊆ 父级，递归深度 ≤ `MAX_SPAWN_DEPTH(2)`。
- **网关热拔插**：`GatewayConfig`（OpenAI 兼容），设置页改 URL/Key 后重新初始化 Provider，不重启。
- **资产文件夹**：`AssetFolder`，图片/视频分类 + 用户自定义嵌套文件夹。
- 详见 `docs/api-contracts/tools-agents.md`。

### IPC 通道（`shared/ipc.ts`，命名格式 `domain.action`）

- canvas.*：`chatSend` / `chatGetPlan` / `runNode` / `saveGraph` / `loadGraph`
- job.*：`subscribe` / `progress` / `completed` / `failed`
- settings.*：`getGateways` / `saveGateway` / `getAgents` / `saveAgent` / `getTools` / `toggleTool`
- asset.*：`getFolders` / `createFolder` / `moveAsset` / `deleteAsset`

---

## 全局禁止

- ❌ Canvas Plan 里出现可执行代码 / 脚本字符串
- ❌ 前后端各自维护连接矩阵副本（只消费 `shared/connection-matrix.ts`）
- ❌ 生图/生视频走同步阻塞路径（必须入任务队列，IPC 事件回推终态）
- ❌ `contextIsolation: false` 或 `nodeIntegration: true`
- ❌ TypeScript `any`（用 `unknown` + 类型收窄）
- ❌ 未在 `docs/api-contracts/` 登记契约就开新 IPC 通道
- ❌ 密钥明文存储 / 写进日志 / 写进 LTM
- ❌ DB 查询散落业务层（走仓储层）
- ❌ 渲染层 `setInterval` 轮询资产状态
- ❌ 子 agent 提权（工具集超出父 agent）/ 递归深度超 `MAX_SPAWN_DEPTH(2)`
- ❌ `runNode` 同步等待生成；第三方网关轮询在 JobWorker 内部做，不阻塞入队入口

---

## 编码规范

- 所有导出函数/类/方法必须有 JSDoc（意图、参数、返回、异常）
- 所有 IPC/服务方法标注契约锚点：`@see docs/api-contracts/...`
- 所有异常 throw/catch 必须有行内注释说明原因，禁止吞异常
- 纯逻辑（矩阵校验、prompt 拼接、orientation 判定）放 `lib/` 纯函数，不依赖框架运行时
- IPC handler 薄（Zod 校验 + 转调）、service 厚

---

## LTM 项目记录

工作开始：`python ltm/bin/ltm.py files --limit 10` + 读 `ltm/runtime/active-context.json`

保存检查点：`python ltm/bin/ltm.py checkpoint --from-json <path>`

Windows 上 `python_cmd` 查 `ltm/config.json`，可能是 `python` 或 `py`。

---

## 命令速查

```bash
# 子 agent 切换
@orchestrator-agent   # 编排 + CanvasPlan
@canvas-agent         # 画布 + 节点
@tooling-agent        # 主进程 + Tool + DB
@pm-agent             # 需求 + 契约 + 进度

# 斜杠命令
/orchestrator         # 同上，Claude Code slash command
/canvas
/tooling
/pm
/ltm-recall           # 恢复工作记忆
/ltm-checkpoint       # 保存检查点
```
