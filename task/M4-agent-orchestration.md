# PRD M4 — Agent 编排

> **里程碑目标**：Orchestrator 主循环可用，自然语言驱动 Canvas 工具集产出 Plan，前端 applyPlan + PlanRunner 串行执行。
> **前置条件**：M3 全部 ✅
> **状态**：⬜ 未开始

---

## 需求列表

### REQ-040 Orchestrator AsyncGenerator 主循环 ⬜

**User Story**：作为系统，orchestrator-agent 需要一个 AsyncGenerator 主循环，接收自然语言消息后产出 CanvasPlan。

**Acceptance Criteria**：
1. THE orchestrator SHALL 以 `async function* orchestrate(message, graphSnapshot)` 形式实现，可 yield 流式中间状态。
2. WHEN 收到消息，THE 主循环 SHALL：消息准备 → 流式模型调用 → 工具编排 → 产出 Plan。
3. THE 主循环 SHALL 在 `canvas.chatSend` IPC 调用后 ≤1s 内返回 `{ taskId, messageId, status:'pending' }`，Plan 异步产出后 emit `canvas_orchestrate.completed` IPC 事件。
4. 编排任务本身入 `jobs` 队列（type=`orchestrate`），不阻塞 IPC 入口。
5. 无 `any`，参数类型严格。

**任务**：
- [ ] `desktop/src/main/agent/orchestrator.ts` — AsyncGenerator 主循环
- [ ] `canvas.chatSend` IPC handler 入队 + 立即返回
- [ ] `canvas_orchestrate.completed` IPC 事件 emit
- [ ] 单元测试：mock 模型，验证 ≤1s 返回 + 异步 Plan 产出

---

### REQ-041 Canvas 工具集（Tool 接口）⬜

**User Story**：作为 orchestrator，我需要一套符合统一 Tool 接口的 Canvas 工具，工具集内只读并行、写入串行。

**Acceptance Criteria**：
1. SHALL 实现 7 个 Canvas 工具（见 `docs/api-contracts/tools-agents.md`）：`canvas.getGraph / canvas.addNode / canvas.addEdge / canvas.removeNode / canvas.removeEdge / canvas.updateNodeData / canvas.proposePlan`。
2. 每个 Tool SHALL 符合 `ToolDefinition` 接口：`{ name, description, inputSchema(Zod), isReadOnly, isConcurrencySafe, call: AsyncGenerator, checkPermissions }`。
3. 只读工具（`isReadOnly: true`）允许并行调用；写入工具强制串行。
4. `checkPermissions` 校验当前 agent 的 `allowedTools` 包含该工具名。

**任务**：
- [ ] `desktop/src/main/agent/tools/canvas/` — 7 个工具文件
- [ ] `desktop/src/main/agent/tools/registry.ts` — 工具注册表
- [ ] 并行/串行调度逻辑
- [ ] 单元测试：checkPermissions 拒绝越权调用

---

### REQ-042 `sanitizePlan` 清洗器 ⬜

**User Story**：作为系统，从模型返回的 Plan JSON 必须经过白名单清洗，防止注入可执行代码或非法节点/边。

**Acceptance Criteria**：
1. SHALL 剔除节点类型 ∉ `['text','image','video']` 的节点及其关联边，记入 `dropped`。
2. SHALL 剔除不满足 `canConnect(source, target)` 的边，记入 `dropped`。
3. SHALL 深扫描 `node.data` 字段，命中脚本/函数字符串模式（`function`, `eval`, `=>`, `<script`）时剔除该字段，记入 `dropped`。
4. SHALL 剔除 `action ∉ ['imageRun','videoRun','textPolish']` 的 runStep，记入 `dropped`。
5. 清洗后 `plan.dropped` 数组包含所有被剔除项的描述。
6. 纯函数，无副作用。

**任务**：
- [ ] `desktop/src/main/agent/sanitize-plan.ts`
- [ ] 单元测试（Property 5）：注入非法节点/边/代码 → 必被剔除，fast-check ≥100 次

---

### REQ-043 `canvas.chatSend` + `canvas.chatGetPlan` IPC ⬜

**User Story**：作为 renderer，我需要通过 IPC 发起 Agent 对话并拉取产出的 Plan。

**Acceptance Criteria**：
1. `canvas.chatSend(message, graphSnapshot)` → 立即返回 `{ taskId, messageId, status:'pending' }`。
2. `canvas.chatGetPlan(messageId)` → 返回 `CanvasPlan | null`（null 表示仍在生成）。
3. WHEN orchestrator 完成，`canvas_orchestrate.completed` IPC 事件携带 `{ messageId, planId }`。
4. `chat_message` 表写入 `role=assistant, plan_json, apply_status=pending`。
5. 两个通道已在 `docs/api-contracts/` 登记。

**任务**：
- [ ] `canvas.chatSend` IPC handler
- [ ] `canvas.chatGetPlan` IPC handler
- [ ] `canvas_orchestrate.completed` 事件 emit 逻辑
- [ ] `docs/api-contracts/agent-chat.md` 登记

---

### REQ-044 `applyPlan` 前端逻辑 ⬜

**User Story**：作为 renderer，收到 Plan 后我需要将节点/边变更应用到画布，并整合为一条 undo 快照。

**Acceptance Criteria**：
1. WHEN renderer 收到 Plan，THE `applyPlan(plan)` SHALL：① 二次校验节点类型白名单 + 连接矩阵；② 调 Zustand store `applyChange` 批量应用节点/边；③ 折叠为**一条** undo 快照。
2. 非法项（已被 sanitize 但前端二次验证捕获）直接跳过，console.warn。
3. 应用后自动触发分层布局（dagre 或 elkjs）。
4. `applyPlan` 为纯函数（输入 plan + 当前 store state → 返回新 state），不直接 mutate store。

**任务**：
- [ ] `desktop/src/renderer/canvas/lib/apply-plan.ts`
- [ ] dagre / elkjs 分层布局集成
- [ ] 单元测试：合法 Plan → 节点边正确；非法 Plan → 跳过 + warn

---

### REQ-045 `PlanRunner` 串行执行器 ⬜

**User Story**：作为 renderer，applyPlan 后 PlanRunner 需要串行执行 runSteps，每步等待节点终态再推进。

**Acceptance Criteria**：
1. `PlanRunner.start()` 触发第一个 runStep，调 `canvas.runNode` IPC。
2. `PlanRunner.notifyNodeTerminal(nodeId, phase)` 命中当前步的节点时，`phase=done` → 推进下一步；`phase=error` → 短路，剩余步骤保留在 queue 不执行。
3. PlanRunner 为纯状态机，不订阅 IPC 事件（事件由外部注入 `notifyNodeTerminal`）。
4. `start() / notifyNodeTerminal()` 均为同步函数，无内部 setTimeout/setInterval。

**任务**：
- [ ] `desktop/src/renderer/canvas/lib/plan-runner.ts`
- [ ] 单元测试：3 步 Plan → 串行推进；step 2 error → step 3 跳过

---

### REQ-046 Chat UI ⬜

**User Story**：作为用户，我需要一个 Chat 面板输入指令，看到 Agent 的回复和 Plan 摘要，并能一键应用 Plan。

**Acceptance Criteria**：
1. Chat 面板显示对话历史（user + assistant 消息，`chat_message` 表驱动）。
2. WHEN orchestrator 返回 Plan，THE Chat 面板 SHALL 显示 Plan 摘要（summary + 节点/边数量 + dropped 数量警告）。
3. SHALL 有「应用 Plan」按钮，点击触发 `applyPlan` + `PlanRunner.start()`。
4. WHEN `autoExecute = true`，SHALL 自动执行无需确认。
5. 输入框 `Enter` 发送，`Shift+Enter` 换行。

**任务**：
- [ ] `desktop/src/renderer/chat/ChatPanel.tsx`
- [ ] `desktop/src/renderer/chat/PlanCard.tsx`（Plan 摘要 + 应用按钮）
- [ ] TanStack Query 拉取 `chat_message` 历史
- [ ] autoExecute 逻辑
- [ ] 组件测试：有 Plan → 显示 PlanCard；点击应用 → applyPlan 调用

---

### REQ-047 端到端 Agent 编排验证 ⬜

**Acceptance Criteria**：
1. 用户输入「生成一个图片节点，内容是：宇宙飞船」。
2. orchestrator 产出 Plan 包含 1 个 image 节点 + 0 条边 + 1 个 runStep(imageRun)。
3. applyPlan 将节点加入画布；PlanRunner 自动调 `canvas.runNode`；stub provider 返回资产；节点变 done。
4. 全程无同步等待、无 setInterval。

**任务**：
- [ ] 集成测试脚本（stub provider + stub model）
- [ ] 验证 Plan 清洗（注入 eval → dropped 记录）

---

## 完成标准

- [ ] orchestrator 单元测试（mock 模型）通过
- [ ] sanitizePlan Property 5 PBT ≥100 次通过
- [ ] PlanRunner 串行执行单元测试通过
- [ ] 端到端 Agent 编排验证（REQ-047）通过
- [ ] `tsc --noEmit` 无报错
