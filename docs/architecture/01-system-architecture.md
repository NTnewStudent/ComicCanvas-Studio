# 系统架构 — ComicCanvas Studio

> 融合 hjwall（画布/编排/资产）与 cc-haha（Agent 内核/Tool/Skills），落地为 Electron + TS + SQLite 桌面客户端。

## 1. 总体架构

```
┌──────────────────────────── Electron App ────────────────────────────┐
│                                                                       │
│  Renderer (React 18 + Vite + @xyflow/react)        [sandboxed]        │
│   ├─ canvas/        画布 / 节点 / 连线 / 对话区                         │
│   ├─ lib/           plan-applier · plan-runner · composed-prompt(纯函数) │
│   └─ stores/hooks   Zustand + TanStack Query                          │
│            │  preload(contextBridge 白名单 IPC)  ▲ IPC 事件             │
│            ▼                                     │                     │
│  Main (Node 20+)                                                      │
│   ├─ agent/         Orchestrator：AsyncGenerator 主循环 + sanitizePlan │
│   ├─ tools/         统一 Tool 接口 + Canvas 工具集                      │
│   ├─ jobs/          JobQueue(持久化) + JobWorker                       │
│   ├─ providers/     模型适配（image/video/text）                       │
│   ├─ assets/        落盘 + orientation + cc-asset:// 协议               │
│   ├─ db/            Drizzle 仓储（SQLite，dialect 可切 MySQL）           │
│   └─ ipc/           ipcMain.handle（Zod 校验）                         │
│                                                                       │
│  shared/  connection-matrix · plan · nodes · ipc · composed-prompt    │
│  本地存储：SQLite(app.db) + appData/assets/                            │
└───────────────────────────────────────────────────────────────────────┘
```

## 2. 关键决策与理由

| 决策 | 选择 | 理由 | 与参考差异 |
| :--- | :--- | :--- | :--- |
| 桌面外壳 | Electron + TS | 用户指定；Node 生态成熟、bundling 可控 | cc-haha desktop 用 Tauri；这里选 Electron 便于 Node 侧跑 Agent |
| DB | SQLite + Drizzle，抽象可切 MySQL | local-first 零外部依赖，打包简单 | hjwall 用 MySQL+TypeORM（服务端） |
| 队列 | 进程内持久化队列（SQLite） | 桌面无 Redis | hjwall 用 BullMQ+Redis |
| 实时 | Electron IPC 事件 | 桌面进程内通信 | hjwall 用 WS `/ws/task` |
| 资产 | 本地落盘 + 安全协议 | 桌面无对象存储 | hjwall 用 COS + 加签 URL |
| 编排 | 声明式 Plan(JSON) | 安全、可预览、可一次 undo | 同 hjwall REQ-080 |
| Agent | AsyncGenerator 状态机 + 统一 Tool | 流式、可恢复、最小抽象 | 同 cc-haha 内核思想 |

## 3. 核心链路（用户需求落地）

「用户用自然语言 → Agent 自动生成节点 → 自动连线 → 自动执行任务」：

1. 用户在画布对话区发消息 → `canvas.chatSend`（异步入队，≤1s 返回票据）。
2. Orchestrator 主循环调 `canvas.proposePlan` 产出 `CanvasPlan` → `sanitizePlan` 清洗。
3. IPC 事件回推 → 前端 `chatGetPlan` 取 Plan。
4. `applyPlan`：白名单 + 矩阵二次校验 + 分层布局 + 一条 undo。
5. `PlanRunner` 串行执行 `runSteps`：每步 `canvas.runNode` → 入 JobQueue → JobWorker 调 provider → 落资产 → IPC 终态 → 下一步。
6. 节点实时刷新（生图/生视频）。

## 4. 安全要点

- 渲染进程沙箱：`contextIsolation/sandbox: true`、`nodeIntegration: false`，仅 preload 白名单 API。
- Plan 纯声明式，清洗器剔除任何可执行代码字符串。
- 资产协议做路径越界校验，限制在 `appData/assets/`。
- 模型 API key 走 OS 安全存储，不落明文、不进日志、不进 LTM。

## 5. 不变量（端到端可断言，参考 hjwall INV）

1. 连接矩阵前后端等价（唯一真源）。
2. Composed_Prompt 确定性、前后端字节等价、可重放。
3. 生成同步响应无资产字段；jobId 终态事件唯一。
4. 生成记录 orientation 完整且合法。
5. Plan 仅含白名单节点/合法边/无代码。

## 6. 里程碑

M1 Electron 骨架 + SQLite + DB 抽象 → M2 画布 + 手动生成 → M3 队列 + provider + 资产 + IPC → M4 Agent + Tool + Plan + applyPlan + PlanRunner → M5 Agent 进阶（super-agent / spawnSubAgent / 工具·agent 管理 UI）端到端。详见 `.claude/specs/canvas-agent-orchestration/tasks.md`。
