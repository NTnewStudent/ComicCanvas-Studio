# Agent 对话 UI + Harness 工程完善设计

Date: 2026-07-08

## 目标

参考 cc-haha 桌面端的消息块体系与 Agent 框架，把 ComicCanvas 的 Agent 对话升级为：

1. **统一消息块 UI**：`ChatPanel` 与 `CanvasChatBox` 共用同一套块渲染与会话 store。
2. **会话持久化**：assistant 回合以块结构落库，重开画布可恢复上次会话。
3. **更强 harness**：分层上下文压缩（工具结果裁剪 → 历史折叠 → AutoCompact）与故障恢复（网关重试、token 溢出反应式压缩、工具失败循环保护）。

## 决策记录（来自澄清）

- UI 与 harness 并重，契约先行分阶段推进（方案 A）。
- 统一消息块体系 + chatStore，两个入口共用渲染。
- 先做会话持久化 + 单会话恢复；多 Tab 多会话后置。
- Harness 本轮只做分层压缩 + 故障恢复；提示词缓存边界与流式工具执行不做。
- 渲染深度：Markdown + 代码高亮 + 思考块折叠；Mermaid/Diff 不做。

## 1. 共享块契约（唯一真源）

新建 `shared/chat-blocks.ts`：

```typescript
export type ChatBlock =
  | { kind: 'text'; markdown: string; streaming: boolean }
  | { kind: 'thinking'; lines: string[] }
  | { kind: 'toolCall'; callId: string; toolId: string;
      status: 'running' | 'completed' | 'failed' | 'denied';
      inputSummary?: string; resultSummary?: string; isSubAgent: boolean }
  | { kind: 'plan'; planId: string }
  | { kind: 'permission'; callId: string; toolId: string; reason: string; resolved: boolean }
  | { kind: 'error'; errorClass: string; message: string; retryable: boolean }
  | { kind: 'usage'; summary: string }

export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  blocks: ChatBlock[]
  runId?: string
  messageId?: string
  status: 'pending' | 'streaming' | 'completed' | 'failed'
  createdAt: number
}
```

**块组装是纯 reducer**：`applyAgentEvent(turn, event): ChatTurn`。事件为现有 IPC 事件的判别联合（`agent.delta`、`agent.toolStarted`、`agent.toolCompleted`、`agent.permissionRequired`、`agent.responseReady`、`canvas.planReady`、`job.progress`）。**不新增流式 IPC 通道**：

- 渲染层 chatStore 订阅现有 IPC 事件，用 reducer 实时组装块。
- 主进程 orchestrator 在 run 终态用同一 reducer 组装，序列化进 `chat_messages.blocks_json`。
- 两侧结构一致性用属性测试保证（同一事件序列 → 深度相等的 blocks）。

reducer 关键规则：

- `agent.delta` 追加/合并到尾部 `text` 块（`streaming: true`）；终态时置 `streaming: false`。
- `job.progress` 的 message 进 `thinking` 块（去重追加）；`用量：` 前缀的 progress 行转为 `usage` 块。
- `toolStarted` 新增 `toolCall` 块（`running`）；`toolCompleted` 按 `callId` 原位更新状态与 `resultSummary`；`toolId === 'agent.spawnChild'` 标记 `isSubAgent: true`。
- `permissionRequired` 追加 `permission` 块；批准/拒绝后置 `resolved: true`。
- `responseReady`（answer/clarification）落最终 `text` 块并置 turn `completed`；`planReady` 追加 `plan` 块。
- 失败（`job.failed` 对应 agent run、批准失败等）产出 `error` 块并置 turn `failed`。

## 2. UI 轨：块组件库 + chatStore

```
desktop/src/renderer/src/chat/
├── store/chat.store.ts        # Zustand vanilla store（可测），React 侧 useChatStore 包装
├── blocks/
│   ├── TextBlock.tsx          # react-markdown + remark-gfm + rehype-highlight
│   ├── ThinkingBlock.tsx      # 折叠；运行中自动展开，终态默认收起
│   ├── ToolCallBlock.tsx      # 状态图标 + 可展开输入/结果摘要（替代 AgentToolPill 场景）
│   ├── PlanBlock.tsx          # 按 planId 拉取 plan，内部复用现有 PlanCard
│   ├── PermissionBlock.tsx    # 内联批准/拒绝（替代全屏 AgentPermissionModal 场景）
│   ├── ErrorBlock.tsx
│   ├── UsageFooter.tsx
│   └── TurnView.tsx           # 渲染一个 ChatTurn 的 blocks 序列
```

- chatStore 状态：`turns: ChatTurn[]`、`busy`、`pendingRun`（runId/messageId/jobId）、`plan`、`autoExecute`。动作：`send`、`applyEvent`（内部走 shared reducer）、`approvePermission`、`dismissPermission`、`restore(workflowId)`、`clearView`。
- IPC 订阅收敛到 store 初始化处一份（替代目前两个组件各订阅 6 个事件的重复实现）。
- `ChatPanel` / `CanvasChatBox` 变薄壳：输入框、@mention、FAB 拖拽、布局保留；消息区统一渲染 `TurnView`。
- Task 60 自动 apply（`applyAgentPlanOnReady`）逻辑移入 store 的 `planReady` 处理路径，行为不变。
- 新依赖：`react-markdown`、`remark-gfm`、`rehype-highlight`。

## 3. 会话持久化与恢复（单会话）

- migration：`chat_messages` 加 `blocks_json TEXT` 列；仓储层加 `updateBlocks(id, blocksJson)` 与读取映射。
- 主进程在 run 终态（completed/failed）把 assistant turn 的块 JSON 写入对应 assistant 消息行。
- 新 IPC `chat.history`：请求 `{ workflowId: string }` → 响应 `ChatTurn[]`（user turn 由 content 合成单 text 块；assistant turn 优先用 `blocks_json`，缺失时按 content/planJson 降级合成）。先在 `docs/api-contracts/agents.md` 登记，再开通道。
- 打开画布或 Chat 页时 `restore(workflowId)` 拉历史；「清空」仅清 UI，不删历史。

## 4. Harness：分层压缩

`desktop/src/main/agent/compaction.ts`（纯函数）：

| 层 | 触发 | 行为 |
| :--- | :--- | :--- |
| L1 工具结果裁剪 | 每轮写入 tool 观测时 | 头 1200 + 尾 400 字符保留，中间替换 `…[truncated N chars]…` |
| L2 历史折叠 | `tokenEstimate > 0.7 × maxContextTokens` | 从最旧开始，把已完成的 assistant.toolCalls + tool 结果对折叠为单行 `[tool <id>: <首行摘要>]` system 注记，直到低于阈值或无可折叠项 |
| L3 AutoCompact | 折叠后仍 `> 0.85 × maxContextTokens` | 调用当前网关把前缀对话摘要为 `compactionSummary`（沿用现有字段），丢弃已折叠消息，保留最近 4 轮原文；网关失败降级为硬截断并累计 `omittedMessages` |

不变量：

- system 提示、当前用户消息、未完成（running/approval）的工具调用永不折叠或丢弃。
- 每层执行后 `tokenEstimate` 严格不增；L2/L3 执行后必须下降。
- 压缩动作通过 progress 事件可见（进 thinking 块）。

## 5. Harness：故障恢复

`desktop/src/main/agent/recovery.ts` + `gateway-loop-model.ts` 接线：

- **网关瞬时失败**（超时/网络/5xx）：指数退避重试 2 次（500ms/2000ms）→ 仍失败走现有 fallback 网关 → 全部失败产出 `gateway_retry_exhausted` 错误块。
- **Token 溢出**（错误信息含 `context_length` / `token` 溢出类）：每 run 至多一次触发反应式 L3 压缩后重试原请求；再失败则报 `compaction_failed`。
- **工具失败循环保护**：同一 toolId 连续失败 3 次 → 终止 run，产出 `tool_failure_loop` 错误块（消息含最后一次失败原因）。
- 恢复动作全部 yield progress（如「网关超时，正在重试(1/2)…」「上下文超限，压缩后重试…」），保证 UI 可见。

稳定 errorClass：`gateway_retry_exhausted`、`compaction_failed`、`tool_failure_loop`。

## 6. 分阶段

```
Phase 1  shared/chat-blocks.ts + reducer + 属性测试 + api-contracts 登记
Phase 2  块组件库 + chatStore + 两入口切换（UI 轨）      ┐ Phase 1 后可并行
Phase 4  compaction 分层压缩 + 测试（harness 轨）        ┘
Phase 3  blocks_json 持久化 + chat.history + 会话恢复（UI 轨）
Phase 5  recovery 故障恢复 + 测试（harness 轨）
Phase 6  质检收口：bun run typecheck + 全量 vitest + docs/progress 双写
```

## 7. 测试策略

- reducer 属性测试：随机事件序列下主/渲染两侧组装结果深度相等；块顺序稳定；`callId` 幂等更新。
- 压缩不变量测试：受保护消息永不丢；token 估算单调下降；L3 网关失败降级路径。
- 恢复测试：mock 网关按脚本失败/成功，断言重试次数、fallback、错误块产出。
- UI（jsdom）：TurnView 渲染各块；Markdown/代码高亮；权限内联批准流；会话恢复后历史可见。
- 回归：现有 chat-ui、canvas-chatbox、agent-plan-apply-run、gateway-loop 测试全部保持通过（迁移期允许改断言以适配新 DOM 结构，不允许删行为覆盖）。

## 8. 错误处理

- 所有分支失败必须产出可见块（error/thinking），`job.failed` 不得成为唯一终态信号。
- 新增 errorClass 全部登记在 `docs/api-contracts/agents.md`。

## 9. 非目标

- 多 Tab 多会话、跨 workflow 会话切换 UI。
- 系统提示词缓存边界、流式中启动工具（StreamingToolExecutor）。
- Mermaid、Diff 视图、图片画廊。
- IM 通道、Computer Use、LTM。
- 不改 CanvasPlan 契约、连接矩阵、Job 队列语义。
