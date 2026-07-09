# Agent 对话 UI + Harness 完善实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一消息块 UI（两入口共用）+ 会话持久化恢复 + 分层上下文压缩与故障恢复。

**Architecture:** `shared/chat-blocks.ts` 定义块契约与纯 reducer（主进程与渲染层共用）；渲染层块组件库 + Zustand chatStore；主进程 compaction/recovery 纯函数接线进 context-loop 与 gateway-loop-model。

**Tech Stack:** TypeScript strict、Zustand v4、react-markdown + remark-gfm + rehype-highlight、Drizzle/better-sqlite3、vitest（`bun scripts/run-vitest.mjs run …`）。

**Spec:** `docs/superpowers/specs/2026-07-08-agent-chat-ui-harness-design.md`

---

### Task 1: shared/chat-blocks.ts 契约 + reducer（Phase 1）

**Files:**
- Create: `shared/chat-blocks.ts`
- Test: `tests/chat-blocks.test.ts`

- [x] **Step 1.1** 写失败测试 `tests/chat-blocks.test.ts`：
  - `applyAgentEvent` 对 `delta` 事件在尾部合并 text 块（streaming true）
  - `toolStarted` 追加 toolCall(running)；同 `callId` 的 `toolCompleted` 原位更新为 completed 且不新增块
  - `spawnChild` 工具标记 `isSubAgent: true`
  - `progress` 消息去重进 thinking 块；`用量：` 前缀转 usage 块
  - `responseReady(answer)` 置 turn completed、text 块 streaming false
  - `planReady` 追加 plan 块
  - `runFailed` 产出 error 块且 turn failed
  - 属性测试：同一事件序列两次 reduce 深度相等（引用无共享、结果确定）
- [x] **Step 1.2** `bun scripts/run-vitest.mjs run tests/chat-blocks.test.ts` → 预期 FAIL（模块不存在）
- [x] **Step 1.3** 实现 `shared/chat-blocks.ts`：`ChatBlock`/`ChatTurn`/`AgentChatEvent` 判别联合 + `createAssistantTurn(...)` + `applyAgentEvent(turn, event): ChatTurn`（纯函数，不 mutate 输入）+ `userTurnFromContent(...)` + `assistantTurnFromPersisted(...)`（content/planJson 降级合成）
- [x] **Step 1.4** 测试通过

### Task 2: api-contracts 登记（Phase 1）

**Files:**
- Modify: `docs/api-contracts/agents.md`（chat-blocks 契约、`chat.history` IPC、新增 errorClass）

- [x] **Step 2.1** 登记 `chat.history` 请求/响应、块契约共享真源说明、`gateway_retry_exhausted` / `compaction_failed` / `tool_failure_loop`
- [x] **Step 2.2** 如有契约文档测试（api-contract-docs.test）保持通过

### Task 3: 块组件库（Phase 2）

**Files:**
- Create: `desktop/src/renderer/src/chat/blocks/{TextBlock,ThinkingBlock,ToolCallBlock,PlanBlock,PermissionBlock,ErrorBlock,UsageFooter,TurnView}.tsx`
- Modify: `package.json`（新增 react-markdown、remark-gfm、rehype-highlight）
- Test: `tests/chat-blocks-ui.test.tsx`

- [x] **Step 3.1** `bun add react-markdown remark-gfm rehype-highlight`（workspace desktop）
- [x] **Step 3.2** 写失败 UI 测试：TurnView 按 blocks 顺序渲染；text 块渲染 Markdown（标题/代码块 class）；toolCall 块展开显示 resultSummary；permission 块点击批准触发回调；error 块显示 errorClass
- [x] **Step 3.3** 实现块组件（design token 类名，禁硬编码色值）；PlanBlock 内部复用 PlanCard（props 透传 plan + autoExecute + onApplyPlan）
- [x] **Step 3.4** 测试通过

### Task 4: chatStore + 两入口切换（Phase 2）

**Files:**
- Create: `desktop/src/renderer/src/chat/store/chat.store.ts`
- Modify: `desktop/src/renderer/src/chat/ChatPanel.tsx`、`desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx`
- Test: `tests/chat-store.test.ts`；更新 `tests/chat-ui.test.tsx`、`tests/canvas-chatbox.test.tsx`

- [x] **Step 4.1** 写失败 store 测试：send 创建 user turn + pending assistant turn；IPC 事件经 applyEvent 更新块；planReady 走 applyAgentPlanOnReady（autoExecute 时自动 apply）；approve/dismiss permission；restore 注水 turns
- [x] **Step 4.2** 实现 `createChatStore(deps)`（vanilla store，依赖注入 api/事件订阅，React 侧 hook 包装）
- [x] **Step 4.3** ChatPanel 切换：消息区 → TurnView 列表；保留输入区/@mention/自动执行开关；移除组件内 6 处 IPC 订阅与 toolTrace/permission 本地 state
- [x] **Step 4.4** CanvasChatBox 同步切换（FAB/拖拽/布局保留）
- [x] **Step 4.5** 更新 chat-ui / canvas-chatbox 测试断言至新 DOM；全部通过

### Task 5: blocks_json 持久化 + chat.history + 恢复（Phase 3）

**Files:**
- Create: `desktop/src/main/db/migrations/00XX_chat_blocks.sql`
- Modify: `desktop/src/main/db/repositories/chat-message.repo.ts`、`desktop/src/main/agent/orchestrator.ts`（终态写 blocks）、`desktop/src/main/ipc/canvas.handler.ts` 或新 `chat.handler.ts`、`shared/ipc.ts`、`desktop/src/preload/index.ts`
- Test: `tests/chat-history.test.ts`

- [x] **Step 5.1** migration 加 `blocks_json TEXT`；repo 加 `updateBlocks` / 读取映射（失败测试先行）
- [x] **Step 5.2** orchestrator consumeRunStream 终态：用 shared reducer 重放事件组装 turn，写 `blocks_json`
- [x] **Step 5.3** `chat.history` IPC：workflowId → ChatTurn[]（assistant 优先 blocks_json，降级 content/planJson；user 合成 text 块）
- [x] **Step 5.4** preload 暴露 `getChatHistory`；chatStore.restore 接线；画布打开时注水
- [x] **Step 5.5** 集成测试：跑一轮 stub run → 重建 store → restore 后 turns 含工具块与最终回答

### Task 6: compaction 分层压缩（Phase 4）

**Files:**
- Create: `desktop/src/main/agent/compaction.ts`
- Modify: `desktop/src/main/agent/context-loop.ts`（L1 接线 + 每轮预算检查触发 L2/L3）、`desktop/src/main/agent/gateway-loop-model.ts`（L3 摘要调用）
- Test: `tests/agent-compaction.test.ts`

- [x] **Step 6.1** 失败测试：L1 头尾保留裁剪；L2 折叠最旧完成工具对、受保护消息不动、token 下降；L3 网关成功路径写 compactionSummary、失败降级硬截断 + omittedMessages
- [x] **Step 6.2** 实现纯函数 `trimToolResult` / `foldHistory(state)` / `autoCompact(state, summarize)`；阈值 0.7 / 0.85 × maxContextTokens
- [x] **Step 6.3** context-loop 接线：写 tool 观测走 trimToolResult；轮前检查预算触发折叠/压缩并 yield progress
- [x] **Step 6.4** 测试通过 + 现有 agent-context-loop 回归通过

### Task 7: recovery 故障恢复（Phase 5）

**Files:**
- Create: `desktop/src/main/agent/recovery.ts`
- Modify: `desktop/src/main/agent/gateway-loop-model.ts`（重试/溢出接线）、`desktop/src/main/agent/context-loop.ts`（工具失败循环保护）
- Test: `tests/agent-recovery.test.ts`

- [x] **Step 7.1** 失败测试：瞬时失败重试 2 次成功；耗尽后 fallback；fallback 也败 → `gateway_retry_exhausted`；`context_length` 错误触发一次 L3 后重试；同 toolId 连续 3 败 → `tool_failure_loop` 终止
- [x] **Step 7.2** 实现 `withGatewayRetry(call, opts)`（退避 500/2000ms）+ `isContextOverflowError(err)` + 工具失败计数器
- [x] **Step 7.3** 接线 gateway-loop-model / context-loop；恢复动作 yield progress
- [x] **Step 7.4** 测试通过 + gateway-agent-loop-model 回归通过

### Task 8: 质检收口（Phase 6）

- [x] **Step 8.1** `bun run typecheck` 通过
- [x] **Step 8.2** 全量 `bun scripts/run-vitest.mjs run --reporter=dot` 通过（SQLite ABI 环境失败单独说明）
- [x] **Step 8.3** `docs/progress/project-log.md` 顶部加条目；`docs/progress/backlog.md` 登记本项目与状态
- [x] **Step 8.4** `git diff --check` 干净

## Self-Review

- Spec 覆盖：§1→Task1/2；§2→Task3/4；§3→Task5;§4→Task6;§5→Task7;§6/7/8→各 Task 测试步 + Task8。无缺口。
- 无占位符；类型/函数名跨任务一致（`applyAgentEvent`、`ChatTurn`、`trimToolResult`、`withGatewayRetry`）。
