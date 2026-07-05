# hjwall Canvas 全量迁移 — Phase 7 人工评审场景

日期：2026-07-05

规范来源：`specs/hjwall-canvas-full-migration/tasks.md`（tasks 30–32）

配套检查清单：`docs/progress/human-desktop-review-checklist.md`

Runbook：`docs/progress/phase-a-human-review-runbook.md`

工程状态：场景已编写并关联到 HDR 行。在评审人于检查清单中记录 Pass/Fail 之前，**人工执行仍处于 Pending** 状态（REQ-098）。

---

## 场景 A — 完整漫剧链路（Task 30）

**目标：** 在 stub jobs 上验证端到端的手动漫剧生产流程。

| 步骤 | 操作 | HDR / 证据 |
| :--- | :--- | :--- |
| 1 | 从 `/projects` 创建新的 workflow project | HDR-010 |
| 2 | 打开画布；添加带脚本内容的故事 `text` 节点 | HDR-020, HDR-NODE-001 |
| 3 | 添加 `character` 节点；绑定或描述角色 | HDR-NODE-001 |
| 4 | 通过顶部栏/风格面板设置项目默认风格 | HDR-CANVAS-005, HDR-032 |
| 5 | 添加 `imageConfigV2`；连接 text → image；如需可选择节点风格 | HDR-NODE-001 |
| 6 | 运行 stub image job；确认 ticket-first + 终态 `done` | HDR-032 |
| 7 | 添加 `videoConfigV2`；使用生成的图片作为首帧 | HDR-NODE-001 |
| 8 | 运行 stub video job；确认终态 | HDR-032 |
| 9 | 保存图（Ctrl+S / 自动保存）；重新打开项目 | HDR-015, HDR-WF-005, HDR-033 |

**通过标准：** 无阻塞性错误；节点状态到达终态；保存/重开后图与任务对齐保持不变，且无可见轮询。

---

## 场景 B — 资产与片段流程（Task 31）

**目标：** 验证资产库 + 片段（snippet）跨项目可移植性。

| 步骤 | 操作 | HDR / 证据 |
| :--- | :--- | :--- |
| 1 | 通过 `/assets` 或画布拖放导入图片、视频、音频 | HDR-022, HDR-ASSET-007, HDR-CANVAS-002 |
| 2 | 创建文件夹；移动资产；搜索/筛选/排序 | HDR-042, HDR-ASSET-005 |
| 3 | 将资产以类型化节点形式插入画布 | HDR-ASSET-006 |
| 4 | 选中两个或更多节点；保存为片段（snippet） | HDR-024 |
| 5 | 打开另一个项目；插入片段 | HDR-024, HDR-WF-004 |
| 6 | 保存并重新打开；确认 ID 与边已重新映射 | HDR-WF-004, HDR-033 |

**通过标准：** 导入内容显示安全的元数据（无绝对路径）；片段往返保持结构不变；被引用的资产按策略保持有效或被墓碑标记（tombstoned）。

---

## 场景 C — Agent 编排（Task 32）

**目标：** 在迁移后的词汇表上验证 Agent plan → apply → autoExecute（stub jobs）。

**关卡：** 在 Agent 相关行成为验收证据之前，需要 `HDR-PHASEA-001` Pass 或产品方明确延后决定（见 HDR-050..052）。

| 步骤 | 操作 | HDR / 证据 |
| :--- | :--- | :--- |
| 1 | 让 Agent 生成一条带有指定角色 + 风格的简短漫剧「图生视频」链路 | HDR-050 |
| 2 | 检查 PlanCard 中迁移后的节点/操作摘要 | HDR-051 |
| 3 | 应用 plan；如未开启则启用 autoExecute | HDR-051 |
| 4 | 观察串行 stub 运行步骤与节点终态 | HDR-052 |

**通过标准：** Plan 仅使用迁移后的节点类型/操作；串行执行遵守失败短路（failed short-circuit）规则；终态在无渲染层轮询的情况下可见。

---

## 自动化冒烟测试覆盖

静态测试断言本文档存在且列出了必需的场景锚点：

- `tests/hjwall-canvas-phase7-scenarios.test.ts`

完整桌面端执行仍由人工负责（REQ-098）。
