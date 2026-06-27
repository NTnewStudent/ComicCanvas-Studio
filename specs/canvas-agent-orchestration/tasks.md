# Implementation Plan — Canvas Agent Orchestration

> **状态说明**：本任务列表由 `specs/milestone-execution-plan/tasks.md` 代理执行。所有任务已通过里程碑 M1-M4 实现完毕。

> 每条任务标注验证方式与关联 Requirement。按阶段 A→F 推进，每阶段可独立合并。

## 阶段 A — 共享契约（纯函数 + 测试）

- [x] 1. 定义 `shared/nodes.ts`（NodeType / 各节点 data 接口 / EdgeType）→ verify: tsc 通过 _（R2, R5）_
- [x] 2. 实现 `shared/connection-matrix.ts`（`NODE_CONNECTION_MATRIX` + `canConnect`）→ verify: PBT 穷举 3×3 _（Property 1）_
- [x] 3. 实现 `shared/composed-prompt.ts`（`composeFinalPrompt` 纯函数）→ verify: PBT 恒等 + 顺序 _（Property 2）_
- [x] 4. 定义 `shared/plan.ts`（CanvasPlan / RunAction）+ `shared/ipc.ts`（通道契约）→ verify: tsc _（R1）_

## 阶段 B — 持久化与队列骨架

- [x] 5. Drizzle schema（jobs / chat_message / workflow_version / asset / asset_folder / agents / gateways / tools）+ DB 抽象层 → verify: 迁移可跑 _（R4, R6）_
- [x] 6. 仓储层（jobs / asset / chat_message）→ verify: 单元测试 _（R4）_
- [x] 7. JobQueue + JobWorker 骨架（enqueue 仅入队 + 票据；worker 消费占位）→ verify: 终态事件唯一性单元 _（Property 3）_

## 阶段 C — Provider 与资产

- [x] 8. Provider 接口 + stub provider（image/video/text）→ verify: 单元 _（R4）_
- [x] 9. 资产管线 `saveBytes` + `classifyOrientation` + `cc-asset://` 协议（越界校验）→ verify: PBT orientation + 越界拒绝 _（Property 4, R6.3）_
- [x] 10. JobWorker 接 provider + 资产管线 + IPC 事件 → verify: 集成（stub）_（R4, R6）_

## 阶段 D — 画布与手动生成

- [x] 11. React Flow 画布 store（nodes/edges/undo）+ 基础节点组件 → verify: 组件测试 _（R2）_
- [x] 12. 连接校验（onConnect 调 canConnect + toast）→ verify: 组件测试 _（Property 1）_
- [x] 13. Connected Inputs Panel + prompt 预览（复用 composed-prompt）→ verify: 前后端字节等价测试 _（Property 2）_
- [x] 14. 节点画幅自适应（orientation 切换 + contain + 占位骨架）→ verify: 组件测试 _（R6）_
- [x] 15. 手动 runNode（入队 + IPC 订阅刷新，零轮询）→ verify: 集成 + 无轮询静态扫描 _（R4.4）_

## 阶段 E — Agent 编排

- [x] 16. Orchestrator AsyncGenerator 主循环 + 工具编排 → verify: 单元 _（R1）_
- [x] 17. Tool 统一接口 + Canvas 工具集（queryGraph/proposePlan/createNode/connectNodes/updateNodeData/runNode）→ verify: 单元 _（R1, tool-contracts）_
- [x] 18. `sanitizePlan`（白名单 + 矩阵 + 去代码 + dropped）→ verify: PBT/注入测试 _（Property 5）_
- [x] 19. chatSend 异步入队 + IPC 终态 + chatGetPlan → verify: 集成（同步无 Plan）_（R1.1, R1.4）_

## 阶段 F — 应用与执行

- [x] 20. `applyPlan`（白名单+矩阵二次校验 + 分层布局 + 一条 undo）→ verify: 单元 _（R2）_
- [x] 21. `PlanRunner`（串行 + failed 短路保留剩余）→ verify: 状态机单元 _（R3）_
- [x] 22. 端到端「文本→图→视频」（provider stub）→ verify: 集成，核对资产相对路径 + orientation + 矩阵 _（R3, R4, R6, all Properties）_

## 阶段 A59 — Phase A 后重开 Agent 编排需求

- [x] A59. Reopen Agent orchestration requirements after manual parity gate.
  - Phase A acceptance gate: `HDR-PHASEA-001` remains the product gate before
    enabling migrated Agent plan apply/run automation.
  - CanvasPlan node vocabulary: text, image, video, imageConfigV2,
    videoConfigV2, character, scene, audio, videoCompose, superResolution,
    muxAudioVideo.
  - CanvasPlan node vocabulary exact set: text, image, video, imageConfigV2, videoConfigV2, character, scene, audio, videoCompose, superResolution, muxAudioVideo.
  - MJ is legacy-known but unavailable for Agent planning, add paths, run
    steps, URL refresh, and local Phase A automation.
  - Edge vocabulary: promptOrder, imageOrder, imageRole, outputLink, reference,
    default.
  - Edge vocabulary exact set: promptOrder, imageOrder, imageRole, outputLink, reference, default.
  - Agent planning must preserve clarify branches and dropped warnings for
    underspecified, unsafe, invalid, or unavailable requests.
  - Task 60 readiness is recorded in
    `docs/progress/task-60-agent-plan-apply-readiness.md` and must be checked
    before enabling Agent plan apply/run implementation.
  - Verify: `tests/agent-orchestration-requirements-refresh.test.ts`.
