# Phase A 人工复核会话模板

复核日期：

复核者：

应用构建版本或 commit：

清单来源：`docs/progress/human-desktop-review-checklist.md`

操作手册来源：`docs/progress/phase-a-human-review-runbook.md`

## 会话规则

- 此处只记录人工桌面观察结果。
- 不要粘贴 R2、网关或本地机器的密钥。
- 不要将 Agent 自动化相关行 `HDR-050` 或 `HDR-051` 用作 Phase A 证据。
- Phase A 验收不包括 MJ 对等、MJ 多结果 UI、MJ URL 刷新、MJ 运行恢复或 MJ provider 集成。
- 一行只能通过带有负责人、原因与后续跟进位置的明确产品决定来延后。

## 必需行结果

| Row ID | Result | Reviewer / Date | Follow-up or Deferral |
| :--- | :--- | :--- | :--- |
| HDR-042 | Pending |  |  |
| HDR-043 | Pending |  |  |
| HDR-ASSET-001 | Pending |  |  |
| HDR-ASSET-002 | Pending |  |  |
| HDR-ASSET-003 | Pending |  |  |
| HDR-ASSET-004 | Pending |  |  |
| HDR-ASSET-005 | Pending |  |  |
| HDR-ASSET-006 | Pending |  |  |
| HDR-ASSET-007 | Pending |  |  |
| HDR-ASSET-008 | Pending |  |  |
| HDR-ASSET-009 | Pending |  |  |
| HDR-WF-001 | Pending |  |  |
| HDR-WF-002 | Pending |  |  |
| HDR-WF-003 | Pending |  |  |
| HDR-WF-004 | Pending |  |  |
| HDR-WF-005 | Pending |  |  |
| HDR-WF-006 | Pending |  |  |
| HDR-024 | Pending |  |  |
| HDR-CANVAS-001 | Pending |  |  |
| HDR-CANVAS-002 | Pending |  |  |
| HDR-CANVAS-003 | Pending |  |  |
| HDR-CANVAS-004 | Pending |  |  |
| HDR-CANVAS-005 | Pending |  |  |
| HDR-NODE-001 | Pending |  |  |
| HDR-NODE-002 | Pending |  |  |
| HDR-RUNTIME-001 | Pending |  |  |
| HDR-RUNTIME-002 | Pending |  |  |
| HDR-TOOLS-001 | Pending |  |  |
| HDR-PHASEA-001 | Pending |  |  |

## 失败记录

每个失败的行使用一个记录块。

```text
Row:
Observed issue:
Blocking impact:
Follow-up task or issue:
Reviewer:
Date:
```

## 产品延后决定记录

每个被延后的行使用一个记录块。延后决定在 Task 60 启动之前，还必须同步复制到 `docs/progress/human-desktop-review-checklist.md` 与 `docs/progress/test-report.md` 中。

```text
Row:
Deferral reason:
Product owner:
Follow-up location:
Date:
```

## 最终决策

`HDR-PHASEA-001` 结果：

决策备注：

Task 60 关卡：

- 在 `HDR-PHASEA-001` 为 Pending 或 Fail 期间保持关闭。
- 只有在 `HDR-PHASEA-001` 为 Pass 之后，或在清单与测试报告中都记录了明确产品延后决定之后，才能打开。
