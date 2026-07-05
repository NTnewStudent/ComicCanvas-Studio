# Task 60 Agent Plan Apply 就绪状态

创建日期：2026-06-27

任务来源：`specs/hjwall-assets-workflows-100-migration/tasks.md`

人工关卡：`HDR-PHASEA-001`

## 当前状态

Task 60 已在 `shared/agent-plan-apply.ts` 背后实现。渲染层聊天界面会在满足以下条件时，通过现有的 `applyPlan` + `createCanvasPlanExecutionController` 路径自动应用已就绪的 `CanvasPlan`：

- `AGENT_PLAN_AUTO_APPLY_ENABLED` 为 true，且
- 用户开启了聊天「自动执行」，或所选 agent 的
  `triggerPolicy.autoRun = true`，且
- plan 的 `kind` 为 `plan`（非 `clarify`）。

当自动运行关闭时，手动的 PlanCard 应用方式仍可使用。

**产品延后决定（2026-07-05）：** `HDR-PHASEA-001` 保持 Pending；产品负责人决定将批量人工验收延后，直到工程队列完成。Task 60 已凭自动化证据结项（`tests/agent-plan-apply-run.test.ts` 8/8，及相关关卡测试）。HDR-050 / HDR-051 等待批量评审会话。

## 关卡开启后的范围

关卡开启后，Task 60 应仅在已完成的非 MJ workflow 词汇表范围内实现 Agent plan 应用/运行：

- 节点：text、image、video、imageConfigV2、videoConfigV2、character、scene、audio、videoCompose、superResolution、muxAudioVideo。
- 边：promptOrder、imageOrder、imageRole、outputLink、reference、default。
- 运行操作：imageRun、videoRun、textPolish。

MJ 仍作为已知的旧版功能保留，但不可用。Seedance/真人流程与 LTM 不在范围内。

## 必须复用的现有能力

实现开始时，Task 60 应复用以下现有能力，而不是创建并行的行为：

- Plan 校验与清洗：`sanitizePlan`、共享节点词汇表、共享边词汇表，以及图校验。
- 手动应用语义：渲染层 `applyPlan` 行为、单条 undo 快照、确定性放置，以及被丢弃项警告的展示。
- 手动运行语义：现有的 `canvas.runNode`、JobQueue、JobWorker、IPC 终态事件，以及 CanvasJobPanel 恢复展示。
- 工具路径：当前的 `createCanvasTools` 描述符，以及 ToolRuntime 针对图变更与运行票据的结构化错误。
- 持久化服务：现有的资产/分类、workflow 项目/模板、片段、风格/模型、存储，以及 job 仓储层或 IPC/服务契约。

任何新的仅供 Agent 使用的图变更、风格解析、资产解析、运行入队或存储路径均不得绕过上述能力。

## 必需的开工前检查

编写 Task 60 代码之前，需验证：

1. `HDR-PHASEA-001` 为 Pass，或在两份相关文档中均已记录产品延后决定。
2. `HDR-050` 与 `HDR-051` 不再因关卡未开启而处于 Pending，或其 Pending 状态已被明确说明为关卡开启后的评审工作。
3. CanvasPlan 的节点与边词汇表与 `specs/canvas-agent-orchestration/requirements.md` 一致。
4. `docs/api-contracts/tools-agents.md` 列出了 Task 60 计划调用的每一个 `createCanvasTools` 描述符。
5. 手动 UI 与 ToolRuntime 之间针对图、资产、workflow、片段、风格、job 操作（供 Agent 使用）的等价性测试均通过。

## 禁止实现的内容

Task 60 不得：

- 在 `HDR-PHASEA-001` 仍为 Pending 且未经明确产品延后的情况下开始。
- 启用 MJ 规划、MJ 添加/运行路径、MJ URL 刷新、MJ 多结果对齐，或 MJ 供应商集成。
- 重新引入 Seedance/真人流程。
- 将 LTM 用于上下文、状态、检查点或证据。
- 在同步的 Agent/apply/run 响应中返回生成的字节数据、资产 URL、绝对路径或密钥。
- 为仅供 Agent 使用而创建第二套连接矩阵、风格解析器、资产解析器或任务队列。

## 后续实现时的最低验证要求

关卡开启并开始实现时，验证必须包括：

- 针对迁移后节点与边的 Agent plan 应用测试。
- Agent 运行串行化测试，证明终态事件按顺序推进步骤，且失败会使剩余步骤转为手动处理。
- 针对 MJ、不受支持的资产/风格/模型、非法连线、不可用运行操作，以及可执行字符串的丢弃警告与 clarify 测试。
- 工具/UI 等价性回归测试，证明 Agent 路径在变更与运行票据上使用与手动 UI 相同的持久化语义。
- `bun run typecheck` 与 `git diff --check`。
