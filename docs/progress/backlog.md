# ComicCanvas Studio — 总任务清单（Backlog）

> 全局真源。需求编号 REQ-xxx，状态：⬜ 未开始 / 🔵 进行中 / ✅ 完成 / 🅿️ 暂缓
> 全局 spec 入口见 `specs/README.md`；细粒度实现任务见 `specs/core-platform-foundation/tasks.md`、`specs/milestone-execution-plan/tasks.md` 与 `specs/canvas-agent-orchestration/tasks.md`。
> 最近更新：2026-06-26

---

## 里程碑

| 里程碑 | 目标 | 状态 |
| :--- | :--- | :--- |
| **M0** 契约 & 治理 | shared/ 契约、根级 specs/ 全局 spec、Codex 治理、调研汇报 | ✅ |
| **M1** 骨架可跑 | Electron + DB + 队列 + 一个 stub provider 端到端跑通手动生图 | ✅ |
| **M2** 画布完整 | 三节点完整交互、连接校验、确定性 prompt、资产管线 | ✅ |
| **M3** 网关系统 | OpenAI 兼容适配 + 设置页 + 热拔插 + 真实生图/生视频 | ✅ |
| **M4** Agent 编排 | 主循环 + Canvas 工具集 + Plan 清洗/应用/串行执行 | ✅ |
| **M5** Agent 进阶 | super-agent + 子 agent spawn + 工具/agent 管理 UI | ⬜ |

---

## REQ 列表

### M0 — 契约 & 治理

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-001 | `shared/nodes.ts` 三节点类型 + data 模型 | ✅ |
| REQ-002 | `shared/connection-matrix.ts` 连接矩阵 + canConnect | ✅ |
| REQ-003 | `shared/plan.ts` CanvasPlan 类型 | ✅ |
| REQ-004 | `shared/ipc.ts` IPC 通道契约 | ✅ |
| REQ-005 | `shared/tools-agents.ts` Tool/Agent/Gateway/Folder 类型 + spawnSubAgent | ✅ |
| REQ-006 | Codex/GPT 原生治理层（`.codex/` + `.agents/`，`.claude/` 仅兼容归档） | ✅ |
| REQ-007 | `docs/api-contracts/tools-agents.md` 工具集契约 | ✅ |
| REQ-008 | `shared/composed-prompt.ts` 确定性 prompt 拼接纯函数 | ✅ |
| REQ-009 | LTM 初始化（ltm/bin/ltm.py selftest 通过） | ✅ |
| REQ-018 | `specs/core-platform-foundation/` 核心平台基础契约（画布 / 队列 / 资产 / 网关 / Tools / Plugins / Agents / Skills / Knowledge/RAG） | ✅ |
| REQ-019 | `docs/api-contracts/*` 模块契约拆分登记（jobs/assets/gateway/tools/agents/skills/knowledge/audit） | ✅ |
| REQ-057 | `specs/milestone-execution-plan/` 从 `task/M0-M5` 迁移执行任务并查缺补漏 | ✅ |

### M1 — 骨架可跑

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-010 | Electron 脚手架（main + preload + renderer + electron-vite） | ✅ |
| REQ-011 | Drizzle schema + DB 抽象层（sqlite 默认 / mysql 可切） | ✅ |
| REQ-012 | 仓储层（workflow / jobs / asset / chat_message） | ✅ |
| REQ-013 | JobQueue + JobWorker 骨架（入队返票据，worker 占位） | ✅ |
| REQ-014 | Provider 接口 + stub provider | ✅ |
| REQ-015 | 资产管线（saveBytes + classifyOrientation + cc-asset:// 越界校验） | ✅ |
| REQ-016 | IPC handler 骨架（canvas.* / job.* 订阅） | ✅ |
| REQ-017 | 端到端：手动 createNode → runNode → stub 生图 → 节点刷新 | ✅ |

### M2 — 画布完整

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-020 | React Flow 画布 store（nodes/edges/viewport/undo） | ✅ |
| REQ-021 | Text 节点（折叠/展开，文本输入） | ✅ |
| REQ-022 | Image 节点（配置+生成+结果合一，四态） | ✅ |
| REQ-023 | Video 节点（含首/尾帧图，时长参数） | ✅ |
| REQ-024 | 连接校验（onConnect 调 canConnect + toast） | ✅ |
| REQ-025 | Connected Inputs Panel + 确定性 prompt 预览（字节等价） | ✅ |
| REQ-026 | 节点画幅自适应（orientation 切换 + contain + 骨架） | ✅ |
| REQ-027 | 节点 inline 改名（双击 label） | ✅ |
| REQ-028 | 画布保存/加载（持久化 graph JSON） | ✅ |
| REQ-029 | 零轮询验证（IPC 事件 + query 失效，无 setInterval） | ✅ |

### M3 — 网关系统

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-030 | OpenAI 兼容 Provider（/v1/images、/v1/chat 等） | ✅ |
| REQ-031 | 异步网关轮询（提交→remote_task_id→查询→落盘） | ✅ |
| REQ-032 | 设置页：网关配置（URL + Key + 模型映射） | ✅ |
| REQ-033 | API Key 走 OS safeStorage（不落明文/日志） | ✅ |
| REQ-034 | 网关热拔插（保存后重新初始化 Provider，不重启） | ✅ |
| REQ-035 | 多渠道模型映射（image/video/text 分别指向不同 endpoint） | ✅ |

### M4 — Agent 编排

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-040 | Orchestrator AsyncGenerator 主循环 | ✅ |
| REQ-041 | Tool 统一接口 + ToolRegistry | ✅ |
| REQ-042 | Canvas 工具集（queryGraph/proposePlan/createNode/connectNodes/updateNodeData/deleteNode/runNode） | ✅ |
| REQ-043 | sanitizePlan（白名单 + 矩阵 + 去代码 + dropped） | ✅ |
| REQ-044 | chatSend 异步入队 + IPC 终态 + chatGetPlan | ✅ |
| REQ-045 | applyPlan（二次校验 + 分层布局 + 一条 undo） | ✅ |
| REQ-046 | PlanRunner（串行 + failed 短路保留剩余） | ✅ |
| REQ-047 | 对话区 UI（消息面板 + Plan 预览 + 应用/执行按钮） | ✅ |
| REQ-048 | agent orchestration smoke path（自然语言 → Plan → applyPlan → runNode → stub asset → done node） | ✅ |

### M5 — Agent 进阶

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-050 | super-agent（allowedTools '*'，默认入口） | ⬜ |
| REQ-051 | agent.spawnSubAgent（内联定义 + 权限继承 + 深度上限） | ✅ |
| REQ-052 | 子 agent 隔离上下文执行 + 结果返回 | ✅ |
| REQ-053 | 用户自定义 agent（设置页创建 + DB 持久化 + AgentRegistry） | ✅ |
| REQ-054 | 对话区 agent 选择器（@mention 风格） | ✅ |
| REQ-055 | 工具管理设置页（启用/禁用 + ToolRuntime 拒绝路径） | ✅ |
| REQ-056 | 资产文件夹（用户自定义 + 嵌套 + 拖拽整理） | ✅ |

### V2 节点复刻（2026-06-26 迭代）

- REQ-060 ImageConfigV2Node（生图节点 V2）— 复刻 hjwall ImageConfigV2Node UI ✅
- REQ-061 VideoConfigV2Node（生视频节点 V2）— 复刻 hjwall VideoConfigV2Node UI ✅
- REQ-062 设计系统重置 — DESIGN.md 重置为 hjwall 炭黑+翠绿版本（含亮色模式章节） ✅
- REQ-063 CSS 动画系统移植 — 7 个 @keyframes + Handle 自定义 + 按钮系统 ✅
- REQ-064 画布引擎性能优化 — 消除双态同步 + React.memo + nodeTypes 模块级 + onlyRenderVisibleElements ✅
- REQ-065 共享组件库 — RunStatusBadge / Chip / PopoverMenu / PromptFocusModal / MentionTextarea ✅
- REQ-066 V2 节点注册 — nodeTypes + 连接矩阵 + store + 工具栏 ✅

> 接口端暂未实现（生成按钮为桩），等网关对接后集成。

### 会话迭代 2026-06-26（REQ-070 ~ REQ-076）

- REQ-070 Qoder IDE 配置迁移 — 4 agents + 10 rules + 3 skills + settings.json 从 .kiro/.codex 迁移到 .qoder ✅
- REQ-071 白屏修复 — preload .js→.mjs + CSP unsafe-inline + sandbox false（临时措施） ✅
  - ⚠️ sandbox: false 与 core-foundation R10.1 安全要求冲突，后续需评估恢复方案（preload ESM 配置或 CJS 构建）
- REQ-072 路由 + 侧边栏导航 — React Router + WorkspaceLayout + WorkspaceSidebar ✅
- REQ-073 wf-neo 双主题设计系统 — DESIGN.md 重置 + styles.css token + tailwind.config.ts ✅
- REQ-074 界面中文化 — 19 个组件 UI 文案从英文改为中文 ✅
- REQ-075 前端设计规范规则 — .qoder/rules/frontend-design-standards.md（glob 自动激活） ✅
 REQ-076 画布引擎性能优化 — 消除双态同步 + React.memo + nodeTypes 模块级 + onlyRenderVisibleElements ✅

### hjwall 核心功能迁移（REQ-077 ~ REQ-084）— 2026-06-26

- REQ-077 画布项目管理（多工作流创建/切换/重命名/删除） ✅
- REQ-078 工作流保存/加载（Ctrl+S + 自动保存 + 加载恢复） ✅
- REQ-079 画布内资产库面板（浮动面板+搜索+分类+时间排序） ✅
- REQ-080 画布左侧操作栏增强（数据驱动+展开菜单+功能按钮） ✅
- REQ-081 画布内 AI 对话（浮动 FAB + 展开面板 + Plan 应用） ✅
- REQ-082 画布右键菜单（空白区添加节点+节点操作） ✅
- REQ-083 节点引用创建（@mention 自动创建/清理连线） ✅
- REQ-084 后端接口本地化验证（IPC 映射完整性确认） ✅

### S3 媒体云存储架构（REQ-085）— 2026-06-26

- REQ-085 S3 媒体云存储架构改造 ✅
  - StorageProvider 策略模式接口（upload/query/rename）
  - S3StorageProvider 实现（兼容 R2/COS/OSS/MinIO）
  - StorageFactory 工厂 + 注册表
  - 设置页存储配置选项卡
  - 资产导入自动上传 S3
  - Provider 直接使用云端 URL
  - 生成结果自动回传 S3
  - 项目治理文档更新（本地优先 → 混合存储）

---

## 安全与不变量（贯穿所有里程碑）

- [x] Canvas Plan 纯声明式 JSON，无可执行代码（PBT 注入测试） — `sanitize-plan.test.ts`
- [x] 连接矩阵唯一真源，前后端 canConnect 等价（PBT 穷举） — `connection-matrix.test.ts`
- [x] 确定性 prompt 前后端字节等价（PBT） — `composed-prompt.test.ts`
- [x] 终态事件唯一性：每 jobId completed+failed 恰好 1 次 — `job-ipc-fanout.test.ts`
- [x] 子 agent 权限 ⊆ 父 agent，禁止提权
- [x] 子 agent 递归深度 ≤ MAX_SPAWN_DEPTH(2)
- [x] 渲染进程沙箱（contextIsolation/nodeIntegration/sandbox） — `electron-security.test.ts`（⚠️ sandbox 当前为 false，见 REQ-071 例外）
- [x] API Key 不落明文 / 日志 / LTM — `key-vault.test.ts`

---

## 当前焦点

**当前焦点** → hjwall Assets + Workflows 100% Migration（Phase A）+ Tool-first canvas capability layer + Conversation Context Engine + Infinite Canvas/Agent/Gateway Architecture
**下一步** → 先完成资产/工作流能力清单、当前 ToolRuntime 覆盖审计、资产分类模型与 UI parity；同时把 Agent 前置能力补齐为 Context Pack：最近对话、画布摘要、资产上下文、知识检索、压缩摘要。架构上新增 Node Definition + Port + Runtime Compiler + Gateway Binding 协议，避免后期第三方网关接入被硬编码节点逻辑卡住。
**前端路线** → M2-M5 所有 renderer UI 均以 Tailwind + `cn` + `global/design/DESIGN.md` 为基线；优先参考 `hjwall/pc-client` 对应模块的组件、交互和测试模式，再按 ComicCanvas 契约重实现，参考项目不提交。

---

## hjwall Canvas Full Migration Reverification (REQ-090 ~ REQ-098)

> Added: 2026-06-26
> Canonical spec: `specs/hjwall-canvas-full-migration/`
> Scope: migrate hjwall canvas user capabilities into ComicCanvas, excluding real gateway request details. Existing completed labels in older milestone rows are historical until reverified against current implementation, tests, and human desktop review.

| ID | Requirement | Status |
| :--- | :--- | :--- |
| REQ-090 | Evidence-based hjwall canvas migration inventory and current completion audit. | 进行中（2026-07-04：`docs/progress/hjwall-canvas-migration-inventory.md` 清单与 `docs/progress/backlog-claims-audit-2026-07-04.md` 逐条审计 REQ-077..085 已完成，发现并跟踪 2 项文档漂移：REQ-078 自动保存间隔与 REQ-082 节点"锁定"动作） |
| REQ-091 | Workflow project lifecycle: create, list, switch, rename, delete, import, export, save/load restore. | 进行中（workflow JSON import/export IPC round trip, schemaVersion=1 validation, graph sanitize, invalid JSON rejection, secret/absolute-path rejection, imported-as-draft navigation, immutable version list/debug metadata, restore-as-new-version path, lenient draft validation warnings, strict run/validate blocking, renderer `/projects` JSON import/export/version UI, and dirty-save switch/beforeunload guards covered; 2026-07-04 修复 `canvas.createWorkflow` 未落初始图版本的缺陷，并补全 `workflow.repo.ts` 全部导出方法的 `@see docs/api-contracts/canvas-plan.md` JSDoc 锚点（任务4已转 `[x]`）；human desktop review pending） |
| REQ-092 | Canvas interaction parity: toolbar, context menu, command palette, drag/drop media, snippets, shortcuts, connection feedback, zero asset polling. | 进行中（local media drop for image/video/audio engineering-complete with batch classification, asset import, cursor-near node creation, unsupported feedback, and audio `asset.import` persistence coverage; snippet core extract/insert with ID remap, one-undo insertion, persisted `canvas_snippets` storage, `canvasSnippet.*` IPC/preload APIs, compact CanvasPage snippet-library selector, direct ReactFlow connection feedback via shared validation, V2 @mention candidate/edge validation, selected-node duplicate/delete shortcuts, command palette filtering/execution, Ctrl/Cmd+K launch, fit-view command, select/pan ReactFlow mode wiring, connect-to-create shared validation and allowed-target filtering, visible canvas copy quality gate, CanvasPage React Flow/Zustand ownership cleanup with guarded store-to-React-Flow sync, hjwall-style top bar/left toolbar shell parity with import/export/save/job/theme/default-style/shortcut-help/viewport controls, toolbar/plus/context-menu/command-palette add-node paths, unified shortcut handling for save/undo/redo/duplicate/delete/fit/select/pan/command palette with editable-field and Mac Backspace guards, related-node highlight plus invalid/duplicate Chinese connection feedback, semantic edge components for prompt/image order, image role, output/reference rendering, and shared deletion, plus workflow/snippet, asset, character category, style, run/job, bottom input, and Agent-gated chat panel shell wiring covered; human desktop review pending） |
| REQ-093 | Comic-drama node system expansion: text/image/video plus character, scene, audio, imageConfigV2, videoConfigV2, videoCompose, superResolution, muxAudioVideo, mjImage as vertical slices. | 进行中（shared node contracts + connection matrix + Plan whitelist slice + concrete production component shell for character/scene/audio/videoCompose/superResolution/muxAudioVideo/mjImage covered; TextNode inline/focus/rich/polish-status/mention/prompt preview covered; ImageNode/VideoNode safe preview, picker, edit entry, run/status, and writeback covered; ImageConfigV2/VideoConfigV2 prompt/model/style/ratio(/duration/resolution) controls, upstream references, selectable results, and writeback covered; 2026-07-04 修复 imageConfigV2/videoConfigV2 的真实运行调度缺陷——`CanvasPage.tsx` 的 `jobTypeForNodeType` 与 `canvas.handler.ts` 的 `buildRunDescriptor` 此前未识别这两种 V2 类型（video ConfigV2 会退化成裸 image job，videoConfigV2 的生成按钮此前是纯 mock，点击后卡在 `running` 永不结束），现已路由到 `compileWorkflowNodeRuntimeSnapshot` 拿到拼接后的 prompt/画风/时长/分辨率参数，并通过 CanvasPage 新增的 `ImageConfigV2NodeWrapper`/`VideoConfigV2NodeWrapper` 注入真实 `onRun` 回调；同时移除了与 `node.data.status` 并行的 `canvasStore.nodeRunStatus` Map 机制（旧写法两套状态源不一致），统一以 `node.data.status` 为唯一真源，回归测试见 `tests/migrated-run-dispatch.test.ts`(7 tests)/`tests/image-config-v2-parity.test.tsx`(3 tests)/`tests/video-config-v2-parity.test.tsx`(3 tests)全部通过，`tsc --noEmit` 无报错；CharacterNode/SceneNode structured fields, custom category metadata, asset viewing intents, single/multi reference generation intents, prompt contribution previews, and reference handles covered（2026-07-04 任务14独立审计复核，确认属实：字段/连接矩阵/prompt拼接/素材库插入钩子/序列化往返均为真实实现，非占位，`character-scene-node-parity.test.tsx`/`production-node-components-parity.test.tsx`/`workflow-graph-compiler.test.ts`/`canvas-panels-parity.test.ts` 11/11 通过；`CharacterNodeData.viewMode` 字段声明但未被读写，记为非阻塞后续项）；2026-07-04 任务15独立审计复核（同样不接受子agent报告原文，逐项对照源码复核）：`AudioNode.tsx` 为真实生产组件，播放/资产绑定/时长展示/mux引用角色/导入查看按钮均非占位；连接矩阵 `audio -> video/videoConfigV2/muxAudioVideo`（及反向阻断）已强制并测试；`shared/assets.ts`/`asset.handler.ts` 端到端识别 audio/.mp3/audio-mpeg；`import-metadata.ts` 内含真实手写 MP3 帧头时长解析器（非 stub）；`workflow-graph-compiler.ts` 正确归类 audio 媒体类型并传递 durationSeconds；直接运行审计涉及的全部9个测试文件/32个测试，全部通过。识别三项非阻塞缺口：(1) `onImport`/`onViewAsset` 为真实组件 prop 且有测试覆盖，但 `CanvasPage.tsx` 未经 wrapper 注入回调——与任务14中 CharacterNode/SceneNode 已接受的同一模式一致，记为三节点类型共享的后续项；(2) `canvas.generateAudio` 运行调度管线（jobTypeForNodeType/buildRunDescriptor/runtime.ts stub worker）完整存在但 UI 不可达，`workflow-node-definitions.ts` 仍将 audio 标记 `runnable: false`——与本任务验收文本（未像任务16/17那样要求"run dispatch"）及 design.md 优先级排序一致，视为面向未来的预留基础设施，非待删除的死代码；(3) 资产导入时计算的 `AssetMetadata.durationMs` 从未回填到节点级 `AudioNodeData.durationSeconds`（`NodeAssetOption` 无时长字段，各素材插入路径均未传递），记为非阻塞后续项（对应任务14 `viewMode` 死字段先例），手动输入时长仍可用，当前无测试/需求断言自动回填。AudioNode import/view intents, playback, duration display, mux input affordance, and reference role semantics covered（任务15已闭环，见上）; VideoComposeNode/MuxAudioVideoNode ordered/input role controls, transition/model options, ticket-only run intents, terminal output previews, and output writeback covered（2026-07-04 任务16闭环：审计发现并修复真实缺陷——`videoCompose`/`superResolution`/`muxAudioVideo` 此前在 `CanvasPage.tsx` 的 `nodeTypes` 中直接注册裸组件而非 wrapper，导致 `onRun` 始终为 `undefined`；三个组件的 `handleRun` 均为 `update({ status: 'running', url: '' }); onRun?.(id)`，点击"运行"后节点卡死在 `running` 永不恢复，且运行按钮在该状态下自我禁用，无恢复路径——这是真实的运行期回归缺陷，直接阻塞本任务"run dispatch to stub job"验收项。已新增 `VideoComposeNodeWrapper`/`SuperResolutionNodeWrapper`/`MuxAudioVideoNodeWrapper`，遵循既有 `ImageNodeWrapper`/`VideoConfigV2NodeWrapper` 先例通过 `useCanvasRunContext()` 注入真实 `onRun`，`handleRunNode`/`jobTypeForNodeType` 路由本已正确，仅 UI 接线缺失；新增 `tests/task16-post-production-run-dispatch.test.ts`（5 tests）填补覆盖缺口，`tsc --noEmit` 无报错，回归 22/22 通过。两项非阻塞缺口（`onWriteOutputAsset` 未接线、stub handler 不产生 asset 引用）与已闭环任务的既有模式一致，记为跨节点类型共享后续项）；SuperResolutionNode input video, scene/resolution/FPS controls, ticket-only run intent, terminal output preview, and output writeback covered（2026-07-04 任务17闭环：`superResolution` 端到端运行调度已通过任务16的 wrapper 修复验证，同时确认 Agent-tool 层 `tools/canvas/index.ts` 的 `canvas.runNode` 独立按 `getNodeDefinition` 路由到同一 job 类型；`mjImage` 确认为设计上刻意不可运行——`workflow-node-definitions.ts` 标记 `runnable: false, addable: false, connectCreate: false` 并附 `unavailableReason`，CanvasPage 的 `jobTypeForNodeType` 返回 `null`，Agent-tool 层抛出分类错误而非静默忽略，符合 R4.7"不支持的节点类型必须可见标注为不可用"验收条款，非缺陷；识别两项非阻塞缺口（`buildRunDescriptor` 对 scene/resolution/fps 等参数仅做可选字段透传、无 Zod 范围/枚举校验——项目范围内所有节点类型均无此类校验，非本任务特有缺口；`canvas.upscaleVideo` stub 不产生 asset 引用，与任务16已接受的同类 stub 缺口形状一致），均记为跨节点类型共享后续项，非阻塞本任务验收；回归 26/26 通过，`tsc --noEmit` 无报错）；MJ component deep parity and Seedance/live-person flows are out of scope for the local Phase A pass; text polish runtime remains in Task 45） |
| REQ-094 | Style preset system: project default, node override, style library, deterministic prompt-before/prompt-after injection. | 进行中（shared contract + repository/IPC + runtime payload + image/video node selector + style library UI + project default selector slices） |
| REQ-095 | Asset library completion: import, metadata, folders, search/filter/sort, safe URLs, references, tombstone/delete, insert to canvas. | 未开始 |
| REQ-096 | Async run state for migrated node set: enqueue-only IPC, terminal events, one-shot reconciliation, prompt/reference snapshot composition. | 进行中（durable queue + worker + terminal fanout + real job.get/list/recover IPC + prompt/reference snapshot slices + typed migrated dispatch for audio/mjImage/videoCompose/superResolution/muxAudioVideo + typed migrated reopen reconciliation + typed migrated real-time writeback + canvas reopen one-shot reconciliation） |
| REQ-097 | Agent orchestration over migrated canvas vocabulary: sanitized CanvasPlan, clarify behavior, applyPlan, PlanRunner, dropped warnings. | 进行中（migrated run actions preserved by sanitizePlan and mapped into PlanRunner steps; built-in comic-drama planner emits migrated nodes through chat IPC; PlanCard shows migrated node/action summary in automated tests and Electron-adjacent coverage; human desktop review for autoExecute terminal state pending） |
| REQ-098 | User-centered completion evidence: automated tests plus human desktop review scenarios before final acceptance. | 进行中（`docs/progress/human-desktop-review-checklist.md` 已建立；人工审核结果待填写） |

---

## hjwall Assets + Workflows 100% Migration (Phase A)

> Added: 2026-06-27
> Canonical spec: `specs/hjwall-assets-workflows-100-migration/`
> Scope: first migrate hjwall `assets` and `workflows/workflow-canvas` modules
> with UI details; Agent expansion and infinite canvas follow after manual
> asset/workflow parity and Tool/UI equivalence.

| Area | Status | Notes |
| :--- | :--- | :--- |
| Inventory and gap audit | ✅ | Machine-readable `INV-AW-*` capability inventory recorded in `docs/progress/hjwall-assets-workflows-gap-analysis.md`; static coverage test added in Phase 0. |
| Assets module parity | 进行中 | Asset category/tag contracts, SQLite tables, repository, IPC, typed preload bridge, PNG import metadata, URL-synced type tabs with counts/date filter, custom category create/edit/delete UI, preview category assignment/removal, canvas categorized insertion modes, durable canvas/job asset reference wiring, multi-file import progress, batch select/delete, and asset display rename are started; pagination/infinite loading remains next. |
| Workflow project/template parity | 进行中 | Task 13-15 project/template slices are implemented: summary metadata, my/public tabs, project cards, public template listing, and copy-to-draft. Import/export hardening, delete/copy refinements, versions, and validation modes remain. |
| Canvas shell and interaction parity | 未开始 | Full toolbar/menu/panels/shortcuts/drop/edge semantics parity. |
| Tool/UI equivalence | 进行中 | Existing tools cover query/propose/create/connect/update/delete/run; remaining graph/node/edge/selection/layout/snippet/asset/workflow/style/job/media capabilities must be tool/service backed. |
| Production node UI parity | 未开始 | Replace generic migrated placeholders with production node components. |
| Runtime async parity | 未开始 | Generation/polish recovery, run history, URL refresh, graph compiler, strict/draft validation. |
| Phase A acceptance gate | 进行中 | Automated evidence includes `phase-a-assets-workflows-smoke.test.ts`, inventory coverage, and checklist coverage. `HDR-PHASEA-001` remains Pending, so Phase A is not accepted until human review pass or explicit product deferral. |
| Agent after migration | 暂缓 | Must consume completed manual workflow vocabulary and completed ToolRuntime/service surface. |
| Infinite canvas evolution | 暂缓 | Starts after Phase A acceptance. |

---

## Conversation Context Engine (Agent 前置能力)

> Added: 2026-06-27
> Canonical spec: `specs/conversation-context-engine/`
> Scope: replace single-message Agent planning with workflow-scoped Context
> Packs: recent chat, canvas/asset context, knowledge retrieval, budgeting,
> redaction, compaction, and inspection. This is not LTM.

| Area | Status | Notes |
| :--- | :--- | :--- |
| Context contracts | 进行中 | `ContextPack`/`ContextBuildInput` exist; need extended fields for run/workflow/rendered context/warnings/token estimates. |
| Runtime integration | 未开始 | Orchestrator currently passes only current message to planner; must build Context Pack inside `agent.run`. |
| Recent conversation | 未开始 | `chat_messages` exists; need bounded workflow-scoped history and plan/job summaries. |
| Canvas/asset context | 未开始 | Need graph summary, selected nodes, selected assets, and invalid ref warnings. |
| Knowledge retrieval | 未开始 | `knowledge.repo.ts` is placeholder; first implementation can be lexical. |
| Compaction | 未开始 | Need conversation summaries and boundaries inspired by cc-haha `/compact`, without LTM. |
| Inspection UI/API | 未开始 | Need `context.getPack` and review surface for sources/citations/redactions. |

---

## Infinite Canvas + Agent + Gateway Binding Architecture

> Added: 2026-06-27
> Canonical spec: `specs/infinite-canvas-agent-gateway-architecture/`
> Scope: global roadmap for early manual canvas, middle-stage general Agent
> orchestration with sub-agents/tools, and later dynamic node I/O + multi-gateway
> binding protocol for third-party providers.

| Area | Status | Notes |
| :--- | :--- | :--- |
| Stage roadmap | 进行中 | Stage A manual canvas, Stage B Agent orchestration, Stage C dynamic gateway/infinite canvas. |
| Infinite canvas foundation | 未开始 | Need viewport, spatial/layout, large graph, graph patch/version strategy. |
| Tool/UI equivalence | 进行中 | Durable operations must be backed by tools/services before Agent automation. |
| Node Definition protocol | 未开始 | Need declarative data schema, UI schema, defaults, input/output ports, runtime actions. |
| Port-aware graph model | 未开始 | Need source/target port IDs, compatibility, legacy edge inference. |
| Runtime Compiler | 未开始 | Replace hard-coded `buildRunDescriptor` with normalized `NodeRunRequest`. |
| Gateway Binding protocol | 未开始 | Need adapter manifest, capability validation, parameter/result mapping. |
| Multi-gateway customization | 进行中 | Basic gateway registry exists; workflow/node/action binding and schema-driven params missing. |
| Output binding | 未开始 | Need normalized media/text/json outputs bound to node output ports and assets. |

---

## CI/CD Foundation

| ID | Requirement | Status |
| :--- | :--- | :--- |
| REQ-058 | Repository CI/CD foundation: reproducible Bun lockfile, lint/typecheck/test/build scripts, GitHub Actions CI, release dry-run, and repository hygiene checks that exclude local reference projects. | ✅ |
| REQ-059 | Frontend/backend build entry migration to Bun: pin `.bun-version`, use `bun.lock`, run CI/CD through `bun run`, and reject npm lock/config drift. | ✅ |
