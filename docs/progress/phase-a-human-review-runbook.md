# Phase A 人工复核操作手册

创建日期：2026-06-27

标准清单：`docs/progress/human-desktop-review-checklist.md`

会话模板：`docs/progress/phase-a-human-review-session-template.md`

本操作手册将 Phase A 桌面端验收转化为一套可重复的人工复核流程。它取代了自动化的真实桌面证据。自动化测试可以证明工程行为，但 `HDR-PHASEA-001` 只能由人工复核者通过，或由清单与测试报告中记录的产品方明确延后决定来接受。

## 范围

复核以下 Phase A 区域：

- 资产与自定义图片分类：`HDR-042`、`HDR-043`、`HDR-ASSET-001` 到 `HDR-ASSET-009`。
- Workflow 与片段：`HDR-WF-001` 到 `HDR-WF-006`、`HDR-024`。
- 画布与节点 UI：`HDR-CANVAS-001` 到 `HDR-CANVAS-005`、`HDR-NODE-001`、`HDR-NODE-002`。
- 运行时与工具：`HDR-RUNTIME-001`、`HDR-RUNTIME-002`、`HDR-TOOLS-001`。
- 最终决策：`HDR-PHASEA-001`。

不要把 Agent 自动化作为 Phase A 验收证据来复核。`HDR-050` 与 `HDR-051` 在 Task 60 被允许启动之前保持 Pending。

MJ 节点/组件实现不在范围内。旧版 MJ 图仅可打开以验证其“不可用”状态呈现是否清晰易读；不需要 MJ 对等、多结果选择、URL 刷新、运行恢复或 provider 集成。

Seedance/真人相关流程与 LTM 不在范围内。

## 准备工作

1. 确认正在复核的应用构建版本或 commit。
2. 确认本地存储使用 SQLite，且资产文件保持在 app data 目录下或经配置的安全资产协议中。
3. 进行 R2 复核时，使用本地 SQLite 配置中已验证过的 `wenyi` profile。不要将密钥粘贴进笔记、截图、日志、commit 或本仓库中。
4. 打开 `docs/progress/human-desktop-review-checklist.md`，为每个已复核的流程更新对应行的复核者/日期/结果/备注。
5. 将 `docs/progress/phase-a-human-review-session-template.md` 复制到复核笔记区域，或直接用作会话记录。
6. 单独运行自动化证据套件；失败项不会因为人工 Pass 而被豁免。

## 复核顺序

1. 打开应用，完成启动/导航相关行 `HDR-001` 到 `HDR-003`，建立基本信心。
2. 复核 workflow 项目生命周期相关行 `HDR-010` 到 `HDR-015`，然后是 `HDR-WF-001` 到 `HDR-WF-006`。
3. 复核资产相关行 `HDR-042`、`HDR-043`，以及 `HDR-ASSET-001` 到 `HDR-ASSET-009`。
4. 复核画布相关行 `HDR-020` 到 `HDR-024`，以及 `HDR-CANVAS-001` 到 `HDR-CANVAS-005`。
5. 复核非 MJ 节点相关行 `HDR-030` 到 `HDR-033`、`HDR-NODE-001` 与 `HDR-NODE-002`。
6. 复核运行时/工具相关行 `HDR-RUNTIME-001`、`HDR-RUNTIME-002` 与 `HDR-TOOLS-001`。
7. 只有在所有必需的 Phase A 行都为 Pass，或已被产品方明确决定延后之后，才更新 `HDR-PHASEA-001`。

## 结果规则

- 只有当复核者完整走完流程且没有遇到阻塞性问题时，才使用 `Pass`。
- 发现阻塞性问题时使用 `Fail`，并关联一个后续任务。
- 只有当该流程不适用于当前切片时才使用 `N/A`。
- 尚未复核的行使用 `Pending`。
- 只有当产品负责人主动选择延后某一行时才使用明确的产品延后决定；在备注中记录原因、负责人与后续跟进位置。

## Task 60 关卡

Task 60（在已完成的 workflow 词汇表上进行 Agent plan 应用/运行）在 `HDR-PHASEA-001` 处于 Pending 状态期间不得启动。

Task 60 只能在以下条件之一成立后启动：

- `HDR-PHASEA-001` 已被人工复核者标记为 Pass。
- Phase A 验收的明确产品延后决定已同时记录在 `docs/progress/human-desktop-review-checklist.md` 与 `docs/progress/test-report.md` 中。

在该关卡打开之前，PlanCard 应用/运行以及 Agent 自动运行验收相关行 `HDR-050` 与 `HDR-051` 保持 Pending。
