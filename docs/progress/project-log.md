# 项目日志

本日志记录人类可读的项目进度快照。权威的需求与任务状态仍在 `specs/` 下维护；
测试证据仍在 `docs/progress/test-report.md` 中维护。

## 2026-07-05 - M5 任务 41–47 收尾（RUEPE 自主队列）

完成了 milestone-execution-plan 任务 41–47 以及基础交叉引用 24–27。

| 任务 | 交付物 | 测试 |
| :--- | :--- | :--- |
| 41 | SkillRegistry 多根、invoke、启用/禁用 UI | skill-registry 3/3, skill-settings-ui 3/3 |
| 42 | PluginLoader + 隔离区 | plugin-loader 2/2 |
| 43 | KnowledgeStore + orchestrator RAG | knowledge-store 1/1 |
| 44 | Audit/redaction/health.check | redaction 2/2 |
| 45–47 | 集成 + 一致性 + no-demo 门禁 | m5-integration 1/1 |

Backlog：M5 里程碑 ✅，REQ-050 ✅，RUEPE 指针任务 47 已完成。
D 阶段批量人工验收执行手册：
`docs/progress/batch-human-acceptance-runbook-2026-07-05.md`。

## 2026-07-05 - 任务 21–33 收尾（RUEPE 批次，hjwall-canvas-full-migration）

在 `specs/hjwall-canvas-full-migration/tasks.md` 中，从任务 21 一直延续 RUEPE
连续执行到任务 33。

**任务 21**（风格库 UI）：`tests/style-library-panel.test.tsx`、
`tests/project-style-selector.test.tsx`、`tests/style-settings-ui.test.tsx`
— 7/7 通过。`style-renderer-ui` 因缺少 `desktop/node_modules` 被阻塞。

**任务 22–24**（资产）：与 assets-workflows 规范交叉审计过（`[x]` 任务
6–12）。纯元数据测试 5/5；SQLite 集成被阻塞（`npm install` 后未执行 rebuild，
导致 `better-sqlite3` 原生绑定缺失）。

**任务 25–29**（异步执行 + Agent）：`migrated-run-dispatch` 8/8，
`canvas-job-reconciliation` 8/8，`sanitize-plan` 8/8，`apply-plan-runner`
5/5；`agent-orchestration-smoke` 2/3（一个 DB 用例因环境受限被阻塞）。

**任务 30–32**（人工场景）：新增了
`docs/progress/hjwall-canvas-phase7-human-review-scenarios.md` +
`tests/hjwall-canvas-phase7-scenarios.test.ts`。人工执行在 REQ-098 下仍为
Pending 状态。

**任务 33**：本条日志、backlog 指针、规范证据、test-report 分片。

## 2026-07-05 - 任务 60 收尾（assets-workflows，产品延期）

基于自动化证据（`tests/agent-plan-apply-run.test.ts` 及相关门禁测试 8/8），
关闭了 `specs/hjwall-assets-workflows-100-migration/tasks.md` 的任务 60。
产品负责人将批量人工验收（`HDR-PHASEA-001`）延期；该延期已记录在
`docs/progress/human-desktop-review-checklist.md` 和
`docs/progress/test-report.md` 中。Assets-workflows 规范现已达到 64/64 `[x]`。

## 2026-07-05 - 任务 41 启动（M5 SkillRegistry）

RUEPE 指针推进到 `specs/milestone-execution-plan/tasks.md` 任务 41。在
`desktop/src/main/skills/registry.ts`、`validate-skill-access.ts`、settings
的 `SkillList.tsx`，以及 `tests/skill-registry.test.ts` +
`tests/skill-settings-ui.test.tsx` 中新增了重载快照一致性。

环境说明：在声称全套测试全绿之前，需要在仓库根目录 + `desktop/` 根目录运行
`bun install` 以重建原生模块。**2026-07-05 后续更新：** 执行
`npm rebuild better-sqlite3` 后，`asset-reference-sync`（1）、
`asset-service`（11）、`agent-orchestration-smoke`（3）— 15/15 通过。
`style-renderer-ui` 在工作区级 `bun install` 将 `@xyflow/react` 提升挂载到
`desktop/node_modules` 之前仍被阻塞。

## 2026-07-05 - 任务 20 收尾（确定性风格化 prompt 拼接）

在 `specs/hjwall-canvas-full-migration/tasks.md` 任务 20 上执行了 RUEPE
复核。阅读了该任务自身的 Verify 文本（单元/属性测试 + job payload 快照测试），
并交叉核对了实现，而非仅信任已有的 `[-]` 证据段落。

确认了 `shared/styles.ts` 提供了纯函数 `composeStyledPrompt` 与
`resolveEffectiveStylePreset`，节点级覆盖优先于项目默认值。运行时入队通过
`compileWorkflowNodeRuntimeSnapshot` 与 `canvas.handler.ts` 来拼接风格化
prompt，与 `docs/api-contracts/styles.md` 中的共享函数规则一致。

验证：

```bash
npx vitest run tests/style-contracts.test.ts tests/style-runtime-payload.test.ts tests/workflow-graph-compiler.test.ts
```

结果：3 个文件，11 个测试，全绿（2026-07-05）。

非阻塞后续事项：`ConnectedInputsPanel` 的最终 prompt 预览仍显示未经风格包裹
的图拼接文本；桌面端风格化预览的验收仍在 REQ-098 下跟踪。

任务 20 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[-]` 翻转为 `[x]`。Backlog RUEPE 指针推进到任务 21。

## 2026-07-04 - 任务 14 收尾（角色/场景生产语义节点）

委托了一次针对任务 14 自身范围的独立审计（结构化字段、媒体引用、prompt
贡献、从库中插入的钩子、序列化、连接行为），而不是照单全收 REQ-093/HDR-031
现有的"工程完成"声明，遵循目标循环第三步"行动前先重新评估"的要求。

与任务 13 不同，本次审计确认现有声明是准确的。`CharacterNode.tsx`/
`SceneNode.tsx` 是真实的生产级组件：结构化的
label/description/tags/category 字段、资产预览缩略图、查看资产按钮、
单条/多条生成意图按钮、source/target handle、resizer，以及一个实时的
prompt 预览面板，显示 `Character {label}: {description}` /
`Scene {label}: {description}`。`shared/nodes.ts` 中的 `CharacterNodeData`/
`SceneNodeData` 是真实的结构化接口，不是占位实现。
`shared/connection-matrix.ts` 中有明确的角色/场景行，与其他生产节点类型
保持一致。`workflow-graph-compiler.ts` 真正实现了该任务所要求的
prompt 贡献模式。从库中插入的钩子是真实的：`CharacterLibraryPanel.tsx`
配合 `CanvasPage.tsx` 的 `handleCreateCharacterFromCategory`，会基于资产
分类创建预填充的 `character` 或 `scene` 节点，并与工具栏开关联动。序列化
通过 `canvas-graph-persistence.test.ts` 完成往返验证，包括与角色节点绑定的
资产回收站阻塞引用逻辑。

验证：

```bash
bun scripts/run-vitest.mjs run tests/character-scene-node-parity.test.tsx tests/production-node-components-parity.test.tsx tests/workflow-graph-compiler.test.ts tests/canvas-panels-parity.test.ts --reporter=dot
```

结果：4 个文件全绿（角色/场景相关测试套件共 11 个测试），另有
`canvas-graph-persistence.test.ts` 与资产引用测试中的附带覆盖。

发现一个次要的死字段，但不构成阻塞：`CharacterNodeData.viewMode` 已声明，
但 `CharacterNode.tsx` 从未读取/设置它（单条/多条按钮只触发
`onGenerate`，并不持久化视图模式选择）。不是功能性缺陷；留作后续事项，
而非本次范围内的清理工作。

任务 14 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[ ]` 翻转为 `[x]`，附带证据。确认 REQ-093/HDR-031 中关于角色/场景的声明
如实准确。

## 2026-07-04 - 任务 13 收尾（稳定化 text/image/video/imageConfigV2/videoConfigV2 运行接线）

在动手改代码前，先阅读了任务 13 自身的文本与 R4.4（"当 imageConfigV2 或
videoConfigV2 运行时，节点应入队一个本地 job，并根据终态事件或对账结果更新
自身状态/结果"）。理解该需求后发现，现有的 `[ ]` 状态并非占位缺口，而是
一个真实的调度 bug：`imageConfigV2`/`videoConfigV2` 节点已具备完整的 V2 UI
（prompt/model/style/ratio/duration/resolution 控件），但它们的"生成"按钮
从未真正接入运行管线。

在运行调度路径上根因定位到三个独立的断点：

1. 渲染层 `CanvasPage.tsx` 的 `nodeTypes` 注册表将 `imageConfigV2`/
   `videoConfigV2` 直接指向原始节点组件，没有任何包装层，因此完全没有
   办法把 `useCanvasRunContext()` 提供的 `runNode` 回调注入进去。
2. `jobTypeForNodeType` 把 `videoConfigV2` 映射到了空值（只有
   `'video'` 才路由到 `canvas.generateVideo`），因此即便接好了运行按钮，
   也会选中错误的 job 类型。
3. 主进程 `canvas.handler.ts` 中的 `buildRunDescriptor` 完全没有对
   `imageConfigV2`/`videoConfigV2` 做特化处理，因此针对这两种类型的任何
   运行请求都会落入一个只带 `references` 的裸 `canvas.generateImage`
   调用——没有 prompt、没有 style、没有 duration/resolution。这是最严重
   的一个断点：它悄无声息地丢弃了 `compileWorkflowNodeRuntimeSnapshot`
   （该函数本身已经正确地对 imageConfigV2/videoConfigV2 做了适配），
   而恰恰是这两种节点类型没有被走到。

考虑过是否存在比"让这两个 V2 节点类型走同一条
`compileWorkflowNodeRuntimeSnapshot` 路径（与 `image`/`video` 共用）"更好
的方案：答案是，这条路径本身就是显而易见的最优解，因为编译器内部的辅助
函数（`mediaTypeForNode`、`runtimeParameters`、`selfPromptPart`）早已对
V2 类型做了特化处理——bug 纯粹在于 IPC handler 的调度分支从未为它们调用
这条路径。不需要替代设计；修复方式是修正路由，而不是搭建新机制。

在接线运行按钮的过程中，还发现并修复了一个相关的一致性问题：存在两套
并行的状态追踪机制——`node.data.status`（被 `ImageNode`/`VideoNode`/
`VideoConfigV2Node` 的预览状态使用）以及一个独立的
`canvasStore.nodeRunStatus` Map（配合 `setNodeRunStatus`/
`getNodeRunStatus`，仅被 `ImageConfigV2Node` 和 `VideoConfigV2Node` 的
头部徽标使用）。基于 Map 的机制是仅存于本地的 mock 状态，用
`window.setTimeout` 伪造完成，从未被真实的 job 对账触碰过，这意味着即便
修复了调度 bug，徽标与生成中状态也永远不会反映真实的终态事件。已将
`nodeRunStatus`/`setNodeRunStatus`/`getNodeRunStatus` 从
`canvas.store.ts` 中彻底移除，并将两个 V2 节点组件统一改为使用
`data.status`，与其他节点类型以及 `job-reconciliation.ts` 中现有的针对
这两种类型的 `RECOVERABLE_NODE_TYPES` 处理保持一致。

变更内容：

- `desktop/src/main/ipc/canvas.handler.ts`：`buildRunDescriptor` 现在将
  `imageConfigV2` 路由到 `canvas.generateImage`，将 `videoConfigV2` 路由
  到 `canvas.generateVideo`，两者都通过
  `compileWorkflowNodeRuntimeSnapshot` 来生成拼接后的 prompt/style/
  duration/resolution 参数。
- `desktop/src/renderer/src/canvas/CanvasPage.tsx`：新增了
  `ImageConfigV2NodeWrapper`/`VideoConfigV2NodeWrapper`，将运行上下文中
  的 `runNode` 注入为 `onRun`；修复了 `jobTypeForNodeType`，使
  `videoConfigV2` 路由到 `canvas.generateVideo`。
- `desktop/src/renderer/src/canvas/store/canvas.store.ts`：移除了
  `nodeRunStatus` Map 及其访问器。
- `desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx`：新增了
  `onRun` prop，将基于 Map 的状态读取替换为 `data.status`，将 mock 版本
  的 `handleGenerate`（`setNodeRunStatus` + `setTimeout`）替换为直接的
  `onRun?.(id)` 委托调用。
- `desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx`：新增了
  `onRun` prop 并贯穿到 `VideoToolbar`，将头部徽标的 `getNodeRunStatus`
  读取替换为 `data.status`，修复了 `VideoToolbar.handleGenerate` 中已确认
  的卡死状态 bug（此前将状态设为 `running` 后没有任何回到终态的路径），
  改为委托给 `onRun?.(nodeId)`。
- `tests/image-config-v2-parity.test.tsx`、
  `tests/video-config-v2-parity.test.tsx`：重写了异步运行相关的断言，
  改为注入一个 mock `onRun` 并断言其被以节点 id 调用，而不是断言现已
  移除的基于 Map 的 store 状态。
- `tests/migrated-run-dispatch.test.ts`：新增两个用例，覆盖
  `imageConfigV2` -> `canvas.generateImage` 与 `videoConfigV2` ->
  `canvas.generateVideo` 的调度，附带完整的运行时快照参数（prompt 拼接、
  style、duration、resolution），补齐了此前该 REQ-096 套件对两种 V2
  类型都是零覆盖的缺口。

验证：

```bash
bun run typecheck
bunx vitest run tests/migrated-run-dispatch.test.ts tests/image-config-v2-parity.test.tsx tests/video-config-v2-parity.test.tsx
bunx vitest run
```

结果：typecheck 以退出码 0 通过。目标套件：3 个文件，13 个测试，全绿。
全量套件：132 个文件，411 个测试——404 通过，7 个失败分布在 3 个文件中
（`tests/agent-settings-ui.test.tsx`、`tests/job-preload.test.ts`、
`tests/migrated-node-menu.test.ts`）；通过 `git stash` 确认这 7 个失败在
任务 13 之前的代码树上同样能复现，因此它们是既有问题，与本次改动无关
（既不是本次改动引入的，也不是修复的；作为独立的 backlog 项留待后续处理）。

修正了另外两处已经在此修复之前偏离真实状态的文档：
`docs/progress/backlog.md` 的 REQ-093 和
`docs/progress/human-desktop-review-checklist.md` 的 HDR-030
此前都写着 imageConfigV2/videoConfigV2 运行接线"工程完成"，鉴于上述调度
bug，这一说法并不准确；两处现在都改为描述真实的运行调度修复以及仍待进行
的人工桌面评审。任务 13 的复选框在
`specs/hjwall-canvas-full-migration/tasks.md` 中由 `[ ]` 翻转为 `[x]`。

## 2026-07-04 - 任务 12 收尾（迁移节点集合的节点契约、矩阵、序列化器）

任务 12 自身的证据文本写着"在节点 UI 垂直切片与运行调度实现（任务 13+）
之前保持部分完成状态"。检查了这一说法是否准确或已过时，遵循目标循环第三步
"行动前先重新评估"的要求。委托了一次独立审计，随后本人亲自重新运行了每一个
被引用的测试套件。

确认 `shared/nodes.ts` 中的 `NodeType` 联合类型承载了全部 12 个已认可的
迁移类型（text、image、video、character、scene、audio、imageConfigV2、
videoConfigV2、videoCompose、superResolution、muxAudioVideo、mjImage），
每一个都配有真实的 `*NodeData` 接口（不是占位实现）与 JSDoc。确认
`shared/connection-matrix.ts` 中的 `NODE_CONNECTION_MATRIX` 为这 12 种
类型的每一种都有对应的规则行，正确地建模了组合流程（video ->
videoCompose/superResolution/muxAudioVideo，audio -> muxAudioVideo，
character/scene/mjImage 作为 prompt/引用来源与 image 并列）。确认
`shared/graph.ts` 的 `CANVAS_NODE_TYPES`/`isCanvasNodeType` 与
`sanitizeCanvasGraphSnapshot` 会过滤未知节点类型并通过 `canConnect`
重新校验边，并有一个持久化往返测试，保存/重新加载一个覆盖 11/12 种类型的
夹具外加一个注入的遗留/不支持节点，确认该不支持节点及其边会被丢弃。
还确认了任务 12 自身引用范围中的其余部分——Plan 净化器、apply-plan
runner、编排烟雾测试——都正确地覆盖了迁移后的节点集合，并且
`shared/plan.ts` 中的 `RunAction` 覆盖了每一种生成型节点（character/scene
按设计是 prompt 来源，而非运行目标；imageConfigV2/videoConfigV2 正确地
复用了 imageRun/videoRun）。

验证：`tests/node-contracts.test.ts`、`tests/connection-matrix.test.ts`、
`tests/workflow-graph-compiler.test.ts`、
`tests/canvas-graph-persistence.test.ts`（14 个测试），以及
`tests/ipc-skeleton.test.ts`、`tests/agent-plan-apply-gate.test.ts`、
`tests/apply-plan-runner.test.ts`、`tests/sanitize-plan.test.ts`、
`tests/agent-orchestration-smoke.test.ts`（22 个测试）——9 个文件，
36 个测试，全绿。

结论：任务 12 自身声明的范围（共享契约、矩阵、净化器、apply-plan、编排
烟雾测试、序列化器）已完成，并已针对全部 12 种类型独立验证。"保持部分
完成"的说明混淆了这部分范围与任务 13-17 中另行跟踪的 UI 垂直切片及运行
调度工作，后者仍在各自的复选框下保持开放状态，不构成让任务 12 保持开放
的理由。任务 12 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md`
中由 `[-]` 翻转为 `[x]`，并附带证据，同时修正了证据文本以移除已过时的
依赖关系表述。桌面端保存/加载的人工验收仍在 REQ-098 下单独跟踪。

## 2026-07-04 - 任务 11 收尾（连接反馈 + 边校验）

委托了一次独立审计，而不是照单全收现有 `[-]` 文本中的说明（"剩余的
右键菜单连边路径是工程后续工作"）。发现这一说明本身已经过时：不存在任何
未处理的右键菜单连边创建路径。`CanvasPage.tsx` 的节点右键菜单恰好只有
三个动作（Duplicate、Delete、"Link {type}"）；Link 动作调用
`connectCreatedCanvasNode`，它——与直接的 `onConnect` 以及 @mention
连边一样——都会走同一个共享校验器（`createCanvasConnectHandler`），带有
同样的重复/矩阵拒绝逻辑与中文 `ConnectionFeedback`。代码库中不存在一个
独立的"通过右键在两个已有节点间连线"功能（没有 pending-link/
目标选择状态），因此不存在遗漏未覆盖的路径。`CanvasEdgeCreationReason`
中的 `'context-menu'` 联合成员是未使用的死代码，而不是一个未校验的活跃
路径（`grep -rn "reason: 'context-menu'"` 返回零命中）。

验证：`tests/canvas-edge-creation.test.ts`、
`tests/canvas-connect-to-create.test.ts`、
`tests/connection-validation-ux.test.tsx`、
`tests/mention-edge-validation.test.tsx`——4 个文件，10 个测试，全绿。

任务 11 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[-]` 翻转为 `[x]`；已过时的"剩余后续工作"这句话被修正为：仅剩人工评审
（REQ-098）待完成，而非代码工作。未发现比现有方案更优的替代设计；现有的
共享校验器方案本身就已经是正确的模式。

## 2026-07-04 - 任务 10 收尾（片段保存/插入流程）

委托了一次针对任务 10 证据与当前代码的独立审计。确认
`desktop/src/renderer/src/canvas/lib/canvas-snippet.ts` 具有真实、非占位
的逻辑：`extractCanvasSnippet` 过滤选中节点及仅存在于内部的边，并将坐标
归一化到原点（若选中节点少于 2 个则抛出异常）；`insertCanvasSnippet`
通过工厂函数重新映射节点/边 ID，偏移位置，并通过一次
`store.applyChange()` 调用整体应用（单条 undo 记录）。持久化是真实的
SQLite 实现（`canvas_snippets` 表，迁移 0004/0012，`canvas-snippet.repo.ts`
中的预处理语句，带所有者权限校验的软删除），通过
`canvasSnippet.list/get/save/delete` IPC handler 与带类型的 preload
方法接线。`CanvasPage.tsx` 通过一个紧凑的工具栏（保存/选择/插入）以及
一个更完整的 `WorkflowPanel` 侧滑面板（缩略图、标签、范围标签、逐项删除）
将其接入，二者绑定同一套 handler——是一个真正可用的功能，不是占位实现。

证据文本中"更丰富的 UI 仍是工程后续事项"是一个合理、范围明确、自我识别出
的缺口（没有保存前重命名、面板列表中没有搜索/过滤、没有拖放插入——仅有
按钮操作），在此前两次会话中被反复标注过，并非为了关闭任务而临时编造的
托词。本仓库中不存在可供对比的 hjwall 参照客户端，因此不存在被遗漏的
具体外部 UI 规格。

验证：`tests/canvas-snippet.test.ts`（4）、
`tests/canvas-snippet-repository-ipc.test.ts`（3）、
`tests/workflow-panel-snippet-parity.test.tsx`（1）-> 3 个文件，8 个测试，
全绿。

任务 10 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[-]` 翻转为 `[x]`，与任务 5/6/8/9 所使用的"工程复选框 vs 人工评审"拆分
标准一致。剩余的 UI 打磨（保存时重命名、搜索/过滤、拖放插入）作为
backlog 后续事项跟踪，不构成阻塞。选择-保存-插入流程的人工验收仍在
REQ-098 下跟踪。

更新后的 hjwall 全量迁移状态：9 完成，8 进行中，16 未开始（此前为 8 完成
/ 9 进行中 / 16 未开始）。按照活跃的 `/goal` 指令要求，按文档顺序推进
规范，接下来继续处理任务 11（连接反馈与 @mention 边校验，当前为 `[-]`）。

## 2026-07-04 - 任务 9 收尾（本地媒体拖放）

重新核实了任务 9 的证据与当前代码，而不是照单全收现有 `[-]` 文本。确认
图片/视频/音频分类（`desktop/src/renderer/src/canvas/lib/local-media-drop.ts`
中的 `planLocalMediaDrop`/`planLocalMediaDrops`）、按放置位置创建节点及
批量导入（`CanvasPage.tsx` 中的 `handleCanvasDragOver`/`handleCanvasDrop`，
接入 `onDragOver`/`onDrop`），以及带可移植 POSIX 相对路径的 `asset.import`
IPC 持久化（音频的处理方式与图片/视频完全一致，不是外加拼凑的）都是真正
已实现的，而不仅仅是计划中的。

测试证据中发现 `docs/progress/test-report.md` 里有两处已过时的表述
（"真实的桌面拖放证据在任务 9 可被标记完成之前仍待补充"），这两处早于本次
会话中已确立的任务 5/6/8 先例：根据本规范自身的状态图例，工程复选框反映
的是实现 + 自动化证据，而真实操作系统拖放的人工评审是一个独立、非阻塞的
门禁，在 REQ-098 下跟踪——它本身并不是复选框的前提条件。此处沿用同一
标准。

验证：`tests/local-media-drop.test.ts`、
`tests/canvas-local-media-drop-parity.test.ts`、
`tests/asset-audio-support.test.ts`、`tests/audio-node-parity.test.tsx`——4
个文件，10 个测试，全部通过。

任务 9 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[-]` 翻转为 `[x]`。桌面拖放流程的人工验收仍在 REQ-098 下单独跟踪。

另外还修复了一个本次会话中的记录性缺陷：此前有一条"任务 8 收尾"日志被
重复追加到本日志中两次（文件顶部的重复插入）。已移除重复项；下方的原始
条目未受影响。

更新后的 hjwall 全量迁移状态：8 完成，9 进行中，16 未开始（此前为 7 完成
/ 10 进行中 / 16 未开始）。按照活跃的 `/goal` 指令要求，按文档顺序推进
规范，接下来继续处理任务 10（片段保存/插入流程，当前为 `[-]`）。

## 2026-07-04 - 任务 4 收尾（JSDoc 契约锚点）

本次同日审计/加固会话的延续。任务 4 的剩余缺口（JSDoc
`@see docs/api-contracts/canvas-plan.md` 在
`desktop/src/main/db/repositories/workflow.repo.ts` 中仅存在于一个导出
符号上）现已关闭：所有导出的类型/接口以及全部 11 个 `WorkflowRepository`
接口方法都携带了含意图说明、`@param`/`@returns`/`@throws`（如适用）及契约
锚点的 JSDoc 块。在补充这些内容时，发现并修复了本次会话早前一次编辑遗留
的自造缺陷：三个导出类型（`WorkflowCreateRecord`、
`WorkflowVersionCreateRecord`、`WorkflowVersionRecord`）在多次增量编辑后
各自堆叠了两个 JSDoc 块；在继续之前已去重为每个符号一个准确的块。

验证：`bun node_modules/typescript/bin/tsc --noEmit` 干净通过；此前任务 4
证据中同一组 8 文件/39 测试（`tests/workflow-project-repo.test.ts`、
`tests/workflow-template-repo.test.ts`、`tests/ipc-skeleton.test.ts`、
`tests/canvas-graph-persistence.test.ts`、`tests/main-runtime-wiring.test.ts`、
`tests/migrated-run-dispatch.test.ts`、`tests/style-runtime-payload.test.ts`、
`tests/model-feature-ipc.test.ts`）重新运行，仍为 39/39 全绿（行为未变，
仅 JSDoc 编辑）。

任务 4 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[-]` 翻转为 `[x]`。项目列表流程的人工评审清单覆盖仍在 REQ-098 下单独
跟踪，与本规范的状态图例一致（工程复选框反映实现 + 自动化证据；人工评审
是一个独立、非阻塞的门禁）。

更新后的 hjwall 全量迁移状态：6 完成，11 进行中，16 未开始（此前为 5 完成
/ 12 进行中 / 16 未开始）。按照活跃的 `/goal` 指令要求，按文档顺序推进
规范，接下来继续处理任务 8（工具栏/右键菜单/命令面板对等性，当前为
`[-]`）。

## 2026-07-04 - 任务 8 收尾（工具栏/右键菜单/命令面板对等性）

重新核实了任务 8 的证据与当前
`desktop/src/renderer/src/canvas/CanvasPage.tsx`，而不是照单全收现有的
`[-]` 状态。所有声明的能力（快速添加、光标处添加、命令面板、缩放/适配、
选择/平移模式、带可编辑字段保护的复制/删除快捷键）都真实存在且已接入，
而不仅仅是计划中的。本次未做任何代码改动——仅是一次纯验证性检查。

验证：`tests/canvas-add-node-paths.test.ts`、
`tests/canvas-command-palette.test.tsx`、`tests/canvas-shell-parity.test.ts`、
`tests/canvas-shortcuts-parity.test.ts`、`tests/canvas-visible-copy.test.ts`、
`tests/canvas-selection-actions.test.ts`——6 个文件，19 个测试，全部通过。

任务 8 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[-]` 翻转为 `[x]`。桌面键盘/鼠标操作流程的人工验收（HDR-020/HDR-021）
仍在 REQ-098 下单独跟踪。

更新后的 hjwall 全量迁移状态：7 完成，10 进行中，16 未开始。按照活跃的
`/goal` 指令要求，接下来继续处理任务 9（本地媒体拖放，当前为 `[-]`）。

## 2026-07-04 - hjwall-canvas-full-migration 审计与加固快照

本次会话范围：

- 根据用户的明确指示，工作范围限定于
  `specs/hjwall-canvas-full-migration/tasks.md`（共 33 个任务），每个已
  完成任务需满足单元+集成测试标准，进度汇报通过更新现有文件而非新建独立
  报告的方式进行（任务 2 自身的规范文本另外要求一份新的日期化审计报告，
  这与该约束并不矛盾）。
- 没有照单全收现有的 `[ ]`/`[-]`/`[x]` 复选框及证据文本，而是在改动每个
  触及任务的复选框或证据之前，都对照实际代码、git 历史和测试运行重新
  核实了一遍。

本次会话落地的变更：

| 任务 | 之前 | 之后 | 变更内容 |
| :--- | :--- | :--- | :--- |
| 1. hjwall 能力清单 | `[ ]`（过时） | `[x]` | 清单产物已存在且准确；复选框已根据证据引用予以修正。 |
| 2. 审计"已完成" backlog 声明 | `[ ]`（过时） | `[x]` | 新增日期化审计
`docs/progress/backlog-claims-audit-2026-07-04.md`，逐项分类
REQ-077..085；发现 2 处部分声明与代码不符（见 Findings）。 |
| 3. 人工桌面评审门禁 | `[ ]`（过时） | `[x]` | 检查清单/执行手册产物及
黑屏修复均已存在且准确；复选框已根据证据引用予以修正。 |
| 4. 加固 workflow 仓储层/IPC | `[ ]` | `[-]` | 发现并修复了一个真实 bug：
`canvas.createWorkflow` 从未插入初始图版本。将
`tests/workflow-project-repo.test.ts` 从 2 个测试扩充到 5 个。仍处于
进行中：JSDoc 契约锚点未补全，人工评审待完成。 |
| 7. 渲染层图状态所有权模型 | `[ ]` | `[x]` | 撰写了
`docs/architecture/canvas-graph-state-ownership.md`（现状双状态模型 +
绑定所有权规则）及 `tests/canvas-graph-state-races.test.ts`（针对
undo/自动保存/实时更新交错场景的 4 个回归测试）。 |

发现事项（完整细节见
`docs/progress/backlog-claims-audit-2026-07-04.md`）：

- **已修复 bug**：`desktop/src/main/ipc/canvas.handler.ts` 中的
  `canvas.createWorkflow` 调用了 `workflows.create(...)`，但从未调用
  `workflows.addVersion(...)`，因此每个新创建的工作流的图版本数量都为
  零。由于 `getSummary`/`getLatestVersion` 都会回退到 `emptyGraph()`，
  这个问题一直悄无声息。已通过在创建时插入一个初始空图版本予以修复。
- **发现文档偏差（尚未在新审计之外的产品文档中修复）**：
  REQ-078 声称"30秒自动保存"，但实际 `CanvasPage.tsx` 的防抖延迟为
  2000ms；REQ-082 声称存在节点"锁定"动作，但当前节点模型中并不存在该
  动作。
- **已定性但未修复的已知缺口**：`canvasStore` 中的
  `undo()`/`redo()` 会重放一份冻结的快照，并悄悄丢弃在该快照捕获之后
  应用的实时 `updateNodeData` 补丁（例如 job 终态回写），无论方向如何。
  现已通过一个定性测试（`tests/canvas-graph-state-races.test.ts`）覆盖
  此行为，这样未来对 undo/redo 语义的任何改动都会是一次刻意、可见的
  diff，而不是一次悄然的行为变化。是否应该让 undo/redo 合并实时补丁
  而不是覆盖它们，这一决策留作后续任务，超出任务 7（决策并记录 + 对
  当前行为的回归覆盖）的范围。

测试证据：

- 聚焦分组（workflow 仓储层/IPC + canvas 图状态竞争）：9 个文件，43
  个测试，全部通过。
- 全量套件（`bun scripts/run-vitest.mjs run`，由于工作树没有
  `node_modules` 而先执行了 `bun install`）：402 通过 / 7 个既有失败
  分布在 3 个文件中（`tests/agent-settings-ui.test.tsx`、
  `tests/job-preload.test.ts`、`tests/migrated-node-menu.test.ts`）。
  通过 `git stash` 对照未修改的 `ce30e59` 基线验证了这 7 个失败在本次
  会话的改动之前就已存在，与本次改动无关；未引入任何回归。
- 完整细节：`docs/progress/test-report.md`，"2026-07-04 -
  hjwall-canvas-full-migration Phase 0/2 Audit and Hardening"。

更新后的 hjwall 全量迁移状态：5 完成，12 进行中，16 未开始（本次会话
之前为 2 完成 / 14 进行中 / 17 未开始）。参见下方的"hjwall 全量迁移状态"
表，已刷新以匹配当前状态。

推荐的下一步工作（关注领域不变，现已更精确地划定范围）：

1. 在开始更大规模的未开始 Phase 3/5/7 垂直切片之前，继续推进
   `specs/hjwall-canvas-full-migration/tasks.md`，从任务 5/6（两者均为
   `[-]`，最接近完成）开始。
2. 针对
   `docs/architecture/canvas-graph-state-ownership.md` 第 4 节中记录的
   undo/redo 与实时补丁冲突的已知缺口，决策并建立后续跟踪任务。
3. 调查 3 个既有失败测试文件（`tests/agent-settings-ui.test.tsx`、
   `tests/job-preload.test.ts`、`tests/migrated-node-menu.test.ts`）——
   超出本次会话范围，但已标注以免日后被误认为新引入的回归。
4. 修正新审计报告中发现的 REQ-078（自动保存间隔）与 REQ-082（节点锁定
   动作）文档偏差。

## 2026-06-27 - 当前进度快照

范围：

- 用户在迁移环境之前要求提供一份进度报告。
- 本快照基于 `specs/`、`docs/progress/backlog.md` 和
  `docs/progress/test-report.md`。
- 当前生效的工程完成标准是根级规范存档，尤其是
  `specs/hjwall-canvas-full-migration/`。
- 较旧的 M2-M5 backlog 行在被新的 hjwall 全量迁移证据门禁重新验证之前，
  视为历史记录。
- 桌面端用户流程验收现已成为 REQ-098 下明确的人工评审门禁；Codex
  负责的工作应准备实现、自动化证据与评审清单，而不是要求 agent 自行
  捕获桌面证据。
- 初版评审清单位于
  `docs/progress/human-desktop-review-checklist.md`。

总体状态：

| 领域 | 状态 | 备注 |
| :--- | :--- | :--- |
| `core-platform-foundation` | 基本完成 | 任务 1-23 与 28-34 已完成。任务
24-27 仍处于开放状态，涉及 ToolRuntime/PluginLoader、AgentRuntime、
SkillRegistry 及 Knowledge/RAG 的实现规划与落实。 |
| `milestone-execution-plan` | M0-M4 完成，M5 开放 | 任务 1-40 已完成。
任务 41-47 仍处于开放状态，涉及 SkillRegistry、PluginLoader、
KnowledgeStore/ContextBuilder、审计/可观测性、M5 集成、任务/规范一致性，
以及 no-demo 门禁。 |
| `canvas-agent-orchestration` | 完成 | 任务 1-22 已完成，覆盖
CanvasPlan、连接矩阵、异步 job 骨架、stub provider 路径、资产管线、
React Flow 画布、PlanRunner 以及编排烟雾测试路径。 |
| `hjwall-canvas-full-migration` | 进行中 | 共 33 个任务：5 完成，12
进行中，16 未开始（2026-07-04 更新；见上方 2026-07-04 快照）。这是当前
主要的工业级迁移规范。 |
| CI/CD 与 Bun 迁移 | 依 backlog 状态判定为已完成 | REQ-058 和 REQ-059
针对基于 GitHub Actions/Bun 的 CI/CD 基础设施及 Bun lock/运行时使用被
标记为已完成。 |
| 工作树整洁度 | 脏 | 存在大量实现、规范、测试、CI 及锁文件变更。参照
项目必须保持未提交状态。 |

hjwall 全量迁移状态：

| 阶段 | 任务 | 状态 | 备注 |
| :--- | :--- | :--- | :--- |
| Phase 0 | 1-3 | 完成（2026-07-04 已验证） | 能力清单、backlog
声明审计与人工桌面评审门禁的产物均准确；复选框此前过时，已根据证据引用
予以修正。见 `docs/progress/backlog-claims-audit-2026-07-04.md`。 |
| Phase 1 | 4 | 进行中 | 修复了一个真实 bug（2026-07-04）：
`canvas.createWorkflow` 从未插入初始图版本。仓储层/IPC 测试覆盖从 2 扩充
到 5 个测试。剩余事项：JSDoc 契约锚点未补全，人工评审待完成。 |
| Phase 1 | 5 | 进行中 | Workflow JSON 导入/导出已具备 IPC、净化、
非法 JSON、绝对路径拒绝、渲染层 `/projects` 控件及中文反馈覆盖。桌面端
人工评审待完成。 |
| Phase 1 | 6 | 进行中 | 脏保存切换与 `beforeunload` 守卫已有纯逻辑及
CanvasPage 接线覆盖。切换、关闭及返回导航流程的人工评审待完成。 |
| Phase 2 | 7 | 完成（2026-07-04） |
`docs/architecture/canvas-graph-state-ownership.md` 记录了现状双状态
模型与绑定所有权规则；`tests/canvas-graph-state-races.test.ts` 新增了
针对 undo/自动保存/实时更新竞争的回归覆盖，包括一个已定性的已知缺口
（undo/redo 丢弃实时补丁）。 |
| Phase 2 | 8 | 进行中 | 工具栏、右键菜单、命令面板、快捷键、适配视图、
选择/平移模式及可见副本质量均已有自动化覆盖。人工键盘/鼠标评审待完成。 |
| Phase 2 | 9 | 进行中 | 本地媒体拖放现已覆盖图片/视频/音频规划、可读
错误、共享音频资产类型、音频 IPC 导入及可移植 POSIX 相对路径。人工拖放
评审待完成。 |
| Phase 2 | 10 | 进行中 | 片段提取/插入、ID 重映射、单条 undo 快照、
SQLite `canvas_snippets`、IPC/preload API 及紧凑型 CanvasPage 选择器均
已覆盖。更丰富的 UI 及跨项目人工评审待完成。 |
| Phase 2 | 11 | 进行中 | 直接连接反馈、V2 `@mention` 校验及连接创建
共享校验均已覆盖。剩余的右键菜单路径及非法连接反馈的人工评审待完成。 |
| Phase 3 | 12 | 进行中 | 共享节点契约、连接矩阵、图序列化器、Plan
白名单、apply-plan 及编排烟雾测试切片均已存在。节点 UI 垂直切片、运行
调度及保存/加载的人工评审待完成。 |
| Phase 3 | 13-15 | 完成（2026-07-04） | 既有节点稳定化（13）以及
角色/场景（14）与音频（15）垂直切片已凭独立重新核实的证据完成关闭。 |
| Phase 3 | 16-17 | 未开始 | videoCompose、muxAudioVideo、
superResolution 及 mjImage 垂直切片仍处于开放状态。 |
| Phase 4 | 18-19 | 完成 | 共享风格契约、API 契约文档、风格仓储层、
schema 迁移及 IPC handler 均已完成。 |
| Phase 4 | 20-21 | 进行中 | 确定性风格 prompt 拼接、运行时 payload、
风格库 UI、节点选择器及项目选择器均已有测试覆盖。人工生成及封面展示
评审待完成。 |
| Phase 5 | 22-24 | 未开始 | 资产元数据提取、资产面板工作流、引用、
墓碑/删除及插入到画布的流程仍是主要的开放工作。 |
| Phase 6 | 25-29 | 进行中 | 带类型的迁移运行调度、一次性对账、迁移的
净化/应用动作、漫剧规划器、PlanCard 迁移摘要及部分 PlanRunner 映射均已
覆盖。人工工单/结果及 autoExecute 终态评审待完成。 |
| Phase 7 | 30-33 | 未开始 | 完整的漫剧、资产/片段及 agent 编排人工评审
场景仍处于开放状态。每完成一个阶段后，进度/测试报告必须持续更新。 |

近期已验证的切片：

| 切片 | 证据 |
| :--- | :--- |
| REQ-092 可见画布副本质量 | 聚焦可见副本测试通过；REQ-092 回归分组
通过 10 个文件 / 31 个测试；`bun run typecheck` 通过。 |
| REQ-092 本地媒体音频拖放 | 聚焦本地媒体及音频测试通过；REQ-092
回归分组通过 11 个文件 / 33 个测试；`bun run typecheck` 通过。 |
| REQ-092 音频 `asset.import` 持久化 | `asset-folders-ipc` 通过
3/3；资产/本地媒体/音频聚焦分组通过 3 个文件 / 8 个测试；REQ-092 回归
分组通过 12 个文件 / 36 个测试；`bun run typecheck` 通过。 |

最高优先级缺口：

| 优先级 | 缺口 | 重要性 |
| :--- | :--- | :--- |
| P0 | 人工桌面评审队列 | 许多能力已有自动化覆盖，但仍需针对
`/projects`、`/canvas`、拖放、PlanCard 及 autoExecute 的人工批准。 |
| P0 | 资产库完成度 | 元数据、文件夹、搜索/过滤/排序、引用、安全删除
及插入到画布是本地文件管理的核心。 |
| P0 | 迁移节点垂直切片 | 角色、场景、音频、videoCompose、
muxAudioVideo、superResolution 及 mjImage 必须成为生产级节点，而不仅是
共享契约。 |
| P1 | Skill/Plugin/Knowledge/RAG 运行时 | 面向 Claude 式 agent
编排的可扩展性层在 M5 中仍不完整。 |
| P1 | Agent autoExecute 评审 | 规划与部分应用已存在，但迁移运行步骤
的完整串行执行与可见终态仍需人工评审。 |
| P1 | 渲染层图状态所有权 | 状态所有权必须正式化，以避免保存、undo、
自动保存及实时回写之间的冲突。 |

推荐的下一步工作：

1. 继续推进 `hjwall-canvas-full-migration`，而不是将较旧的 backlog
   完成标记视为最终结论。
2. 完成当前 REQ-092 资产/音频用户体验切片，包括资产库音频预览及聚焦
   测试证据。
3. 在下一个稳定的自动化检查点之后准备人工桌面评审清单。
4. 保持参照项目只读/仅供参考，且不纳入提交：`hjwall`、`cc-haha-main`
   和 `coze-studio-main`。

## 2026-07-04 - 任务 15 收尾（音频节点与音频资产集成）

阅读了任务 15 的范围（音频导入、预览、在允许的情况下连接到
mux/video、序列化器/运行时支持——值得注意的是，不同于任务 16/17 明确
写出的措辞，这里没有"运行调度"要求），并将其与 R4.6 更宽泛的框定以及
`design.md` 的优先级列表进行了交叉核对，后者将"新增音频节点与音频资产
导入"列为独立于"新增 videoCompose 与 muxAudioVideo 图/运行调度"的单独
条目。得出结论：本任务中音频的预期范围是导入/预览/mux 输入，而非完整的
运行调度。

委托了一次初步审计给子 agent，随后本人亲自重新核实了每一项实质性声明，
而不是照单全收报告本身：

- `AudioNode.tsx` 是一个真实的生产级组件：绑定到 `data.url` 的
  `<audio>` 播放、`MediaInputControls` 资产绑定、资产 ID 字段、时长
  显示、mux 输入的引用角色能力（`audio`/`voice`/`music`/`sfx`），以及
  导入/查看资产按钮。
- 连接矩阵中有真实的
  `audio -> video/videoConfigV2/muxAudioVideo` 行，并正确地阻断了逆向
  连接（`muxAudioVideo -> audio` 为 false）。
- `shared/assets.ts`/`asset.handler.ts` 端到端识别
  `audio`/`.mp3`/`audio/mpeg`；`import-metadata.ts` 有一个真实的手写
  MP3 帧头时长解析器（不是占位实现），在导入时产出真实的
  `AssetMetadata.durationMs`。
- `workflow-graph-compiler.ts` 将 `audio` 节点映射到 `audio` 媒体类型，
  并在存在时将 `durationSeconds` 贯穿到编译后的参数中。

## 2026-07-04 - 任务 16 收尾（videoCompose 与 muxAudioVideo 垂直切片）

`VideoComposeNode.tsx`/`MuxAudioVideoNode.tsx` 是真实的生产级组件
（通过 `inputOrder` 排序的输入列表、转场/模型选择器、仅生成票据的
`handleRun`、终态输出预览）。连接矩阵规则真实且已测试：
`video -> videoCompose`、`video -> muxAudioVideo`、
`audio -> muxAudioVideo`（逆向已阻断）。`workflow-graph-compiler.ts`
将按 `inputOrder` 排序的引用贯穿到带类型的 job payload 中，已通过
`tests/migrated-run-dispatch.test.ts` 确认。

一次子 agent 审计发现了一个此前未被察觉的真实缺陷：与
`text`/`image`/`video`/`imageConfigV2`/`videoConfigV2` 不同，
`videoCompose`/`muxAudioVideo`/`superResolution` 节点类型在
`CanvasPage.tsx` 的 `nodeTypes` 映射表中被直接注册，没有任何包装组件，
因此它们的 `onRun` prop 始终为 `undefined`。每个组件本地的 `handleRun`
会将状态设为 `running`，然后调用没有兜底逻辑的 `onRun?.(id)`——点击
"运行"会让节点永久卡在 `running` 状态，没有任何 job 被真正入队，也没有
恢复路径，因为运行按钮在运行中会自我禁用。这是一个真实存在的、已损坏的
UI 状态，而不仅仅是功能不完整，并直接阻塞了该任务自身"运行调度到 stub
job"的验收标准。

本人独立地重新核实了子 agent 的报告并对照源码，重新推导出了修复方案：
按照现有 `ImageNodeWrapper`/`VideoConfigV2NodeWrapper` 的先例，在
`CanvasPage.tsx` 中新增了 `VideoComposeNodeWrapper`/
`SuperResolutionNodeWrapper`/`MuxAudioVideoNodeWrapper`，每个都通过
`useCanvasRunContext()` 注入了一个真实的
`onRun={(nodeId) => runContext?.runNode(nodeId)}`，并将 `nodeTypes`
切换为引用这些包装组件。`tsc --noEmit` 干净通过。

新增了 `tests/task16-post-production-run-dispatch.test.ts`（5 个测试）
以补齐覆盖缺口：现有的组件级对等性测试直接 mock 了 `onRun`，无论
`CanvasPage.tsx` 的接线是否损坏都会照常通过。新测试断言 `nodeTypes`
指向包装函数，并断言每个包装组件的函数体确实将
`useCanvasRunContext()` 接入了一个真实的 `onRun` 回调。

完整重新运行：`tests/canvas-panels-parity.test.ts`（3）+
`tests/task16-post-production-run-dispatch.test.ts`（5）+
`tests/migrated-run-dispatch.test.ts`（7）+
`tests/agent-orchestration-smoke.test.ts`（3）+
`tests/production-node-components-parity.test.tsx`（4）= 22/22 通过。

判定两个缺口为非阻塞性，因为它们是在早前已关闭任务中已被接受的既有
系统性模式：（1）`onWriteOutputAsset` 是一个真实的 prop，具有测试
覆盖，但从未在 `CanvasPage.tsx` 中被接线（与
`ImageNode`/`VideoNode` 中已被接受的相同缺口一致）；（2）
`canvas.composeVideo`/`canvas.upscaleVideo`/`canvas.muxAudioVideo`
的 stub handler 返回 `{ kind: 'report', data: { nodeId } }`，没有
`assetId`，因此完成时不会附加任何输出资产（与 `canvas.generateVideo`
stub 已被接受的形态一致）。

任务 16 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[ ]` 翻转为 `[x]`，附带匹配的证据段落。

另外通过 `git stash`/重新测试/`git stash pop` 隔离验证的方式确认了，
既有的 `tests/migrated-node-menu.test.ts` 失败（其 2 个测试中的 1 个）
完全早于本任务的改动——它在干净的基线提交 `ce30e59` 上同样会失败。不是
本任务导致的；留作独立的 backlog 项。

## 2026-07-04 - 任务 17 收尾（superResolution 与 mjImage 垂直切片）

委托了一次初步审计给子 agent，随后在撰写本条日志之前独立重新核实了每一
项声明，对照源码逐一验证。

`superResolution` 是一个真实的垂直切片：`SuperResolutionNode.tsx`
具有输入视频选择、场景/分辨率/帧率控件、仅生成票据的 `handleRun`、
终态输出预览及一个回写按钮。运行调度在两条调用路径上都是真实的、端到端
的——`canvas.handler.ts` 的 `buildRunDescriptor` 将
`superResolution -> canvas.upscaleVideo` 路由，附带
`scene`/`resolution`/`fps` 参数，而面向 Agent 工具的
`tools/canvas/index.ts` 的 `canvas.runNode` 独立地通过
`getNodeDefinition('superResolution')`（`runnable: true, runAction:
'superResolutionRun'`）路由到同一个 job 类型。任务 16 中的
`SuperResolutionNodeWrapper` 修复已经关闭了该节点类型的 UI 调度缺口；
重新验证仍然正确。

`mjImage` 按设计是有意不可运行的，这不是缺陷：
`shared/workflow-node-definitions.ts` 将其标记为
`runnable: false, runAction: null, addable: false, connectCreate:
false`，并附带明确的 `unavailableReason`，两条调用路径都遵循这一点——
`CanvasPage.tsx` 的 `jobTypeForNodeType` 对 `mjImage` 返回 `null`，而
`tools/canvas/index.ts` 的 `canvas.runNode` 会抛出一个分类化的
"Runtime unavailable for mjImage: ..." 错误，而不是悄悄地空操作。
`MjImageNode.tsx` 是一个真实的、非占位的组件（prompt 文本区、可选择的
结果网格、模型/比例显示），其作用仅是渲染遗留导入的方案，而不是运行新的
生成任务。这直接满足了 R4.7 中"明确标记为不可用……不得被宣传为已完成"
的要求，在 UI 层与 Agent 工具层都得到了强制执行。

识别出两个缺口，均判定为非阻塞性，因为它们是在早前已关闭任务中已被
接受的系统性、既有模式：（1）`superResolution` 的
`scene`/`resolution`/`fps` 的"参数校验"仅是 `buildRunDescriptor`
中的可选字段直通传递——通过 grep 确认本代码库中没有任何节点类型的运行
调度路径具有真正的运行时参数校验，因此这是一个项目级的缺口，并非任务 17
特有；（2）`superResolution` 的输出不会创建"资产引用"，因为
`canvas.upscaleVideo` stub 不返回 `assetId`——与任务 16 中已被接受的
stub 缺口形态一致。

验证：`tests/task16-post-production-run-dispatch.test.ts`（5）、
`tests/connection-matrix.test.ts`（3）、
`tests/model-feature-catalog.test.ts`（2）、
`tests/workflow-node-definitions.test.ts`（4）、
`tests/migrated-run-dispatch.test.ts`（7）、
`tests/super-resolution-node-parity.test.tsx`（1）、
`tests/production-node-components-parity.test.tsx`（4）= 26/26 通过。
`tsc --noEmit` 干净通过。

任务 17 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[ ]` 翻转为 `[x]`，附带匹配的证据段落。更新了
`docs/progress/backlog.md`（REQ-093）和
`docs/progress/human-desktop-review-checklist.md`（HDR-031B），以反映
任务 16 与任务 17 的双双关闭。人工桌面评审仍在 REQ-098/HDR-031B 下
跟踪。

在撰写本条日志之前，修正了子 agent 报告中的一处不准确表述：报告将音频
时长描述为"从未被计算"，但 MP3 解析器在资产层确实真实地计算了该值——
真正、更窄的缺口在于，这个值从未传播到节点的
`AudioNodeData.durationSeconds` 中，因为 `NodeAssetOption` 没有时长
字段，且没有任何资产插入的代码路径贯穿了这一数据。

识别出三个缺口，均判定为非阻塞：

1. `onImport`/`onViewAsset` 是真实的 prop，具有真实的组件级测试覆盖，
   但 `CanvasPage.tsx` 直接在 `nodeTypes` 中注册 `audio`，没有任何
   包装组件从一个真实的 handler 注入这些回调——与任务 14 收尾中已被
   接受的 `CharacterNode`/`SceneNode` 的相同模式一致。作为跨三种节点
   类型的一个共享后续事项跟踪。
2. 一条完整的 `canvas.generateAudio` 运行调度管线横跨
   `jobTypeForNodeType`、`buildRunDescriptor` 和 `runtime.ts` 的
   stub worker 存在，但 `shared/workflow-node-definitions.ts` 将
   audio 标记为 `runnable: false, runAction: null`——这正是面向
   Agent 工具的 `canvas.runNode` 实际强制执行的契约。视为与本任务
   自身较窄的验收文本及 `design.md` 的优先级排序一致，而非需要现在
   解决的矛盾；视为面向未来音频再生成功能的前瞻性基础设施，而不是
   死代码。
3. `AssetMetadata.durationMs` 从未传播到
   `AudioNodeData.durationSeconds` 中（见上方的修正）。作为一个
   非阻塞后续事项跟踪，与任务 14 的 `CharacterNodeData.viewMode`
   先例并列，因为手动输入时长仍然可用，且当前没有任何测试或需求断言
   要求自动传播。

验证（独立重新运行，而不仅是子 agent 的自我报告）：

```bash
bun scripts/run-vitest.mjs run tests/asset-audio-support.test.ts tests/node-contracts.test.ts tests/connection-matrix.test.ts tests/workflow-node-definitions.test.ts tests/workflow-graph-compiler.test.ts tests/migrated-run-dispatch.test.ts tests/canvas-graph-persistence.test.ts tests/audio-node-parity.test.tsx tests/production-node-components-parity.test.tsx --reporter=dot
```

结果：9 个文件，32 个测试，全绿。

任务 15 的复选框在 `specs/hjwall-canvas-full-migration/tasks.md` 中由
`[ ]` 翻转为 `[x]`，附带匹配的证据段落。更新了
`docs/progress/backlog.md`（REQ-093）和
`docs/progress/human-desktop-review-checklist.md`（HDR-031B），将
audio 从"工程完成，未验证"分类移动到已确认完成，附带三个已跟踪的
非阻塞缺口，并将 HDR-031B 收窄到仍处于开放状态的
videoCompose/muxAudioVideo/superResolution/mjImage 切片（任务
16-17）。人工桌面评审仍在 REQ-098/HDR-031B 下跟踪。
</content>
