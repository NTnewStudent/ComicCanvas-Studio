---
description: "Project identity, architecture, agent roles, core contracts and global prohibitions for ComicCanvas Studio"
alwaysApply: true
---

# ComicCanvas Studio — 项目身份

**AIGC 漫剧画布 + Agent 自动编排桌面客户端**（Electron + TypeScript + Node.js + SQLite，本地优先）

两条核心能力：
1. **画布**：用户手动操作 React Flow 画布，节点化生成图片 / 视频（text/image/video 三节点）
2. **Agent**：自然语言驱动 Agent 自动「生成节点 → 连线 → 串行执行任务」

产品定位以「漫剧（comic drama）制作」为主——围绕「文本 → 生图 → 生视频」这条漫剧生产链路组织画布与 Agent 能力。

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
> ⚠️ 资产不走 COS：生成字节落本地 `appData/assets/`，DB 存相对路径，渲染走 `cc-asset://` 安全协议。

---

## Agent 角色分工

| Agent | 角色 | 激活方式（Kiro） |
| :--- | :--- | :--- |
| **orchestrator-agent** | 自然语言 → 声明式 Canvas Plan，编排全链路 | `#agent-orchestrator` |
| **canvas-agent** | 渲染层画布 / 节点 / 连线 / React Flow 实现 | `#agent-canvas` |
| **tooling-agent** | Agent 运行时 / Tool 接口 / 任务队列 / 模型适配 / DB | `#agent-tooling` |
| **pm-agent** | 需求拆解、契约协调、进度、测试 | `#agent-pm` |

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

### IPC 通道（`shared/ipc.ts`，命名格式 `domain.action`）

- `canvas.*`：chatSend / chatGetPlan / runNode / saveGraph / loadGraph
- `job.*`：subscribe / progress / completed / failed
- `settings.*`：getGateways / saveGateway / getAgents / saveAgent / getTools / toggleTool
- `asset.*`：getFolders / createFolder / moveAsset / deleteAsset

---

## 共享真源（Source of Truth）

| 文档 | 用途 | 写入方 |
| :--- | :--- | :--- |
| `docs/api-contracts/` | IPC / 服务契约 | pm-agent 起草，tooling-agent 主改 |
| `global/design/DESIGN.md` | 全局 UI/UX 设计系统、前端视觉 token | canvas-agent 主消费，pm-agent 协调 |
| `shared/connection-matrix.ts` | 节点连接矩阵 | tooling-agent + canvas-agent |
| `shared/plan.ts` | 声明式 Canvas Plan 类型 | orchestrator-agent |
| `specs/` | 项目级 requirements / design / tasks spec | pm-agent 主改，全体消费 |
| `docs/progress/` | 需求 / 迭代 / 测试报告 | pm-agent |
| `docs/architecture/` | 系统架构 | 全体 |

---

## 全局禁止

- ❌ Canvas Plan 里出现任何可执行代码 / 脚本字符串
- ❌ 前后端各自维护连接矩阵副本（只消费 `shared/connection-matrix.ts`）
- ❌ 生图/生视频走同步阻塞路径（必须入任务队列，IPC 事件回推终态）
- ❌ `contextIsolation: false` 或 `nodeIntegration: true`
- ❌ TypeScript `any`（用 `unknown` + 类型收窄）
- ❌ 未在 `docs/api-contracts/` 登记契约就开新 IPC 通道
- ❌ 密钥明文存储 / 写进日志 / 写进 LTM
- ❌ DB 查询散落业务层（走仓储层）
- ❌ 渲染层 `setInterval` 轮询资产状态
- ❌ 直接引用 hjwall / cc-haha 源码文件（仅参考其设计与契约）
- ❌ 子 agent 提权（工具集超出父 agent）/ 递归深度超 `MAX_SPAWN_DEPTH(2)`

---

## 编码规范快查

- 所有导出函数/类/方法必须有 JSDoc（意图、参数、返回、异常）
- 所有 IPC/服务方法标注契约锚点：`@see docs/api-contracts/...`
- 所有异常 throw/catch 必须有行内注释说明原因，禁止吞异常
- 纯逻辑放 `lib/` 纯函数，不依赖框架运行时
- IPC handler 薄（Zod 校验 + 转调）、service 厚

---

## LTM 项目记录

```bash
# 回忆上次工作
python ltm/bin/ltm.py files --limit 10
python ltm/bin/ltm.py sessions --limit 5

# 保存检查点
python ltm/bin/ltm.py checkpoint --from-json <path>

# Windows 上查 ltm/config.json 的 python_cmd（可能是 python 或 py）
```

---

## 上岗前读取清单（按角色）

| 角色 | 需读取的 Kiro 指引 |
| :--- | :--- |
| orchestrator-agent | 本文件 + `#agent-orchestrator` + `specs/canvas-agent-orchestration/` |
| canvas-agent | 本文件 + `#agent-canvas` + `global/design/DESIGN.md` + `shared/` |
| tooling-agent | 本文件 + `#agent-tooling` + `docs/api-contracts/` |
| pm-agent | 本文件 + `#agent-pm` + `specs/` + `docs/progress/` |
