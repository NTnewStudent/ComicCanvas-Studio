# Tools & Agents 契约

> 唯一真源类型：`shared/tools-agents.ts`。本文档登记工具集清单与执行语义。
> 关联：`shared/connection-matrix.ts`（连线校验）、`shared/plan.ts`（CanvasPlan）。

## 统一 Tool 接口

```typescript
interface Tool<I, O> {
  id: string                                   // "canvas.createNode"
  name: string
  description: string
  category: ToolCategory                       // canvas|file|web|model|custom
  source: ToolSource                           // builtin|plugin
  inputSchema: ZodSchema<I>
  isReadOnly(input: I): boolean
  isConcurrencySafe(input: I): boolean
  checkPermissions?(input: I, ctx): PermissionResult  // allow|ask|deny
  call(input: I, ctx): AsyncGenerator<ToolProgress, O>
  renderToolUseMessage(input: I): string
}
```

**核心原则**：用户手动操作与 Agent 自动编排走**同一套 Tool 实现**。区别只在触发源（人点按钮 vs LLM 产 tool_use），底层校验/队列/资产管线完全一致。

---

## Canvas 工具集

| 工具 ID | 只读 | 权限 | 作用 |
| :--- | :--- | :--- | :--- |
| `canvas.queryGraph` | ✓ | allow | 读当前画布图（节点/边快照） |
| `canvas.proposePlan` | ✓ | allow | 产出声明式 CanvasPlan（不直接改图） |
| `canvas.createNode` | ✗ | allow | 新增节点（type ∈ {text,image,video} 白名单） |
| `canvas.connectNodes` | ✗ | allow | 连线（必须经 `canConnect(u,d)` 校验） |
| `canvas.updateNodeData` | ✗ | allow | 改 prompt / 模型 / 参数 / label |
| `canvas.deleteNode` | ✗ | **ask** | 删节点（破坏性，默认询问） |
| `canvas.runNode` | ✗ | allow | 触发生成（入任务队列，返 `{ jobId }`，不同步等待） |

**约束**：
- `connectNodes` 消费 `shared/connection-matrix.ts`，非法连接拒绝。
- `runNode` 绝不同步等待结果；终态经 IPC 事件 `job.completed`/`job.failed` 回推。
- 节点位置拖拽（纯视觉，不影响生成语义）不走 Tool，由渲染层直接更新 store。

---

## Agent 工具集

| 工具 ID | 只读 | 权限 | 作用 |
| :--- | :--- | :--- | :--- |
| `agent.spawnSubAgent` | ✗ | allow | 在隔离上下文 spawn 子 agent 跑长任务，返回最终结果 |

### `agent.spawnSubAgent`

仅 super-agent（`allowedTools: '*'`）默认持有。用于长任务分解 / 上下文隔离 / 并行执行。

**输入**（`SpawnSubAgentInput`）：

```typescript
{
  spec: {
    task: string              // 子任务描述（初始 prompt）
    systemPrompt: string
    allowedTools: string[]    // 必须 ⊆ 父 agent；运行时求交集
    modelId?: string          // 缺省复用父 agent
    maxTurns: number
    effort?: 'low'|'medium'|'high'
  }
  depth?: number              // 运行时注入，调用方不填
}
```

**输出**（`SpawnSubAgentResult`）：

```typescript
{
  output: string
  status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded'
  turnsUsed: number
  droppedTools: string[]      // 越权被剔除的工具（审计）
  droppedSkills: string[]     // 越权被剔除的 skill（审计）
  trace: {
    runId: string
    parentRunId: string
    parentTraceId: string
    depth: number
    startedAt: number
    completedAt: number
    requestedTools: string[]
    effectiveTools: string[]
    requestedSkills: string[]
    effectiveSkills: string[]
    droppedTools: string[]
    droppedSkills: string[]
    status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded'
    error?: string
  }
  error?: string
}
```

**执行语义**：

1. 子 agent 在**隔离上下文**跑自己的主循环（AsyncGenerator），完成后只返回 `output`，不污染父对话。
2. MVP 用**内联定义**模式，不依赖 Registry。后续可加 `agentId` 查表模式。
3. 子 agent 也可调用 Canvas 工具集（在其 `allowedTools` 交集内），实现"子 agent 自动操作画布"。

**安全红线（运行时强制）**：

| 红线 | 实现 |
| :--- | :--- |
| 权限继承 | 子 agent `allowedTools`/`allowedSkills` = 父 ∩ 请求；越界拒绝并记录 → `droppedTools` / `droppedSkills` |
| 递归深度 | `depth > MAX_SPAWN_DEPTH(2)` 时，该 agent 不持有 spawnSubAgent 工具 |
| turn 预算 | 独立 `maxTurns`，超出 → `status='max_turns_exceeded'` 并终止 |
| 可中止 | 走任务队列语义，用户可中止 → `status='aborted'` |

---

## 权限决策

- `allow` / `ask` / `deny`，带 `decisionReason`。
- 破坏性工具（`deleteNode`、清空画布、删资产）默认 `ask`。
- 插件 Tool 默认 `ask`，用户在设置页确认信任后改 `allow`。

## 热拔插

- Tool 经 ToolRegistry（运行时单例）`register`/`unregister`，禁用后立即对所有 agent 生效。
- 插件 Tool 存 DB `tools` 表，主进程启动加载。
- **注**：Registry 服务于 UI 管理与按名查找；`spawnSubAgent` 内联模式不依赖它即可执行。

## 红线

- ❌ 工具 `call` 返回里夹带可执行代码。
- ❌ 工具内直连渲染进程（只能经服务层 / IPC）。
- ❌ 子 agent 提权（工具集超出父级）。
- ❌ `runNode` 同步阻塞等待生成结果。
