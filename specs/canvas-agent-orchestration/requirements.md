# Requirements Document — Canvas Agent Orchestration

## Introduction

本 spec 定义 ComicCanvas Studio 的**核心能力**：用户用自然语言驱动 Agent，自动在画布上「生成节点 → 连线 → 串行执行任务（生图/生视频/生角色）」。本期目标是把这条链路从「能跑」做到「可信任运行」：编排产物必须是白名单清洗后的纯声明式 Plan；所有生成走本地异步任务队列 + IPC 事件回推；节点连接收敛为一份前后端共享的连接矩阵；多输入 prompt 拼接确定性可重放；资产落本地、DB 存相对路径、渲染走安全协议。

明确非目标（本期不做）：
- 不实现云端协作 / 多端同步。
- 不实现「取消正在运行的生成任务」入口（后续里程碑）。
- 不实现 MCP / 插件市场（接口预留，不在本期）。

## Glossary

- **Canvas**：渲染层 React Flow 画布（`desktop/src/renderer/src/canvas/`）。
- **Orchestrator**：主进程 Agent 运行时（`desktop/src/main/agent/`），AsyncGenerator 主循环。
- **CanvasPlan**：Orchestrator 产出、清洗后的纯 JSON（`shared/plan.ts`），含 `nodes/edges/runSteps`。
- **JobQueue**：进程内持久化任务队列（落 SQLite `jobs` 表）。
- **Connection_Matrix**：`shared/connection-matrix.ts` 的 `NODE_CONNECTION_MATRIX`，节点连接唯一真源。
- **Composed_Prompt**：生成节点实际下发模型的最终 prompt（多输入确定性拼接）。
- **Orientation**：`landscape | portrait | square`。
- **Asset**：本地资产文件（`appData/assets/`），DB 存相对路径。

### 节点连接矩阵（规范性引用）

连接矩阵以 `shared/connection-matrix.ts` 为唯一真源。Agent 编排不得复制矩阵；
Plan 清洗与应用阶段都必须调用同一 `canConnect(upstream, downstream)`。

当前 Agent 可创建的生产节点词汇为：text, image, video, imageConfigV2,
videoConfigV2, character, scene, audio, videoCompose, superResolution,
muxAudioVideo。`image` / `video` 是素材引用节点；生图/生视频 runSteps 只能指向
`imageConfigV2` / `videoConfigV2`。`mjImage` 仅作为遗留图兼容类型，不允许 Agent
创建或运行。

## Requirements

### Requirement 1: 自然语言 → 声明式 Plan

**User Story:** 作为用户，我希望输入一句话（如「做一个穿红衣的女孩角色，再用她生成一段竖屏视频」），Agent 能给出可预览的计划并落到画布。

#### Acceptance Criteria

1. WHEN 用户在画布对话区发送自然语言消息，THE Orchestrator SHALL 异步入队处理，并在 ≤1s 内通过 IPC 返回 `{ taskId, messageId, status: 'pending' }` 票据（响应体不含最终 Plan）。
2. WHEN Orchestrator 完成一次编排，THE Orchestrator SHALL 产出 `CanvasPlan`，且 `kind ∈ {'plan','clarify'}`；`kind==='clarify'` 时 `question` 非空且 `nodes/edges/runSteps` 为空。
3. THE CanvasPlan SHALL 为纯声明式 JSON，FOR ALL 字段值 SHALL NOT 包含可执行代码 / 脚本字符串（清洗器对命中项剔除并记入 `dropped`）。
4. WHEN Orchestrator 产出 Plan 后，THE Orchestrator SHALL 通过 IPC 事件（`stepType=canvas_orchestrate`）回推终态，前端据此拉取 Plan。

### Requirement 2: Plan 应用到画布

**User Story:** 作为用户，我希望 Agent 的计划一键落到画布，且能一次撤销。

#### Acceptance Criteria

1. WHEN 前端应用 Plan，THE Canvas SHALL 对每个节点按 Connection_Matrix 白名单与节点类型白名单二次过滤，非法项剔除并提示。
2. WHEN 应用 Plan 的连线，THE Canvas SHALL 对每条边调 `canConnect(u,d)` 二次校验，非法边剔除。
3. THE Canvas SHALL 把整个 Plan 的应用折叠为**一条** undo 快照（一次撤销可回退整个 Plan）。
4. THE Canvas SHALL 按 Plan 内连线对节点做分层布局，放置于现有节点下方，不打扰既有布局。

### Requirement 3: 串行执行 runSteps

**User Story:** 作为用户，我希望计划里的生成步骤按序自动执行，一步失败不会把后面全带崩。

#### Acceptance Criteria

1. WHEN 用户确认执行（或 `autoExecute=true`），THE Canvas SHALL 按 `runSteps` 顺序逐步触发，上一步终态 `completed` 后才触发下一步。
2. IF 某一步进入 `failed`，THEN THE Canvas SHALL 短路，剩余步骤**保留待手动执行**（不标记跳过），并展示该步错误。
3. FOR ALL runStep 的 `action`，SHALL ∈ `{ imageRun, videoRun, textPolish }`；非法 action 在清洗阶段剔除。

### Requirement 4: 全量异步生成 + IPC 实时

**User Story:** 作为用户，我希望生成不卡界面，状态实时可见。

#### Acceptance Criteria

1. WHEN 触发任意生成（手动或编排），THE Main SHALL 仅做「建 `jobs` 行 + 入队 + 返回票据」，由 JobWorker 在独立上下文调模型。
2. THE Main SHALL 让生成的同步响应体 FOR ALL 嵌套字段 SHALL NOT 包含资产 URL / 绝对路径字段。
3. WHEN JobWorker 完成或失败，THE Main SHALL 通过 IPC 事件 `job.completed`/`job.failed` 回推；同一 jobId 的 completed+failed 计数 SHALL = 1。
4. THE Canvas SHALL 仅靠 IPC 事件 + query 失效重取拿到结果，SHALL NOT 轮询资产。

### Requirement 5: 确定性 Composed_Prompt

**User Story:** 作为用户，我希望「连了几个文本 + 自己写的 prompt」最终交给模型的内容可预测、可复现。

#### Acceptance Criteria

1. WHEN 生成节点有 1..N 个上游 text 节点，THE Canvas SHALL 在节点上方按连接时间顺序逐条展示，并展示拼接预览。
2. WHEN Main 构造 Composed_Prompt，THE Main SHALL 在提交时刻快照所有上游 text 内容，按连接时间顺序用 `\n`(U+000A) 拼接，再追加节点自身 prompt。
3. FOR ALL 同一 graph 快照，`Main.composeFinalPrompt` 与 `Canvas` 预览的「文本贡献部分」SHALL 字节等价，且多次构造结果恒等。
4. WHEN 生成节点上游含 image/video，THE Main SHALL 在 Composed_Prompt 前追加固定中文指令前缀，并把上游资源以 referenceImages/referenceVideos 下发。

### Requirement 6: 资产管线 + Orientation

**User Story:** 作为用户，我拿到的每张图/每段视频都能直接用、能判断横竖。

#### Acceptance Criteria

1. WHEN JobWorker 拿到模型返回字节，THE Main SHALL 落盘到 `appData/assets/`，DB 仅存相对路径（不存模型网关临时 URL、不存绝对路径）。
2. THE Main SHALL 按 `width>height⇒landscape`、`width<height⇒portrait`、`width===height⇒square` 判定 Orientation 写入记录；IF 尺寸缺失或非正整数 THEN 任务置 `failed`（分类 `metadata_missing`）。
3. WHEN 渲染层展示资产，THE 渲染 SHALL 走自定义安全协议（限制在 `appData/assets/` 内），不暴露绝对路径。
4. FOR ALL 处于 `completed` 的生成记录，`orientation` SHALL ∈ `{landscape, portrait, square}` 且在返回渲染层前已设置。

## Correctness Properties

### Property 1: Connection_Matrix 前后端等价
*For any* `(u, d) ∈ NodeType × NodeType`，`frontend.canConnect(u,d) === backend.canConnect(u,d)`；后端接受持久化/运行的 Graph 每条边 SHALL ∈ 矩阵。
**Validates: Requirements 2.1, 2.2**

### Property 2: 确定性 Prompt
*For any* 含上游 text 的生成节点 graph，后端拼接与前端预览文本贡献部分字节等价，顺序严格 = 连接时间顺序，多次构造恒等。
**Validates: Requirements 5.2, 5.3**

### Property 3: 同步无资产返回 + 终态唯一
*For any* 生成的同步响应，响应体不含资产 URL/路径；*for any* 已入队 jobId，completed+failed 计数 = 1。
**Validates: Requirements 4.2, 4.3**

### Property 4: Orientation 完整性
*For any* `(w,h)`，`classifyOrientation` 满足三段定义；非正整数/缺失 ⇒ `metadata_missing`；终态记录必带合法 orientation。
**Validates: Requirements 6.2, 6.4**

### Property 5: Plan 安全
*For any* CanvasPlan，节点类型 ∈ 白名单、每条边 ∈ 矩阵、无可执行代码字符串；违规项被剔除并记入 `dropped`。
**Validates: Requirements 1.3, 2.1, 2.2, 3.3**

## Phase A Requirements Refresh

### REQ-A59: Agent vocabulary after assets/workflows parity

**User Story:** 作为产品和工程维护者，我希望 Agent 后续只使用已经迁移并通过 Phase A 门禁管理的画布词汇，避免 Agent 自动化绕过手动画布和人工审核。

#### Acceptance Criteria

1. WHEN Agent orchestration is reopened after the Phase A acceptance gate, THE CanvasPlan vocabulary SHALL equal the migrated production node set: text, image, video, imageConfigV2, videoConfigV2, character, scene, audio, videoCompose, superResolution, muxAudioVideo.
2. THE Agent SHALL treat MJ is legacy-known but unavailable for local planning, add paths, run steps, and URL refresh.
3. FOR ALL Agent-produced edges, THE edge vocabulary SHALL be promptOrder, imageOrder, imageRole, outputLink, reference, default and SHALL still pass the shared connection matrix or graph validation before persistence.
4. WHEN user intent is underspecified, unsafe, references unavailable assets/styles/models, or asks for unavailable MJ behavior, THE Agent SHALL use clarify branches instead of inventing hidden defaults.
5. WHEN sanitization drops unsupported nodes, illegal edges, executable strings, unavailable run actions, or unavailable legacy MJ behavior, THE Agent SHALL preserve dropped warnings for renderer display and audit.
6. WHILE `HDR-PHASEA-001` is Pending, THE implementation SHALL NOT enable Agent plan apply/run automation over the migrated workflow vocabulary. Task 60 may start only after human review pass or explicit product deferral.

### Property 6: Phase A gated Agent vocabulary

For any future Agent-generated CanvasPlan, every node type SHALL be in the migrated production node set, every edge type SHALL be in the migrated edge vocabulary, MJ is legacy-known but unavailable, clarify branches SHALL be used for underspecified or unavailable requests, and dropped warnings SHALL preserve every removed unsafe or unsupported record.
**Validates: REQ-A59**
