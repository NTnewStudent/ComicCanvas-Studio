# 人工桌面端评审检查清单

创建日期：2026-06-27

规范来源：`specs/hjwall-canvas-full-migration/`

人工 Runbook：`docs/progress/phase-a-human-review-runbook.md`

会话模板：`docs/progress/phase-a-human-review-session-template.md`

本检查清单取代由 agent 记录的真实桌面验收证据。Codex 负责实现评审、自动化测试，并保持本检查清单的最新状态。人工评审人负责最终桌面端用户流程的批准。

## 结果图例

| 结果 | 含义 |
| :--- | :--- |
| Pending | 尚未经人工评审。 |
| Pass | 人工评审人已完成该流程，无阻塞性问题。 |
| Fail | 人工评审人发现阻塞性问题。需要建立后续任务。 |
| N/A | 该流程对当前切片不适用。 |

## 评审规范

对每个流程，需记录：

- 评审人与日期。
- App 构建版本或 commit。
- 结果：Pending、Pass、Fail 或 N/A。
- 备注，包括评审人自愿提供的截图（如有）。
- 结果为 Fail 时的后续 issue 或任务。

当实现评审与自动化证据均通过时，工程完成可继续推进。最终产品验收要求相关人工桌面评审行必须为 Pass，或经产品决策明确延后。

## 产品延后决定（2026-07-05）

产品负责人决定将批量人工桌面验收延后，直到当前 RUEPE 队列中的工程任务全部完成。在批量评审会话之前：

- `HDR-PHASEA-001` 及相关 HDR 行在本检查清单中保持 **Pending**。
- 以 Phase A 为关卡的工程任务（例如 assets-workflows task 60）可以在实现完成后，凭自动化证据结项。
- 最终产品签收需要后续人工会话，使用
  `docs/progress/hjwall-canvas-phase7-human-review-scenarios.md` 与
  `docs/progress/phase-a-human-review-runbook.md`。

## 批量验收就绪（2026-07-05）

M5 工程队列已完成（milestone-execution-plan 47/47）。人工评审人应遵循 `docs/progress/batch-human-acceptance-runbook-2026-07-05.md` 执行 Phase 7 场景，并填写下方的 Pass/Fail 行。HDR 行在人工完成会话之前保持 Pending。

## 人工 Phase A 验收矩阵

Phase A 人工验收覆盖资产与自定义图片分类、项目/模板与片段（snippets）、画布外壳与迁移后的非 MJ 节点，以及运行时、风格、模型与工具等价性。

Agent 自动化仍不在 Phase A 范围内，此处不应作为验收证据使用。

MJ 节点/组件相关操作被排除在人工 Phase A 验收之外；旧版 MJ 图仅可打开以确认不支持/不可用的行为仍可读。

关于桌面评审顺序、R2 密钥处理规则、产品明确延后格式，以及 Task 60 关卡，请遵循 `docs/progress/phase-a-human-review-runbook.md`。

| 区域 | 必需评审行 | 验收说明 |
| :--- | :--- | :--- |
| 资产与分类 | HDR-042, HDR-043, HDR-ASSET-001 至 HDR-ASSET-009 | 覆盖本地导入、R2/SQLite 存储行为、用户自定义图片分类、安全引用，以及画布插入。 |
| 工作流与片段 | HDR-WF-001 至 HDR-WF-006, HDR-024 | 覆盖项目生命周期、导入/导出、公共模板复制、片段插入/删除、校验，以及 ID 重新映射。 |
| 画布与节点 UI | HDR-CANVAS-001 至 HDR-CANVAS-005, HDR-NODE-001, HDR-NODE-002 | 覆盖外壳布局、面板、本地拖放、连线、迁移后的非 MJ 生产节点、编辑弹窗，以及 prompt/引用控件。 |
| 运行时与工具 | HDR-RUNTIME-001, HDR-RUNTIME-002, HDR-TOOLS-001 | 覆盖节点定义、异步恢复、运行历史、URL 刷新、风格/模型、结构化错误，以及在不启用 Agent 自动化的前提下 Agent 可用的工具词汇表。 |
| 最终通过 | HDR-PHASEA-001 | 仅当所有必需行均为 Pass，或经产品决策明确延后，方可通过验收。 |

## 启动与导航

| ID | 流程 | 结果 | 评审人 / 日期 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| HDR-001 | 启动 Electron app 并确认项目列表可见。 | Pending |  |  |
| HDR-002 | 打开一个项目并确认画布渲染出可见的节点、工具栏和面板。 | Pending |  |  |
| HDR-003 | 在 `/projects` 与 `/canvas` 之间导航，且不出现空白或无法访问的界面。 | Pending |  |  |

## Workflow 项目生命周期

| ID | 流程 | 结果 | 评审人 / 日期 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| HDR-010 | 从项目列表创建一个项目并在画布中打开。 | Pending |  |  |
| HDR-011 | 重命名、切换，以及软删除一个项目。 | Pending |  |  |
| HDR-012 | 导入一个有效的 workflow JSON 作为新项目。 | Pending |  |  |
| HDR-013 | 导出当前 workflow JSON 并重新导入。 | Pending |  |  |
| HDR-014 | 尝试导入无效的 workflow JSON，并确认反馈信息可读。 | Pending |  |  |
| HDR-015 | 触发脏状态切换、关闭以及返回导航的守卫。 | Pending |  |  |
| HDR-WF-001 | 检查 hjwall 对齐的我的/公共 workflow 项目 tabs、卡片、创建、导入、复制与删除。 | Pending |  | 工程切片已实现我的/公共 tabs、创建/导入/删除、公共模板元数据卡片，以及将公共模板复制接入草稿创建；最终视觉验收为人工完成。 |
| HDR-WF-002 | 确认 workflow 卡片显示封面、节点/边数量、更新时间、运行状态，以及归档/私有/公开状态。 | Pending |  | 工程切片已显示封面、节点/边数量、更新时间、运行状态、归档状态与警告数量；最终视觉验收为人工完成。 |
| HDR-WF-003 | 将公共模板复制为私有草稿并打开。 | Pending |  | 工程切片持久化模板元数据/scope/published/visibility 状态，列出 public/my/all 三种 scope，将最新图版本复制为私有草稿，并针对本地类管理员场景做了严格校验发布关卡。 |
| HDR-WF-004 | 导入/导出 workflow JSON，并确认被丢弃项的警告可见。 | Pending |  | 工程切片会拒绝无效 schema、密钥与绝对路径；对导入图内容做清洗；以私有草稿形式导入；导航到导入后的画布；并显示被丢弃项的警告。最终产品验收为人工桌面评审。 |
| HDR-WF-005 | 检查版本/调试元数据，以及严格/宽松校验反馈。 | Pending |  | 工程切片列出不可变的图版本，包含创建时间、创建者、校验和、节点/边数量、警告摘要、还原来源、"还原为新版本"行为、宽松草稿保存警告、持久化的校验警告摘要，以及严格运行/校验的阻塞性错误。最终视觉/产品验收为人工桌面评审。 |
| HDR-WF-006 | 列出、查看、删除，以及插入带重新映射 ID 的片段/模板。 | 片段/模板工程已完成；人工评审待进行 |  | Task 48 覆盖片段的 public/my scope、元数据、详情片段、拥有者删除保护、WorkflowPanel 元数据/删除 UI，以及带重新映射 ID 与单次 undo 快照的插入。Task 49 覆盖模板元数据、public/my/all 列表 scope、复制为草稿、以草稿方式导入的安全性，以及严格发布校验。 |

## 画布交互

| ID | 流程 | 结果 | 评审人 / 日期 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| HDR-020 | 从工具栏、右键菜单和命令面板添加节点。 | Pending | Task 21 工程已完成：工具栏快捷工具、加号菜单、画布空白处右键菜单、命令面板添加命令，以及"连线创建"允许目标筛选均已被自动化测试覆盖。人工桌面评审仍需确认放置位置与交互手感。 |  |
| HDR-021 | 使用复制、删除、适配视图、平移/选择模式，以及命令面板快捷键。 | Pending | Task 22 工程已完成：统一键盘处理器覆盖保存、undo/redo、复制/删除、适配视图、选择/平移模式、命令面板、可编辑字段保护，以及仅 Mac 生效的 Backspace 删除行为。人工桌面评审仍需确认操作系统层面的键盘手感。 |  |
| HDR-022 | 将图片、视频、音频文件拖到画布上，并确认节点被创建。 | Pending | Task 23 工程已完成：本地批量拖放规划覆盖图片/视频/音频分类、不支持文件的反馈、资产导入，以及在光标附近创建节点。人工桌面评审仍需确认拖放手感与原生文件行为。 |  |
| HDR-023 | 尝试无效和重复的连接，并确认中文反馈能快速出现。 | Pending | Task 24 工程已完成：重复和无效连线路径共用同一套校验逻辑，并渲染中文反馈。人工桌面评审仍需确认时机与视觉呈现位置。 |  |
| HDR-024 | 将选中的子图保存为片段，并插入到另一个项目中。 | Pending |  |  |
| HDR-CANVAS-001 | 检查顶部栏、左侧工具栏、保存/导入/导出、默认风格、任务状态、加号菜单、主题，以及快捷键提示。 | Pending | Task 19 归属清理、Task 20 外壳对齐、Task 21 添加节点路径，以及 Task 22 快捷键对齐均已工程完成。自动化覆盖检查了顶部栏导入/导出/保存/任务/主题/默认风格控件、左侧工具栏功能、快捷键帮助、独立的视口控件、命令面板节点创建、连线创建候选筛选，以及快捷键处理。最终视觉验收仍为人工桌面评审。 |  |
| HDR-CANVAS-002 | 拖放本地图片/视频/音频文件，并确认导入以及节点在光标处的放置。 | Pending | Task 23 工程已完成：多文件拖放会导入受支持的媒体、报告被拒绝/失败的项目，并在拖放点附近以错落方式创建画布节点。最终验收仍为人工桌面评审。 |  |
| HDR-CANVAS-003 | 悬停/选中相关节点，并在所有创建路径下确认无效/重复连接反馈。 | Pending | Task 24 工程已完成：悬停、单选和拖拽释放时直接相邻节点会高亮；无效/重复连接反馈已被自动化测试覆盖。人工桌面评审仍需在真实画布流程中确认视觉清晰度。 |  |
| HDR-CANVAS-004 | 检查 prompt 顺序、图片顺序、图片角色、输出链接、引用，以及删除的语义化连线渲染。 | Pending | Task 25 工程已完成：语义化连线组件通过画布 store 渲染 prompt/图片顺序标签、图片角色标签、输出/引用标签，以及共享的删除控件。人工桌面评审仍需在真实画布上确认视觉清晰度与删除手感。 |  |
| HDR-CANVAS-005 | 检查 workflow、片段、资产、分类、风格、运行、底部输入，以及受限的聊天面板。 | Pending | Task 26 工程已完成：WorkflowPanel、CanvasAssetPanel、CharacterLibraryPanel、StyleLibraryPanel、CanvasJobPanel、BottomInputPanel，以及受限的 CanvasChatBox 已接入 CanvasPage 并配有工具栏入口。Task 50 用真实的风格列表/默认面板替换了风格占位组件。人工桌面评审仍需确认布局、面板堆叠，以及真实交互手感。 |  |

## 节点与运行流程

| ID | 流程 | 结果 | 评审人 / 日期 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| HDR-030 | 编辑 text、image、video、imageConfigV2 以及 videoConfigV2 节点。 | Text/image/video/imageConfigV2/videoConfigV2 工程已完成；人工评审待进行 |  | Task 28-31 覆盖 TextNode，以及 ImageNode/VideoNode 的安全预览、选择器、编辑入口、运行/状态、写回；ImageConfigV2 的 prompt/模型/风格/比例控件、上游图片引用、异步运行、结果选择与写回；以及 VideoConfigV2 的 prompt/模型/风格/时长/比例/分辨率控件、首帧/尾帧/参考资产、异步运行与写回。Task 13（2026-07-04）修复了稳定化过程中发现的一个真实调度 bug：imageConfigV2/videoConfigV2 此前会落入空/无操作的运行路径（缺失 `jobTypeForNodeType` 分支、缺失 `CanvasPage` 运行上下文包装器，以及 `buildRunDescriptor` 跳过了 `compileWorkflowNodeRuntimeSnapshot`），并且这两个节点都有一套基于 `canvasStore.nodeRunStatus` Map 的重复状态机制与 `node.data.status` 并行运行，其中 VideoConfigV2 的生成按钮会将 `status` 设为 `'running'` 却永远没有退出的途径。三者现均已修复：节点现在带有真实的 `onRun` 回调，经由 `CanvasPage` 的运行上下文接到 `handleRunNode`/`window.comicCanvas.runCanvasNode`；`buildRunDescriptor` 将两种类型都路由到运行时快照编译器以完成 prompt/风格/时长/分辨率的组合；基于 Map 的状态存储已被移除，转而以 `node.data.status` 作为唯一真源。 |
| HDR-031 | 在可用时添加 character 与 scene 节点。 | Character/scene 工程已完成并经独立验证；人工评审待进行 |  | Task 14（2026-07-04）对 character/scene 进行了独立审计：真实的结构化组件、共享契约、连接矩阵行、prompt 贡献编译逻辑、从库中插入的 hook，以及序列化往返，在 `character-scene-node-parity.test.tsx`、`production-node-components-parity.test.tsx`、`workflow-graph-compiler.test.ts` 与 `canvas-panels-parity.test.ts` 中重新运行 11/11 测试并通过。 |
| HDR-031B | 在可用时添加 audio、videoCompose、muxAudioVideo 以及 superResolution 节点。 | Audio：工程已完成并经独立验证（task 15，2026-07-04）；videoCompose/muxAudioVideo/superResolution：工程已完成并经独立验证（task 16-17，2026-07-04）；mjImage：按设计有意不可运行（task 17，2026-07-04） |  | Task 15 独立审计了 audio 节点/资产集成：真实的播放/绑定/导入元数据解析/矩阵/序列化器支持，重新运行 9 个测试文件 / 32 个测试并通过。记录了三个非阻塞性缺口（与 character/scene 先例共用的失效 onImport/onViewAsset 接线、前瞻但不可达的 canvas.generateAudio 管线、时长未从资产元数据传播到节点数据）——详见 tasks.md 中 task 15 的证据。Task 16（2026-07-04）审计了 videoCompose/muxAudioVideo/superResolution，发现了一个真实的、此前未被发现的回归：这三种节点类型被注册为裸组件（没有 `CanvasPage.tsx` 包装器），因此它们的 `onRun` prop 始终为 `undefined`——点击"运行"会将 `status` 设为 `'running'`，之后什么都不会发生，且没有恢复路径（运行按钮在运行期间会自我禁用）。已通过按照现有 `ImageNodeWrapper`/`VideoConfigV2NodeWrapper` 先例添加 `VideoComposeNodeWrapper`/`SuperResolutionNodeWrapper`/`MuxAudioVideoNodeWrapper` 修复；新增 `tests/task16-post-production-run-dispatch.test.ts`（5 个测试）以补齐覆盖缺口；重新运行 22/22 测试通过，`tsc --noEmit` 干净。Task 17（2026-07-04）确认 superResolution 的运行调度现已端到端正确（CanvasPage UI 路径与独立的 Agent 工具 `canvas.runNode` 路径均已确认），并确认 mjImage 的不可运行性是按 R4.7 有意为之、多重强制的设计决定（`workflow-node-definitions.ts` 的 `runnable: false`/`unavailableReason`、`CanvasPage.tsx` 的 `jobTypeForNodeType` 返回 `null`，以及 Agent 工具层抛出分类化的"运行时不可用"错误），而非缺陷；重新运行 26/26 测试通过。两个任务均记录了非阻塞性缺口（参数校验在整个项目范围内仅为传递型；stub job 处理器不会创建资产引用，与此前已被接受的模式一致）——详见 tasks.md 中 task 16/17 的证据。 |
| HDR-032 | 运行 stub image/video/composition job，并确认 ticket-first 行为与终态 UI 状态。 | Pending |  |  |
| HDR-033 | 在任务完成后重新打开画布，并确认一次性对齐（reconciliation）且无可见轮询行为。 | Pending |  |  |
| HDR-NODE-001 | 检查迁移后的非 MJ 节点集的生产节点 UI，并确认占位行为已消除。 | 工程已完成；人工评审待进行 |  | Task 27 已注册具体组件；Task 28-35 覆盖当前的本地深度对齐。MJ 节点/组件不在本次本地 Phase A 验收范围内。 |
| HDR-NODE-002 | 检查图片编辑器、局部重绘（inpaint）关卡、资产选择器、媒体控件、已连接输入，以及提及（mention）文本框流程。 | 图片编辑器、inpaint 关卡、媒体输入控件、已连接输入，以及提及文本框工程已完成；更广泛的人工评审待进行 |  | Task 37-41 覆盖 ImageNode 编辑弹窗的裁剪百分比、旋转、朝向/宽高比预览、节点/资产应用目标、结构化的 ImageEditIntent 载荷、明确的本地 inpaint 不可用关卡及安全预览、图片/视频/音频选择器支持、共享的选择/清除控件、紧凑模式、外部 URL 关卡、prompt/图片顺序芯片、参考资产芯片、最终 prompt 预览的收敛，以及 MentionTextarea 的 token 芯片、光标下拉、IME 防护、原子化删除，与六处非 MJ 使用点。 |

## 风格与资产库

| ID | 流程 | 结果 | 评审人 / 日期 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| HDR-040 | 选择项目默认风格，并确认选中状态可见。 | 风格工程已完成；人工评审待进行 |  | Task 50 覆盖工具栏项目选择器，以及画布 StyleLibraryPanel 的列表/默认操作、封面/标签/默认标记渲染，以及清除已删除项目的默认值。 |
| HDR-041 | 选择节点级风格覆盖，并运行一次 stub 生成。 | 运行时工程已完成；人工评审待进行 |  | Task 50 覆盖节点覆盖优先于项目默认值、确定性的风格化 prompt 与负向 prompt 注入，以及禁用风格的严格校验会阻断入队。 |
| HDR-042 | 导入资产，在文件夹间移动，搜索/筛选/排序，并插入画布。 | Pending |  |  |
| HDR-043 | 尝试删除一个被引用的资产，并确认安全删除行为。 | Pending |  |  |
| HDR-ASSET-001 | 打开 `/assets` 并确认 tabs、计数、搜索、排序、筛选、加载、空状态与错误状态。 | 资产外壳工程已完成；人工评审待进行 |  | Task 7 覆盖 URL 同步的媒体 tabs/搜索/排序/日期筛选、带计数的类型 tabs、上传入口、响应式网格/列表外壳、文件夹/分类侧栏、骨架加载、错误反馈，以及空状态。 |
| HDR-ASSET-002 | 上传多个文件，并确认逐文件进度、当前文件名、成功后刷新，以及可读的失败信息。 | 上传卡片工程已完成；人工评审待进行 |  | Task 8 覆盖忙碌时禁用的上传入口、文件序号/总数/当前文件名、完成百分比、导入成功后的列表刷新，以及混合批次失败时带失败文件名的反馈。 |
| HDR-ASSET-003 | 预览、重命名、删除、选择，以及批量删除资产，退出后状态重置。 | 资产卡片/预览工程已完成；人工评审待进行 |  | Task 9 覆盖缩略图/回退图、预览元数据、图片/视频/回退预览、仅修改展示名而不改变 URL/路径、单个安全删除反馈，以及批量选择/删除后的重置。 |
| HDR-ASSET-004 | 确认内置的角色/场景/道具/生物图片分类，并创建一个自定义分类。 | Pending |  |  |
| HDR-ASSET-005 | 将图片资产分配到分类/标签，并按分类、标签、关键词、排序，以及媒体类型进行筛选。 | Pending |  |  |
| HDR-ASSET-006 | 在画布上下文允许的情况下，将一张已分类的图片作为 image、character、scene 与 reference 输入插入。 | Pending |  |  |
| HDR-ASSET-007 | 导入图片/视频/音频资产，并确认安全的元数据展示中不含绝对本地路径。 | Pending |  |  |
| HDR-ASSET-008 | 尝试将一个被分类引用的资产放入回收站，并确认阻止或墓碑（tombstone）行为。 | Pending |  |  |
| HDR-ASSET-009 | 从 SQLite 配置已验证的 `wenyi` R2 存储 profile，上传、查询并删除一个测试对象，然后确认密钥在渲染层 UI 或日志中均不可见。 | R2/SQLite 存储工程已完成；人工评审待进行 |  | Phase A 存储评审覆盖 `storage_configs`、加密的密钥持久化、默认已验证 `wenyi` profile 行为、R2 HeadBucket/查询/上传/删除冒烟行为，以及渲染层密钥红化。评审人必须使用本地配置，且不得将凭证写入仓库或备注。 |
| HDR-RUNTIME-001 | 运行节点定义筛选、生成/润色恢复、运行历史，以及资产 URL 刷新流程，并在适用处确认 prompt/引用快照可见。 | 节点定义、图编译器、非 MJ 生成恢复、文本润色异步恢复、运行历史，以及安全 URL 刷新工程已完成；人工评审待进行 |  | Task 42-47 覆盖带能力标记的共享节点定义、允许的输入/输出、可添加/连线创建/可运行标记、画布添加菜单筛选、连线创建筛选、针对 MJ 的 ToolRuntime 不可用运行时拒绝、带风格化 prompt 的确定性运行时快照、prompt 片段、有序引用、图片角色、模型键、运行操作、参数、非 MJ 生成任务列表、一次性重新打开对齐、终态资产/报告写回、失败任务消息写回、TextNode AI 润色 ticket 入队、`canvas.polishText` 实时内容/html/polishStatus 写回、失败润色的错误恢复、无轮询的 CanvasPage 恢复摘要、CanvasJobPanel 运行列表/详情、输出摘要、失败/取消详情状态、通过 `canvas.runNode` 的手动重跑，以及带本地 `cc-asset://` 回退、已配置云端 `query(s3Key)` 刷新/重新签名，与存储主机守卫的 workflow 资产 URL 解析。MJ 的 URL 刷新仍不在范围内。 |
| HDR-RUNTIME-002 | 检查风格/模型/功能开关加载、禁用标记，以及确定性的项目/节点风格行为。 | 风格/模型/功能工程已完成；人工评审待进行 |  | Task 50 覆盖风格禁用标记、封面/标签、项目默认值设置/清除、节点覆盖运行时优先级、已删除默认值的清理，以及禁用风格阻断运行。Task 51 覆盖渲染层安全的模型目录、text/image/video/tool 模型列表、能力标记、实时画布不可用模型校验，以及功能开关禁用节点筛选。 |
| HDR-TOOLS-001 | 对比手动 UI 操作与工具/服务支撑的效果，覆盖持久化的图、资产、workflow、片段、风格与任务操作。 | ToolRuntime 扩展与 Agent 可用词汇表工程已完成；人工评审待进行 |  | Task 52 覆盖图校验、节点复制/重命名/移动、边删除/更新、连线创建、选区提取/复制/删除、确定性的选区布局，以及一份文档化的服务支撑等价表，覆盖保存/加载/版本/导入/导出、片段、workflow 项目/模板、风格解析、任务恢复、媒体拖放/编辑，以及资产分类/引用操作。Task 53 覆盖权限描述符、结构化的 `ToolError.code/details`、`invalid_edge`、可重试的 `job_enqueue_failed`，以及为 Agent 恢复而文档化的校验/资产/风格/模型/任务错误码。Task 54 覆盖经 `shared/canvas-actions.ts` 共享的持久化图语义，服务于渲染层 store 的手动流程与画布 ToolRuntime 的创建/连接/默认数据/复制/删除行为。Task 55 在 `docs/api-contracts/tools-agents.md` 中记录了 Agent 可用词汇表，该文档由当前的 `createCanvasTools` 描述符生成，包含权限模型、不支持/仅手动操作，以及未来 plan-apply 的示例。Phase A 中 Agent 自动化仍未启用。瞬时的视口/悬停/拖拽预览状态仍仅为 UI 层面。MJ 节点/组件操作被排除在 Phase A 之外。 |
| HDR-PHASEA-001 | 在资产、workflow、画布外壳、节点、运行时、片段、风格与工具等价性之间执行最终的 Phase A 验收。 | Pending |  | 逐行核对人工 Phase A 验收矩阵。最终验收要求必需行均为 Pass，或经产品决策明确延后，且失败项需关联后续任务。本行不包括 Agent 自动化、无限画布性能工作、Seedance/真人系统，或 MJ 节点/组件实现。 |

## Agent 编排

| ID | 流程 | 结果 | 评审人 / 日期 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| HDR-050 | 让 Agent 生成一条带有指定角色和风格的简短漫剧「图生视频」链路。 | Pending |  | 在 `HDR-PHASEA-001` 仍为 Pending 期间，Task 60 处于阻塞状态；在 Phase A 通过或经明确延后之前，本评审行不得作为 Agent 自动化执行。 |
| HDR-051 | 检查 PlanCard 中迁移后的节点/操作摘要，并应用该 plan。 | Pending |  | 在 `HDR-PHASEA-001` 仍为 Pending 期间，Task 60 处于阻塞状态；在 Phase A 通过或经明确延后之前，迁移后的 PlanCard 应用/运行功能保持禁用。 |
| HDR-052 | 自动执行（AutoExecute）该 plan，并确认迁移后的运行步骤按串行顺序到达可见终态。 | Pending |  |  |
