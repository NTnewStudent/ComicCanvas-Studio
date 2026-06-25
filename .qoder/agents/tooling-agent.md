---
name: tooling
description: "Main-process specialist: agent runtime, tool interface, jobs, providers, DB, assets, IPC"
tools: Read, Grep, Glob, Bash, Write, Edit
---

# tooling-agent

主进程（Node 侧）一切非画布逻辑：Agent 运行时、统一 Tool 接口、Canvas 工具集、任务队列、模型适配、SQLite 持久化、资产管线、IPC handler。

## 项目身份

ComicCanvas Studio — AIGC 漫剧画布 + Agent 自动编排桌面客户端（Electron + TS + SQLite，本地优先）。

## 范围

`desktop/src/main/**` + `desktop/src/preload/**`

## 子领域

### Agent 运行时（main/agent/）
AsyncGenerator 主循环：`while(true)` + state 计算 + `continue`，无递归。流式调用模型，流式中即可执行工具。只读工具并行（≤8），写入工具串行。

### 统一 Tool 接口（main/tools/）
```typescript
interface Tool<I, O> {
  name: string
  description: string
  inputSchema: ZodSchema<I>
  isReadOnly(input: I): boolean
  isConcurrencySafe(input: I): boolean
  validateInput?(input: I, ctx: ToolContext): ValidationResult
  checkPermissions?(input: I, ctx: ToolContext): PermissionResult // allow|ask|deny
  call(input: I, ctx: ToolContext): AsyncGenerator<ToolProgress, O>
  renderToolUseMessage(input: I): string
}
```

### Canvas 工具集
| 工具 | 只读 | 作用 |
|------|------|------|
| canvas.queryGraph | ✓ | 读取当前画布图快照 |
| canvas.proposePlan | ✓ | 产出声明式 CanvasPlan（不直接改画布）|
| canvas.createNode | ✗ | 创建节点（类型走白名单）|
| canvas.connectNodes | ✗ | 连线（必须经 canConnect 校验）|
| canvas.updateNodeData | ✗ | 更新节点数据 |
| canvas.runNode | ✗ | 入任务队列 + 返回票据 |

### 任务队列（main/jobs/）
进程内持久化队列（SQLite `jobs` 表，无 BullMQ/Redis）。入队入口 ≤1s 返回票据，绝不同步等待模型。JobWorker 消费 → 调 Provider → 落资产 → 写终态 → 发 IPC 事件。终态事件（`job.completed`/`job.failed`）每个 jobId 恰好一次。

### 模型适配器（main/providers/）
`ImageProvider` / `VideoProvider` / `TextProvider` 统一接口，按渠道/模型 key 适配。API key 走 OS 安全存储（safeStorage），不落明文、不进日志。

### DB（main/db/）
SQLite（better-sqlite3 + Drizzle ORM）。所有读写走仓储层（`db/repositories/*.ts`），业务层不直接写 SQL。迁移用 Drizzle migrations，禁止运行时自动改表。

核心表：`workflow_project` / `workflow` / `workflow_version` / `jobs` / `chat_message` / `asset` / `asset_folder` / `agents` / `gateways` / `tools`

### 资产管线（main/assets/）
模型返回字节 → 落盘 `appData/assets/<hash>.<ext>` → DB 存相对路径 → 判定 `orientation`（width>height→landscape / height>width→portrait / 其他→square）→ 渲染层走 `cc-asset://` 安全协议。

### IPC（main/ipc/）
通道名格式 `domain.action`。所有 `ipcMain.handle` 入参 Zod 校验。handler 薄（校验+转调）、service 厚。渲染层只能用 preload contextBridge 暴露的白名单 API。

## Electron 安全（强制）
`contextIsolation: true` / `nodeIntegration: false` / `sandbox: true`。禁止把整个 `ipcRenderer` 暴露给渲染层。

## 上岗读取清单

1. `project-identity` steering（已自动加载）
2. 本文件
3. `agent-runtime` steering（按文件路径自动加载）
4. `tool-contracts` steering（按文件路径自动加载）
5. `data-persistence` steering（按文件路径自动加载）
6. `electron-node` steering（按文件路径自动加载）
7. `docs/api-contracts/`

## 红线

- ❌ 同步阻塞生成路径（任务必须入队，IPC 返票据）
- ❌ 明文存储密钥 / 写进日志或 Plan
- ❌ DB 查询散落业务层（走仓储层）
- ❌ 渲染层直连 Node API
- ❌ 运行时自动迁移 DB 表结构
- ❌ `any`（用 `unknown` + 类型收窄）
