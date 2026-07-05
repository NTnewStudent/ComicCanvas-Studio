# hjwall Canvas 迁移清单

日期：2026-06-26

标准规格：`specs/hjwall-canvas-full-migration/`

本清单记录必须在 ComicCanvas 中重新实现或明确适配的、用户可见的 hjwall canvas 能力。它刻意以证据为导向：历史 backlog 中标记为完成的行，在当前实现、测试与人工桌面复核三者一致确认之前，不视为完成证明。

## 参考边界

仅供参考的模块：

| 区域 | hjwall 参考 |
| :--- | :--- |
| Canvas 外壳与交互 | `hjwall/pc-client/src/modules/workflow-canvas/WorkflowCanvasPage.tsx` |
| Canvas 项目页面 | `hjwall/pc-client/src/modules/workflow-canvas/views/` |
| Canvas store 与图序列化 | `hjwall/pc-client/src/modules/workflow-canvas/store.ts`, `lib/graph.ts` |
| 连接规则 | `hjwall/pc-client/src/modules/workflow-canvas/lib/connectRules.ts`, `backend/src/modules/workflow/workflow.constants.ts` |
| 资产库 | `hjwall/pc-client/src/modules/asset/`, `workflow-canvas/components/AssetLibraryPanel.tsx` |
| 样式库 | `hjwall/backend/src/modules/style/`, `workflow-canvas/components/StyleLibraryPanel.tsx` |
| 异步生成状态 | `hjwall/pc-client/src/modules/workflow-canvas/hooks/useGenerationTasks.ts`, `backend/src/modules/workflow/*generation*` |
| Agent 编排 | `hjwall/backend/src/modules/workflow/workflow-chat.service.ts`, `pc-client/src/modules/workflow-canvas/lib/plan-applier.ts`, `lib/plan-runner.ts` |

`hjwall/` 中的任何源文件都不得复制进 ComicCanvas。

## 当前 ComicCanvas 证据快照

| 证据 | 当前发现 | 迁移影响 |
| :--- | :--- | :--- |
| `shared/nodes.ts` | 当前节点联合类型包含 `text`、`image`、`video`、`imageConfigV2`、`videoConfigV2`。 | 缺失生产语义节点：character、scene、audio、videoCompose、superResolution、muxAudioVideo、mjImage。 |
| `shared/connection-matrix.ts` | 矩阵只覆盖当前狭窄的节点集合。 | 必须先扩展，迁移后的节点 UI/运行时才能保持真实性。 |
| `desktop/src/renderer/src/canvas/CanvasPage.tsx` | 已有工具栏、右键菜单、资产面板、聊天框、save/load 以及项目管理器接线。 | 需要人工桌面复核，并补齐拖放/片段/命令面板对等的缺失部分。 |
| `desktop/src/renderer/src/canvas/nodes/` | 已有 text/image/video 以及 image/video config V2 组件。 | 现有 V2 节点包含仅前端的样式占位行为，必须替换为真实样式契约。 |
| `desktop/src/main/db/schema.ts` | 已有 workflows、workflow_versions、assets、asset_folders、asset_references、jobs、chat_messages。 | 基础良好；缺少样式预设表/契约。 |
| `desktop/src/main/ipc/canvas.handler.ts` | 已有 save/load/applyPlan/runPlan/list/create/rename/delete workflow 处理器。 | 需要项目生命周期加固、导入/导出、运行调度扩展，以及完整的 JSDoc/契约审计。 |
| `desktop/src/main/ipc/asset.handler.ts` | 已有 import/list/move/trash/folder 处理器。 | 需要元数据提取、引用接线、桌面端插入流程验证。 |
| `tests/` 下的测试 | 存在广泛的 M1-M5 单元/组件覆盖。 | 通过孤立测试还不够；最终验收仍需人工桌面复核。 |
| `docs/progress/hjwall-migration-report.md` | 记录了已知局限：ChatBox 占位、@mention 边校验缺口、固定的自动保存间隔、native 模块 ABI 问题。 | 这些是后续任务，不是已完成的迁移证据。 |

## 能力清单

| ID | hjwall 能力 | ComicCanvas 状态 | 差距 / 适配方案 | Target REQ |
| :--- | :--- | :--- | :--- | :--- |
| INV-CANVAS-001 | 项目列表，含本地用户项目与模板入口。 | Partial：画布内部存在项目管理器；项目列表页单独存在。 | 需要一条已验证的桌面端流程：从列表创建项目、打开画布、保存/重新打开、删除。 | REQ-091 |
| INV-CANVAS-002 | Workflow 图 save/load，含 dirty 状态与离开守卫。 | Partial：渲染层/主进程中存在 save/load 与自动保存。 | 需要冲突/dirty 守卫的证明，以及非法边加载警告。 | REQ-091 |
| INV-CANVAS-003 | 导入/导出 workflow JSON。 | 在当前 Electron 实现中未验证。 | 若缺失则新增 IPC/UI；校验图与资产路径安全性。 | REQ-091 |
| INV-CANVAS-004 | 工具栏快速添加与添加菜单。 | Partial：工具栏快捷工具已存在。 | 需要命令面板对等以及桌面快捷键验证。 | REQ-092 |
| INV-CANVAS-005 | 画布右键添加节点与节点操作菜单。 | Partial：画布空白处/节点右键菜单已存在。 | 需要复制/删除测试以及光标处添加的桌面端验证。 | REQ-092 |
| INV-CANVAS-006 | Connect-to-create 与语义化边推断。 | 在 hjwall 参考中为 Partial；在当前 ComicCanvas 中未完成。 | 新增或明确推迟 connect-to-create；所有路径都必须使用共享矩阵。 | REQ-092 |
| INV-CANVAS-007 | 本地媒体拖放到画布。 | 在当前观察到的 ComicCanvas 画布中缺失。 | 实现通过资产管线导入以及在拖放位置创建节点。 | REQ-092, REQ-095 |
| INV-CANVAS-008 | 选区操作栏以及将选中节点保存为可复用片段。 | 在当前 ComicCanvas 中缺失或未验证。 | 新增片段存储、ID 重映射插入、undo 快照。 | REQ-092 |
| INV-CANVAS-009 | 画布操作的命令面板。 | 在当前 ComicCanvas 中缺失。 | 结合 ComicCanvas 节点/操作与快捷键重新实现。 | REQ-092 |
| INV-CANVAS-010 | 快捷键：undo、redo、save、duplicate、delete、fit、pan/select、命令面板。 | Partial：undo/redo/save 与上下文操作已存在。 | 集中化并测试快捷键行为。 | REQ-092 |
| INV-NODE-001 | 文本节点，含 prompt 贡献、聚焦编辑、内联重命名、润色状态。 | Partial：文本节点与测试已存在。 | 补齐/验证润色状态与 prompt 贡献对等。 | REQ-093 |
| INV-NODE-002 | 图片与视频资产节点，含安全预览。 | Partial：图片/视频节点已存在。 | 验证资产 ID/安全 URL 回写以及桌面端预览。 | REQ-093, REQ-095 |
| INV-NODE-003 | ImageConfigV2 自包含图片生成节点。 | Partial：组件已存在。 | 移除仅前端的样式预设；接入真实样式、运行、状态与资产引用。 | REQ-093, REQ-094, REQ-096 |
| INV-NODE-004 | VideoConfigV2 自包含视频生成节点。 | Partial：组件已存在。 | 完成样式选择、首尾帧/引用资产选取、运行/状态/结果流程。 | REQ-093, REQ-094, REQ-096 |
| INV-NODE-005 | 角色节点与角色库插入。 | 缺失于共享节点契约。 | 新增契约、UI、prompt/引用语义、资产插入。 | REQ-093 |
| INV-NODE-006 | 场景节点与场景引用工作流。 | 缺失于共享节点契约。 | 新增契约、UI、prompt/引用语义。 | REQ-093 |
| INV-NODE-007 | 音频节点与音频资产支持。 | 缺失于共享节点契约。 | 新增导入/预览/连接支持。 | REQ-093, REQ-095 |
| INV-NODE-008 | 视频合成节点。 | 缺失于共享节点契约。 | 新增图/运行调度以及占位输出。 | REQ-093, REQ-096 |
| INV-NODE-009 | 超分辨率节点。 | 缺失于共享节点契约。 | 新增参数、图/运行调度以及占位输出。 | REQ-093, REQ-096 |
| INV-NODE-010 | 混音音视频节点。 | 缺失于共享节点契约。 | 新增图规则、音频+视频输入、运行调度、输出。 | REQ-093, REQ-096 |
| INV-NODE-011 | MJ 多图生成节点。 | 缺失于共享节点契约。 | 若被采纳，新增多结果 UI 与资产回写策略。 | REQ-093, REQ-096 |
| INV-STYLE-001 | 样式预设列表/详情，含封面与启用状态。 | 缺失真实的 ComicCanvas 样式契约/仓储。 | 新增 `shared/styles.ts`、`docs/api-contracts/styles.md`、schema/仓储/IPC/UI。 | REQ-094 |
| INV-STYLE-002 | 项目默认样式与节点覆盖。 | 仅在 V2 节点上存在 Partial 数据字段。 | 在 workflow/项目上持久化默认样式，并在运行时解析继承关系。 | REQ-094 |
| INV-STYLE-003 | 确定性样式 prompt 注入。 | 缺失当前 shared/主进程函数的证据。 | 实现纯函数 composeStyledPrompt 以及字节等价性测试。 | REQ-094 |
| INV-ASSET-001 | 资产文件夹、搜索、筛选、排序。 | Partial：资产文件夹 UI/仓储工作已存在。 | 用桌面端验证并补齐缺失的加载/错误/插入状态。 | REQ-095 |
| INV-ASSET-002 | 带元数据与安全 URL 的资产导入。 | Partial：导入处理器已存在；元数据提取有限。 | 在可行范围内新增 orientation/时长提取以及用户可见的导入错误提示。 | REQ-095 |
| INV-ASSET-003 | 资产引用完整性。 | Partial：asset_references 表/仓储概念已存在。 | 接线节点/任务引用以及删除拦截/tombstone UI。 | REQ-095 |
| INV-RUN-001 | 仅入队的生成流程与终态事件回写。 | Partial：针对当前节点集合已有 jobs 与测试。 | 扩展到迁移后的节点集合，并在桌面端验证无阻塞式 UI。 | REQ-096 |
| INV-RUN-002 | 重新打开后的一次性任务对账。 | Partial：事件驱动的 hook 已存在；完整流程未验证。 | 新增针对遗漏事件的显式对账测试。 | REQ-096 |
| INV-AGENT-001 | 自然语言到完整漫剧 CanvasPlan。 | Partial：针对狭窄节点集合，编排器与 Plan 流程已存在。 | 扩展 plan 词汇表，并为迁移后的节点/样式/资产明确 clarify 行为。 | REQ-097 |
| INV-AGENT-002 | Plan 应用与在迁移后节点上的串行运行。 | Partial：applyPlan 与 PlanRunner 已存在。 | 扩展运行步骤映射与丢弃项警告。 | REQ-097 |
| INV-QA-001 | 完整漫剧路径的人工桌面复核。 | 在当前证据中尚未完成。 | 人工复核者启动应用，从用户视角验证项目/画布/资产/样式/agent 流程。 | REQ-098 |

## 立即执行顺序

1. 准备人工桌面复核关卡，并修复复核中发现的黑屏/白屏问题。
2. 运行当前自动化关卡以建立新的基线。
3. 实现第一个缺失的用户关键切片：媒体拖放 + 资产插入到画布，因为它在不需要真实网关调用的情况下同时锻炼了画布、资产、IPC 与真实用户工作流。
4. 在扩展 V2 生成节点样式 UI 之前先实现样式预设契约，因为当前仅前端的预设列表否则会固化为一种演示行为。
5. 只以纵向切片的方式扩展共享节点/连接契约，且必须先有测试再启用 UI 交互。

## 已知风险

- 当前 backlog 中包含历史上标记为"完成"的项，其强度可能超过当前运行时证据所能支撑的程度。
- 现有文档在较旧的文件中存在混合编码；新规格应保持 UTF-8 且规范统一。
- 渲染层启动必须先通过人工复核，才能宣称最终 UI 验收通过。
- 工作区中的参考项目必须持续排除在提交之外。
