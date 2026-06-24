# Design Document — Canvas Agent Orchestration

> Source of truth：同目录 `requirements.md`。设计围绕 R1–R6 + Property 1–5，复用 hjwall REQ-080/REQ-0761 范式与 cc-haha Agent 内核思想，适配 Electron + SQLite + IPC。

## Overview

四道闸：① **Connection_Matrix 共享契约**（前后端唯一真源）② **Composed_Prompt 确定性构造**（snapshot-at-submit）③ **全量异步任务队列**（同步入口仅入队，IPC 回推终态）④ **本地资产管线**（落盘 + 相对路径 + orientation + 安全协议）。Agent 编排在主进程以 AsyncGenerator 主循环 + Canvas 工具集产出声明式 Plan，前端清洗后 applyPlan + PlanRunner 串行执行。

## Architecture

```mermaid
sequenceDiagram
  autonumber
  participant R as Renderer (Canvas)
  participant P as preload (IPC bridge)
  participant O as Orchestrator (main/agent)
  participant T as Canvas Tools (main/tools)
  participant Q as JobQueue (SQLite)
  participant W as JobWorker
  participant PV as Provider (model gateway)
  participant FS as appData/assets
  participant DB as SQLite

  R->>P: canvas.chatSend(message, graphSnapshot)
  P->>O: invoke
  O-->>R: { taskId, messageId, status:'pending' }   %% ≤1s, 无 Plan
  O->>T: canvas.proposePlan(...)
  T-->>O: CanvasPlan(JSON)
  O->>O: sanitizePlan(白名单 + 矩阵 + 去代码)
  O-->>R: IPC event canvas_orchestrate.completed
  R->>P: canvas.chatGetPlan(messageId)
  P-->>R: CanvasPlan
  R->>R: applyPlan()（白名单+矩阵二次校验, 一条 undo, 分层布局）
  R->>R: PlanRunner.start()（串行 runSteps）
  loop 每个 runStep
    R->>P: canvas.runNode(nodeId, action)
    P->>Q: enqueue job + 返回票据
    Q->>W: consume
    W->>PV: invoke(composedPrompt, refs)
    PV-->>W: bytes + (w,h)
    W->>FS: 落盘 assets/<hash>.<ext>
    W->>W: classifyOrientation(w,h)
    W->>DB: update job result + 相对路径 + orientation
    W-->>R: IPC event job.completed/failed
    R->>R: 节点刷新; 终态注入 PlanRunner → 下一步
  end
```

## Components and Interfaces

### Connection_Matrix（`shared/connection-matrix.ts`，R2 / Property 1）

```ts
export type NodeType = 'text' | 'image' | 'video'
export const NODE_CONNECTION_MATRIX: Readonly<Record<NodeType, ReadonlyArray<NodeType>>> = {
  text:  ['image', 'video'],
  image: ['image', 'video'],
  video: ['video'],
}
export function canConnect(u: NodeType, d: NodeType): boolean {
  return NODE_CONNECTION_MATRIX[u]?.includes(d) ?? false
}
```
前端 `onConnect` 与后端图校验器都 import 同一函数；PBT 穷举 3×3 断言等价。

### CanvasPlan + 清洗器（`shared/plan.ts` + `main/agent/sanitizePlan.ts`，R1 / Property 5）

```ts
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
`sanitizePlan`：① 节点类型 ∉ 白名单 → 剔除；② 边不在矩阵 / 端点缺失 → 剔除；③ data 深扫描，命中脚本/函数字符串模式 → 剔除该字段；④ action ∉ 白名单 → 剔除该 step。所有剔除记入 `dropped`。

### Composed_Prompt（`shared/composed-prompt.ts` 纯函数，R5 / Property 2）

```ts
function composeFinalPrompt(graph, nodeId): { composedPrompt: string; referenceImages: AssetRef[]; referenceVideos: AssetRef[] }
```
按 `edge.createdAt` 升序取上游 text，`\n` 拼接；上游含 image/video 时前置固定中文指令；末尾追加节点自身 prompt（自身为空不补尾随 `\n`）。前端预览复用同函数 → 字节等价。

### JobQueue + JobWorker（`main/jobs/`，R4 / Property 3）

- `jobs` 表：`id, type(stepType), status, payload(json), result(json|null), error_class, created_at, updated_at`。
- `enqueue(payload)`：写 pending 行 + 内存调度，返回票据。**绝不在此调模型**。
- Worker：取 pending → processing → 调 provider → 落资产 → 写 completed/failed → emit IPC。
- 终态唯一：状态机保证 completed/failed 只发一次（幂等写）。
- 进程重启恢复：启动时把 `processing` 复位为 pending 重排（或标 failed，依配置）。

### Asset Pipeline（`main/assets/`，R6 / Property 4）

- `saveBytes(buf, ext) → relPath`，文件名用内容 hash。
- `classifyOrientation(w,h)`：纯函数，三段定义，非正整数抛 `metadata_missing`。
- 自定义协议 `cc-asset://<relPath>` 经 `protocol.handle` 解析，做 `appData/assets/` 越界校验。
- 渲染层只拿 `cc-asset://` URL，不拿绝对路径。

### PlanRunner（`renderer/canvas/lib/plan-runner.ts`，R3）

纯状态机：`start()` 触发第一步；`notifyNodeTerminal(nodeId, phase)` 命中当前步才推进/短路；failed 短路保留剩余步骤。终态由 IPC 事件注入，模块不订阅事件源。

### Orchestrator 主循环（`main/agent/`，R1）

AsyncGenerator 状态机（参考 cc-haha `query()`）：消息准备 → 流式模型调用 → 工具编排（Canvas 工具集，只读并行/写入串行）→ 状态更新。编排任务本身作为一个 job 异步执行，IPC 回推。

## Data Models

| 表 | 关键列 | 备注 |
| :--- | :--- | :--- |
| `jobs` | `status, type, payload, result, error_class` | 持久化队列 |
| `chat_message` | `role, content, plan_json, apply_status, auto_execute, job_id, error` | 编排对话 |
| `workflow_version` | `graph(json)` | 画布图快照 |
| `asset` | `rel_path, media_type, width, height, orientation` | 本地资产；rel_path 相对 appData/assets |
| `asset_folder` | `name, parent_id, type, rel_path` | 资产文件夹（用户自定义嵌套） |

## Correctness Properties

### Property 1: 矩阵等价 — 单元 PBT，穷举 3×3。**Validates: R2.1, R2.2**
### Property 2: 确定性 prompt — 单元 PBT，随机 text + 顺序，断言恒等 + 前后端字节等价。**Validates: R5.2, R5.3**
### Property 3: 同步无资产 + 终态唯一 — 集成 + 单元，响应深扫描 + jobId 事件计数。**Validates: R4.2, R4.3**
### Property 4: orientation 完整性 — 单元 PBT。**Validates: R6.2, R6.4**
### Property 5: Plan 安全 — 单元，注入非法节点/边/代码必被剔除。**Validates: R1.3, R2, R3.3**

## Testing Strategy

- 纯函数（矩阵、prompt、orientation、sanitizePlan、plan-runner）→ Vitest + fast-check（每属性 ≥100 次）。
- JobQueue/Worker → Vitest（Node），provider 用 stub。
- 画布交互 → Vitest + @testing-library/react。
- 端到端「文本→图→视频」→ 集成脚本（provider stub），核对资产相对路径 + orientation。

## Migration & Cutover

| 阶段 | 内容 | 可逆性 |
| :--- | :--- | :--- |
| A | `shared/` 契约（矩阵/Plan/composed-prompt 纯函数 + 测试） | 纯新增 |
| B | SQLite schema + 仓储 + JobQueue 骨架 | 纯新增 |
| C | Provider 适配 + 资产管线 + IPC 事件 | flag 控制 |
| D | 画布节点 + 手动生成 + 连接校验 + prompt 预览 | flag 控制 |
| E | Orchestrator 主循环 + Canvas 工具集 + proposePlan + sanitize | flag 控制 |
| F | applyPlan + PlanRunner 串行执行 + 端到端 | flag 控制 |
