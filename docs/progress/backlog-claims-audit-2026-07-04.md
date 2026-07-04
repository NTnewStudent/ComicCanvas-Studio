# Backlog Claims Audit — 2026-07-04

> 对应 `specs/hjwall-canvas-full-migration/tasks.md` Task #2："Audit current
> 'completed' backlog claims against current evidence"。
>
> 范围：`docs/progress/hjwall-migration-report.md` 中 REQ-077..REQ-084 的全部
> 声明，以及 `docs/progress/s3-cloud-storage-report.md` 中 REQ-085 的声明。
> 方法：逐条核对报告引用的源文件对实际代码行，并 grep/`git show` 关键 diff
> 与对应测试文件，不只依赖报告文字。本报告不删除历史记录，只新增分类结论。
>
> 分类标准：
> - **verified** — 声明与代码/测试一致，可信。
> - **partial** — 主体功能属实，但声明中至少一处与代码矛盾或超出实现范围。
> - **contradicted** — 声明的核心能力不存在或与代码明确相反。

## 结论总览

| REQ | 声明摘要 | 分类 |
| :--- | :--- | :--- |
| REQ-077 | 画布多项目 CRUD | verified |
| REQ-078 | Ctrl+S 保存/加载/恢复 | partial |
| REQ-079 | 画布内资产面板 | verified |
| REQ-080 | 左侧操作栏数据驱动 | verified |
| REQ-081 | 画布内 AI 对话 | verified |
| REQ-082 | 右键菜单（复制/删除/锁定） | partial |
| REQ-083 | @mention 自动连线 | partial |
| REQ-084 | 后端 IPC 映射补全 | verified |
| REQ-085 | S3 混合存储迁移 | partial |

5 条 verified，4 条 partial，0 条 contradicted。

## 逐条明细

### REQ-077 画布多项目 CRUD — verified

`ProjectManager.tsx:77-120` → `canvas.handler.ts:763-807` → `workflow.repo.ts`
的 insert/update/softDelete 均为真实 SQL，`shared/ipc.ts` 通道签名一致。

**质量缺口（非分类依据，记录为 follow-up）**：`ProjectManager.tsx:66-117`
全部 `catch { /* silently handle */ }` 静默吞错误，无失败态 UI 反馈；未找到
针对该 CRUD 流程的 IPC 集成测试。

### REQ-078 Ctrl+S 保存/加载/恢复 — partial

保存/加载/崩溃恢复本体成立（`workflow.repo.ts:372-380` 真实事务，
`CanvasPage.tsx:1211-1221` Ctrl+S 绑定，`:587-599` 恢复应用到 store），测试见
`tests/canvas-graph-persistence.test.ts`。

**矛盾点**：报告"已知限制"声称"30 秒自动保存"，实际
`CanvasPage.tsx:803-814` 是变更触发的 **2 秒 debounce**，全仓库无
30000/30s 常量。

### REQ-079 画布内资产面板 — verified

`CanvasAssetPanel.tsx:94-166` → `asset.handler.ts:370-379` →
`asset.repo.ts:509-515` 的搜索/分类/媒体类型/排序参数真实生效；排序为后端
`ORDER BY created_at DESC, id ASC`。报告"未新增后端资产上传"的限制描述与
代码一致（本次新增的是 workflow IPC + `asset.list` 的 `keyword` 字段）。

**质量缺口**：`asset.repo.ts.list()` 全量取出后在 JS 层过滤，未下推到 SQL
WHERE；无该面板过滤/排序组合测试。

### REQ-080 左侧操作栏数据驱动 — verified

`ADDABLE_NODE_OPTIONS`/`QUICK_TOOLS` 经 `.map()` 渲染，`handleAddNode` 真实
创建节点并写入 undo 快照。报告声明范围仅限节点新增/快捷工具簇，未超报。
测试：`tests/canvas-add-node-paths.test.ts`、`tests/canvas-shell-parity.test.ts`。

### REQ-081 画布内 AI 对话 — verified

`CanvasChatBox.tsx:89-108` 真实走 `canvas.chatSend` IPC，非假回复；
`:47-81` 订阅 `canvas.planReady` 拉取真实 plan。报告称"stub"准确指向
`orchestrator.ts` 的 `createDefaultOrchestratorPlanner()`（关键词正则选择
预置 CanvasPlan，无真实 LLM 调用），这一限制本身仍成立，报告措辞未夸大。
测试：`chat-plan-ipc.test.ts`、`chat-ui.test.tsx`、
`agent-orchestration-smoke.test.ts`。

### REQ-082 右键菜单 — partial

复制/删除真实可用：`CanvasPage.tsx:1073-1130,1804-1839`。

**矛盾点**：报告声称的"锁定"节点动作**不存在**，全仓库无 lock 功能实现，
唯一相关字符串匹配是一处无关的 CSS 分隔线。测试
`canvas-selection-actions.test.ts` 也只覆盖复制/删除，与"无锁定"一致。

### REQ-083 @mention 自动连线 — partial

连线创建/清理本体真实：`ImageConfigV2Node.tsx:260-288`、
`VideoConfigV2Node.tsx:551-579` 真实调用 `createCanvasEdge`/`setEdges`。

**矛盾点**：
1. 字段声明有误 — 报告称新增 "references" 元数据字段，`git show 6dbaf65`
   显示实际只新增了 `CanvasEdgeData.createdByMention?: boolean`（边级标志，
   `nodes.ts:289`），报告把它和一个既有、无关的 `ReferenceAsset` 接口混为一谈。
2. `test-report.md:3228` 显示次日 REQ-092（"@mention Edge Validation
   Slice"）是 RED-first 修复，说明 V2 节点上的 mention 连线在 REQ-083
   提交当天并未完全可靠，是 REQ-092 才补上边方向修复——REQ-083 报告未提及
   这一后续依赖。

### REQ-084 后端 IPC 映射补全 — verified

`git show 66741ec`：`asset.handler.ts` 新增真实文件系统代码
（`copyFileSync`/`mkdirSync`/`statSync`）取代此前 no-op；`job.handler.ts`
新增真实 `job.recover`→`requeueProcessing`；4 个 handler 均注册在
`runtime.ts:216-255`。无显式标记"REQ-084"的测试节，但相邻真实覆盖存在
（`main-runtime-wiring.test.ts`、`job-runtime.test.ts`），可追溯性弱但代码
本身核实无误。

### REQ-085 S3 混合存储迁移 — partial

S3 SDK 真实调用：`s3-provider.ts` 的 `PutObjectCommand`/`GetObjectCommand`+
`getSignedUrl`/`CopyObjectCommand`+`DeleteObjectCommand`/`HeadBucketCommand`；
Factory 真实注册 4 种 provider（S3/R2/COS/OS）；接入 `asset.import` 与生成
结果回传；凭据加密真实（`key-vault.ts` + `tests/storage-handler.test.ts`
断言明文不落库）。

**超出实现范围的声明**：
1. "生成结果自动回传云存储"仅对 `canvas.generateImage` 这一条 stub 路径
   生效，`generateVideo`/`composeVideo`/`upscaleVideo`/`muxAudioVideo` 均为
   纯占位 stub，无资产可上传。
2. "Provider 直接返回云端 URL"不准确 — 云上传是挂在 smoke 路径上的后置
   步骤，Provider 抽象本身不做上传，只消费上游 URL 作为参考图输入。
3. `upload-result.ts` 的 `uploadBytesToCloud()` 是死代码，全仓库零调用点。
4. **S3 集成本身零测试覆盖** — 无测试直接 mock `S3Client` 断言
   `PutObjectCommand` 参数，`asset.import` 云上传分支、
   `uploadGeneratedAssetToCloud` 均无专属测试，现有测试全部只 mock 手写
   `StorageProvider` 接口。

## 已知限制现状复核（对照 hjwall-migration-report.md §已知限制）

| # | 原始限制 | 现状 | 证据 |
| :--- | :--- | :--- | :--- |
| 1 | ChatBox 模拟回复 | 已修复 | 真实走 `canvas.chatSend`→`orchestrator.ts` AsyncGenerator |
| 2 | 资产面板未新增后端上传 | 部分修复 | `asset.import` 内接了真实 provider 上传，未新增独立上传通道 |
| 3 | 自动保存固定 30 秒 | 仍未解决，且描述已过时 | 实际是 2s debounce，无配置项 |
| 4 | 右键菜单未覆盖所有节点类型 | 已修复 | 菜单现从 `workflow-node-definitions.ts` 派生，覆盖 12 种节点类型 |
| 5 | @mention 连线无矩阵校验 | 已修复 | 经 `createCanvasConnectHandler`→`canConnect` 校验，无绕过通道 |
| 6 | 原生模块 ABI 不匹配 | 已修复 | `rebuild:native` 脚本接入 `dev`/`build` |

## Follow-up 任务（每条 partial 均已建立）

| REQ | Follow-up | 建议归属 |
| :--- | :--- | :--- |
| REQ-078 | 更正报告"30 秒自动保存"为"2s debounce"；补一条断言 debounce 时长的测试 | 文档修正 + `tests/canvas-store.test.ts` 或等价文件 |
| REQ-082 | 从报告中删除"锁定"节点动作描述，或补一个真实节点锁定功能 + 测试 | `hjwall-canvas-full-migration` Task #8 后续 |
| REQ-083 | 更正报告字段名描述为 `CanvasEdgeData.createdByMention`；注明 V2 节点连线正确性由 REQ-092 补全 | 文档修正 |
| REQ-085 | 补 `S3StorageProvider` 单测（mock `S3Client.send`）；补 `asset.import` 云上传分支测试；补 `uploadGeneratedAssetToCloud` 测试；删除或接上 `uploadBytesToCloud` 死代码；更正"Provider 直接返回云端 URL"措辞 | `hjwall-canvas-full-migration` Task #16/17（videoCompose/muxAudioVideo/superResolution 落地时一并接入云回传） |

## 决策

- 本审计不修改 `hjwall-migration-report.md`/`s3-cloud-storage-report.md` 原文，仅作为独立的、按日期归档的复核记录并存。
- Task #2 完成标准（"每条 partial/contradicted 均有 follow-up"）已满足。
