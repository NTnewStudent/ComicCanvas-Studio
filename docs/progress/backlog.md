# ComicCanvas Studio — 总任务清单（Backlog）

> 全局真源。需求编号 REQ-xxx，状态：⬜ 未开始 / 🔵 进行中 / ✅ 完成 / 🅿️ 暂缓
> 全局 spec 入口见 `specs/README.md`；细粒度实现任务见 `specs/core-platform-foundation/tasks.md`、`specs/milestone-execution-plan/tasks.md` 与 `specs/canvas-agent-orchestration/tasks.md`。
> 最近更新：2026-07-05（RUEPE 当前执行项指针）

---

## 里程碑

| 里程碑 | 目标 | 状态 |
| :--- | :--- | :--- |
| **M0** 契约 & 治理 | shared/ 契约、根级 specs/ 全局 spec、Codex 治理、调研汇报 | ✅ |
| **M1** 骨架可跑 | Electron + DB + 队列 + 一个 stub provider 端到端跑通手动生图 | ✅ |
| **M2** 画布完整 | 三节点完整交互、连接校验、确定性 prompt、资产管线 | ✅ |
| **M3** 网关系统 | OpenAI 兼容适配 + 设置页 + 热拔插 + 真实生图/生视频 | ✅ |
| **M4** Agent 编排 | 主循环 + Canvas 工具集 + Plan 清洗/应用/串行执行 | ✅ |
| **M5** Agent 进阶 | super-agent + 子 agent spawn + 工具/agent 管理 UI | ✅ |

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
| REQ-050 | super-agent（allowedTools '*'，默认入口） | ✅ |
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

战术单线程执行指针见下表；Cursor 开发 Agent 按 `.cursor/rules/ruepe-task-execution.mdc` 仅处理表中 **一项** spec 任务。完成一项后更新指针与 `docs/progress/project-log.md`。

## 当前执行项（RUEPE 真源，单项）

| 字段 | 值 |
| :--- | :--- |
| spec | `specs/milestone-execution-plan/tasks.md` |
| task | 47 |
| 状态 | 已完成 |
| 阻塞原因 | — |

> M5 milestone-execution-plan **47/47 `[x]`**（2026-07-05）。
> 2026-07-08（用户显式指定项目，指针外完成）：Agent 对话 UI + Harness 工程完善
> （方案 A）Task 1–8 全部完成——`shared/chat-blocks.ts` 契约 + 块组件库 +
> chatStore 双入口切换 + `chat.history` 会话恢复 + compaction 分层压缩 +
> recovery 故障恢复；全量 vitest 160 文件/619 测试通过，assets-workflows
> Task 60 勾选 `[x]`（计划：`docs/superpowers/plans/2026-07-08-agent-chat-ui-harness.md`）。
> 下一战术项：**Phase D 整批人工验收**
> （`docs/progress/batch-human-acceptance-runbook-2026-07-05.md`，含新对话 UI
> 的 HDR-050/051 复验）。

**文档漂移待同步（Evaluate 时交叉核对）：**

- REQ-095 工程面已在 canvas spec tasks 22–24 与 assets-workflows tasks 6–12 闭环；本表 REQ 行简述待与人工验收结果一并更新（REQ-098 Pending）。

---

## hjwall Canvas Full Migration Reverification (REQ-090 ~ REQ-098)

> 新增：2026-06-26
> 权威 spec：`specs/hjwall-canvas-full-migration/`
> 范围：将 hjwall 画布用户能力迁移到 ComicCanvas，不含真实网关请求细节。旧里程碑行中已有的完成标签均为历史记录，需与当前实现、测试及人工桌面评审重新核实后才算确认。

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-090 | 基于证据的 hjwall 画布迁移清单与当前完成度审计。 | 进行中（2026-07-04：`docs/progress/hjwall-canvas-migration-inventory.md` 清单与 `docs/progress/backlog-claims-audit-2026-07-04.md` 逐条审计 REQ-077..085 已完成，发现并跟踪 2 项文档漂移：REQ-078 自动保存间隔与 REQ-082 节点"锁定"动作） |
| REQ-091 | 工作流项目生命周期：创建、列表、切换、重命名、删除、导入、导出、保存/加载恢复。 | 进行中（workflow JSON import/export IPC round trip、schemaVersion=1 validation、graph sanitize、invalid JSON rejection、secret/absolute-path rejection、imported-as-draft navigation、immutable version list/debug metadata、restore-as-new-version path、lenient draft validation warnings、strict run/validate blocking、渲染层 `/projects` JSON 导入/导出/版本 UI，以及 dirty-save switch/beforeunload guards 均已覆盖；2026-07-04 修复 `canvas.createWorkflow` 未落初始图版本的缺陷，并补全 `workflow.repo.ts` 全部导出方法的 `@see docs/api-contracts/canvas-plan.md` JSDoc 锚点（任务4已转 `[x]`）；人工桌面评审待完成） |
| REQ-092 | 画布交互对齐：工具栏、右键菜单、命令面板、拖拽媒体、片段、快捷键、连线反馈、零资产轮询。 | 进行中（image/video/audio 本地媒体拖拽在工程层面已完成，含批量分类、资产导入、光标邻近节点创建、不支持提示，以及 audio `asset.import` 持久化覆盖；片段核心的提取/插入含 ID 重映射、一条 undo 插入、持久化 `canvas_snippets` 存储、`canvasSnippet.*` IPC/preload API、精简版 CanvasPage 片段库选择器、通过共享校验实现的直接 ReactFlow 连线反馈、V2 @mention 候选/连线校验、选中节点复制/删除快捷键、命令面板筛选/执行、Ctrl/Cmd+K 唤起、fit-view 命令、select/pan ReactFlow 模式接线、connect-to-create 共享校验与允许目标筛选、可见画布文案质量门槛、CanvasPage React Flow/Zustand 所有权清理并配合受控的 store-to-React-Flow 同步、hjwall 风格顶部栏/左侧工具栏外壳对齐（含导入/导出/保存/任务/主题/默认样式/快捷键帮助/视口控件）、工具栏/加号/右键菜单/命令面板的添加节点路径、统一的保存/撤销/重做/复制/删除/适配/选择/平移/命令面板快捷键处理（含可编辑字段与 Mac Backspace 防护）、相关节点高亮及无效/重复连线的中文反馈、prompt 顺序/image 顺序/image 角色/输出引用渲染的语义化连线组件及共享删除逻辑，以及工作流/片段、资产、角色分类、样式、运行/任务、底部输入框与受 Agent 门控的聊天面板外壳接线均已覆盖；人工桌面评审待完成） |
| REQ-093 | 漫剧节点系统扩展：text/image/video 加上 character、scene、audio、imageConfigV2、videoConfigV2、videoCompose、superResolution、muxAudioVideo、mjImage 等垂直切片。 | 进行中（共享节点契约 + 连接矩阵 + Plan 白名单切片 + character/scene/audio/videoCompose/superResolution/muxAudioVideo/mjImage 的具体生产组件外壳均已覆盖；TextNode 的 inline/focus/rich/polish-status/mention/prompt 预览已覆盖；ImageNode/VideoNode 的安全预览、选择器、编辑入口、运行/状态、写回均已覆盖；ImageConfigV2/VideoConfigV2 的 prompt/模型/风格/比例（/时长/分辨率）控件、上游引用、可选结果与写回均已覆盖；2026-07-04 修复 imageConfigV2/videoConfigV2 的真实运行调度缺陷——`CanvasPage.tsx` 的 `jobTypeForNodeType` 与 `canvas.handler.ts` 的 `buildRunDescriptor` 此前未识别这两种 V2 类型（videoConfigV2 会退化成裸 image job，videoConfigV2 的生成按钮此前是纯 mock，点击后卡在 `running` 永不结束），现已路由到 `compileWorkflowNodeRuntimeSnapshot` 拿到拼接后的 prompt/画风/时长/分辨率参数，并通过 CanvasPage 新增的 `ImageConfigV2NodeWrapper`/`VideoConfigV2NodeWrapper` 注入真实 `onRun` 回调；同时移除了与 `node.data.status` 并行的 `canvasStore.nodeRunStatus` Map 机制（旧写法两套状态源不一致），统一以 `node.data.status` 为唯一真源，回归测试见 `tests/migrated-run-dispatch.test.ts`(7 tests)/`tests/image-config-v2-parity.test.tsx`(3 tests)/`tests/video-config-v2-parity.test.tsx`(3 tests)全部通过，`tsc --noEmit` 无报错；CharacterNode/SceneNode 的结构化字段、自定义分类元数据、资产查看意图、单/多引用生成意图、prompt 贡献预览及引用手柄均已覆盖（2026-07-04 任务14独立审计复核，确认属实：字段/连接矩阵/prompt拼接/素材库插入钩子/序列化往返均为真实实现，非占位，`character-scene-node-parity.test.tsx`/`production-node-components-parity.test.tsx`/`workflow-graph-compiler.test.ts`/`canvas-panels-parity.test.ts` 11/11 通过；`CharacterNodeData.viewMode` 字段声明但未被读写，记为非阻塞后续项）；2026-07-04 任务15独立审计复核（同样不接受子agent报告原文，逐项对照源码复核）：`AudioNode.tsx` 为真实生产组件，播放/资产绑定/时长展示/mux引用角色/导入查看按钮均非占位；连接矩阵 `audio -> video/videoConfigV2/muxAudioVideo`（及反向阻断）已强制并测试；`shared/assets.ts`/`asset.handler.ts` 端到端识别 audio/.mp3/audio-mpeg；`import-metadata.ts` 内含真实手写 MP3 帧头时长解析器（非 stub）；`workflow-graph-compiler.ts` 正确归类 audio 媒体类型并传递 durationSeconds；直接运行审计涉及的全部9个测试文件/32个测试，全部通过。识别三项非阻塞缺口：(1) `onImport`/`onViewAsset` 为真实组件 prop 且有测试覆盖，但 `CanvasPage.tsx` 未经 wrapper 注入回调——与任务14中 CharacterNode/SceneNode 已接受的同一模式一致，记为三节点类型共享的后续项；(2) `canvas.generateAudio` 运行调度管线（jobTypeForNodeType/buildRunDescriptor/runtime.ts stub worker）完整存在但 UI 不可达，`workflow-node-definitions.ts` 仍将 audio 标记 `runnable: false`——与本任务验收文本（未像任务16/17那样要求"run dispatch"）及 design.md 优先级排序一致，视为面向未来的预留基础设施，非待删除的死代码；(3) 资产导入时计算的 `AssetMetadata.durationMs` 从未回填到节点级 `AudioNodeData.durationSeconds`（`NodeAssetOption` 无时长字段，各素材插入路径均未传递），记为非阻塞后续项（对应任务14 `viewMode` 死字段先例），手动输入时长仍可用，当前无测试/需求断言自动回填。AudioNode 的导入/查看意图、播放、时长展示、mux 输入承接及引用角色语义均已覆盖（任务15已闭环，见上）；VideoComposeNode/MuxAudioVideoNode 的有序输入角色控件、转场/模型选项、仅票据式运行意图、终态输出预览及输出写回均已覆盖（2026-07-04 任务16闭环：审计发现并修复真实缺陷——`videoCompose`/`superResolution`/`muxAudioVideo` 此前在 `CanvasPage.tsx` 的 `nodeTypes` 中直接注册裸组件而非 wrapper，导致 `onRun` 始终为 `undefined`；三个组件的 `handleRun` 均为 `update({ status: 'running', url: '' }); onRun?.(id)`，点击"运行"后节点卡死在 `running` 永不恢复，且运行按钮在该状态下自我禁用，无恢复路径——这是真实的运行期回归缺陷，直接阻塞本任务"run dispatch to stub job"验收项。已新增 `VideoComposeNodeWrapper`/`SuperResolutionNodeWrapper`/`MuxAudioVideoNodeWrapper`，遵循既有 `ImageNodeWrapper`/`VideoConfigV2NodeWrapper` 先例通过 `useCanvasRunContext()` 注入真实 `onRun`，`handleRunNode`/`jobTypeForNodeType` 路由本已正确，仅 UI 接线缺失；新增 `tests/task16-post-production-run-dispatch.test.ts`（5 tests）填补覆盖缺口，`tsc --noEmit` 无报错，回归 22/22 通过。两项非阻塞缺口（`onWriteOutputAsset` 未接线、stub handler 不产生 asset 引用）与已闭环任务的既有模式一致，记为跨节点类型共享后续项）；SuperResolutionNode 的输入视频、场景/分辨率/帧率控件、仅票据式运行意图、终态输出预览及输出写回均已覆盖（2026-07-04 任务17闭环：`superResolution` 端到端运行调度已通过任务16的 wrapper 修复验证，同时确认 Agent-tool 层 `tools/canvas/index.ts` 的 `canvas.runNode` 独立按 `getNodeDefinition` 路由到同一 job 类型；`mjImage` 确认为设计上刻意不可运行——`workflow-node-definitions.ts` 标记 `runnable: false, addable: false, connectCreate: false` 并附 `unavailableReason`，CanvasPage 的 `jobTypeForNodeType` 返回 `null`，Agent-tool 层抛出分类错误而非静默忽略，符合 R4.7"不支持的节点类型必须可见标注为不可用"验收条款，非缺陷；识别两项非阻塞缺口（`buildRunDescriptor` 对 scene/resolution/fps 等参数仅做可选字段透传、无 Zod 范围/枚举校验——项目范围内所有节点类型均无此类校验，非本任务特有缺口；`canvas.upscaleVideo` stub 不产生 asset 引用，与任务16已接受的同类 stub 缺口形状一致），均记为跨节点类型共享后续项，非阻塞本任务验收；回归 26/26 通过，`tsc --noEmit` 无报错）；MJ 组件深度对齐及 Seedance/真人出镜流程不在本次本地 Phase A 范围内；text polish 运行时仍在任务45中处理） |
| REQ-094 | 样式预设系统：项目默认值、节点级覆盖、样式库、确定性的 prompt 前置/后置注入。 | ✅（工程面；人工验收 REQ-098 Pending） |
| REQ-095 | 资产库完善：导入、元数据、文件夹、搜索/筛选/排序、安全 URL、引用、软删除/删除、插入到画布。 | ✅（工程面；人工验收 REQ-098 Pending） |
| REQ-096 | 迁移节点集的异步运行状态：仅入队式 IPC、终态事件、一次性对账、prompt/引用快照拼接。 | ✅（工程面；人工验收 REQ-098 Pending） |
| REQ-097 | 面向迁移后画布词汇的 Agent 编排：经清洗的 CanvasPlan、澄清行为、applyPlan、PlanRunner、dropped 警告。 | ✅（工程面；人工验收 REQ-098 Pending） |
| REQ-098 | 以用户为中心的完成证据：最终验收前需自动化测试加人工桌面评审场景。 | 进行中（`docs/progress/human-desktop-review-checklist.md` 已建立；人工审核结果待填写） |

---

## hjwall Assets + Workflows 100% Migration (Phase A)

> 新增：2026-06-27
> 权威 spec：`specs/hjwall-assets-workflows-100-migration/`
> 范围：先迁移 hjwall 的 `assets` 与 `workflows/workflow-canvas` 模块及其 UI 细节；Agent 扩展与无限画布在手动资产/工作流对齐及 Tool/UI 等价完成后再展开。

| 领域 | 状态 | 备注 |
| :--- | :--- | :--- |
| 清单与差距审计 | ✅ | 机器可读的 `INV-AW-*` 能力清单记录在 `docs/progress/hjwall-assets-workflows-gap-analysis.md`；Phase 0 已新增静态覆盖测试。 |
| 资产模块对齐 | 进行中 | 资产分类/标签契约、SQLite 表、仓储层、IPC、类型化 preload 桥接、PNG 导入元数据、带计数/日期筛选的 URL 同步类型标签页、自定义分类创建/编辑/删除 UI、预览分类分配/移除、画布分类插入模式、持久化画布/任务资产引用接线、多文件导入进度、批量选择/删除、资产显示重命名均已启动；分页/无限加载为下一步。 |
| 工作流项目/模板对齐 | 进行中 | 任务13-15 项目/模板切片已实现：摘要元数据、我的/公开标签页、项目卡片、公开模板列表、复制为草稿。导入/导出加固、删除/复制细化、版本管理及校验模式仍待完成。 |
| 画布外壳与交互对齐 | 未开始 | 完整的工具栏/菜单/面板/快捷键/拖放/连线语义对齐。 |
| Tool/UI 等价 | 进行中 | 现有工具已覆盖 query/propose/create/connect/update/delete/run；剩余的 graph/node/edge/selection/layout/snippet/asset/workflow/style/job/media 能力须以 tool/service 支撑。 |
| 生产节点 UI 对齐 | 未开始 | 用生产节点组件替换通用迁移占位组件。 |
| 运行时异步对齐 | 未开始 | 生成/润色恢复、运行历史、URL 刷新、graph compiler、严格/草稿校验模式。 |
| Phase A 验收门槛 | 进行中 | 自动化证据包括 `phase-a-assets-workflows-smoke.test.ts`、清单覆盖与检查清单覆盖。`HDR-PHASEA-001` 仍为 Pending，故 Phase A 在人工评审通过或产品明确延后决定之前不算验收通过。 |
| 迁移后的 Agent | 暂缓 | 须在手动工作流词汇与 ToolRuntime/service 层完成后再消费。 |
| 无限画布演进 | 暂缓 | 在 Phase A 验收通过后启动。 |

---

## Conversation Context Engine (Agent 前置能力)

> 新增：2026-06-27
> 权威 spec：`specs/conversation-context-engine/`
> 范围：用工作流范围的 Context Pack 取代单消息式 Agent 规划：最近对话、画布/资产上下文、知识检索、预算控制、红化、压缩与检视。这不是 LTM。

| 领域 | 状态 | 备注 |
| :--- | :--- | :--- |
| Context 契约 | 进行中 | `ContextPack`/`ContextBuildInput` 已存在；需要为 run/workflow/rendered context/warnings/token 估算扩展字段。 |
| 运行时集成 | 未开始 | Orchestrator 目前只把当前消息传给 planner；须在 `agent.run` 内部构建 Context Pack。 |
| 最近对话 | 未开始 | `chat_messages` 已存在；需要有边界的工作流范围历史记录及 plan/job 摘要。 |
| 画布/资产上下文 | 未开始 | 需要图摘要、已选节点、已选资产及无效引用警告。 |
| 知识检索 | 未开始 | `knowledge.repo.ts` 目前是占位实现；首个版本可采用词法检索。 |
| 压缩 | 未开始 | 需要参考 cc-haha `/compact` 思路的对话摘要与边界处理，但不涉及 LTM。 |
| 检视 UI/API | 未开始 | 需要 `context.getPack` 及用于查看来源/引用/红化情况的界面。 |

---

## Infinite Canvas + Agent + Gateway Binding Architecture

> 新增：2026-06-27
> 权威 spec：`specs/infinite-canvas-agent-gateway-architecture/`
> 范围：全局路线图——早期手动画布、中期具备子agent/工具的通用 Agent 编排、后期面向第三方 provider 的动态节点 I/O 与多网关绑定协议。

| 领域 | 状态 | 备注 |
| :--- | :--- | :--- |
| 阶段路线图 | 进行中 | Stage A 手动画布，Stage B Agent 编排，Stage C 动态网关/无限画布。 |
| 无限画布基础 | 未开始 | 需要视口、空间/布局、大规模图、图 patch/版本策略。 |
| Tool/UI 等价 | 进行中 | 持久化操作必须先由 tool/service 支撑，才能进行 Agent 自动化。 |
| 节点定义协议 | 未开始 | 需要声明式数据 schema、UI schema、默认值、输入/输出端口、运行时动作。 |
| 支持端口的图模型 | 未开始 | 需要 source/target 端口 ID、兼容性、旧版连线推断。 |
| 运行时编译器 | 未开始 | 用规范化的 `NodeRunRequest` 取代硬编码的 `buildRunDescriptor`。 |
| 网关绑定协议 | 未开始 | 需要适配器清单、能力校验、参数/结果映射。 |
| 多网关定制 | 进行中 | 基础网关注册表已存在；工作流/节点/动作绑定及 schema 驱动的参数仍缺失。 |
| 输出绑定 | 未开始 | 需要将规范化的 media/text/json 输出绑定到节点输出端口与资产。 |

---

## Agent 对话 UI + Harness 工程完善（REQ-099 ~ REQ-100）

> 新增：2026-07-08
> 权威 spec：`docs/superpowers/specs/2026-07-08-agent-chat-ui-harness-design.md`
> 实施计划：`docs/superpowers/plans/2026-07-08-agent-chat-ui-harness.md`（Task 1–8 全部 `[x]`）
> 参考对照：cc-haha 桌面端消息块体系与 Agent 框架（仅设计参考，不引源码）。

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-099 | Agent 对话重构（方案 A，契约先行）：`shared/chat-blocks.ts` 消息块契约 + 纯 reducer（主进程/渲染层同源组装）；块组件库（Markdown+代码高亮、思考折叠、工具块、内联权限、错误/用量）；统一 chatStore 双入口切换（ChatPanel/CanvasChatBox 薄壳化）；`chat_messages.blocks_json` 持久化 + `chat.history` IPC + 会话恢复；harness 分层压缩（L1 头尾裁剪/L2 历史折叠/L3 AutoCompact 降级硬截断）与故障恢复（网关退避重试、上下文超限反应式压缩、工具失败循环保护，errorClass：`gateway_retry_exhausted`/`compaction_failed`/`tool_failure_loop`）。 | ✅（工程面：typecheck 通过，全量 vitest 160 文件/619 测试通过；专项测试 chat-blocks 10、chat-blocks-ui 9、chat-store 11、chat-history 3、agent-compaction 8、agent-recovery 6；HDR-050/051 桌面人工复验 Pending） |
| REQ-100 | 对话界面排版布局优化：`.cc-markdown` 聊天 Markdown 排版与代码高亮主题（wf-neo token 配色，覆盖标题/列表/表格/引用/行内码/代码块）；`/chat` 页改为居中限宽（max-w-3xl）全高列布局，消息区 flex-1 填充 + 空态占位；消息气泡角色化（用户右对齐 85% 宽、assistant 94% 宽、不对称圆角）；画布浮窗消息区高度提升为 46vh。 | ✅（工程面：typecheck 通过，chat-blocks-ui/chat-ui/canvas-chatbox 28 测试通过；桌面人工评审随 HDR-050/051 一并 Pending） |

---

## CI/CD 基础设施

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-058 | 仓库 CI/CD 基础设施：可复现的 Bun lockfile、lint/typecheck/test/build 脚本、GitHub Actions CI、release dry-run，以及排除本地参考项目的仓库卫生检查。 | ✅ |
| REQ-059 | 前后端构建入口迁移到 Bun：固定 `.bun-version`、使用 `bun.lock`、通过 `bun run` 运行 CI/CD，并拒绝 npm lock/配置漂移。 | ✅ |
