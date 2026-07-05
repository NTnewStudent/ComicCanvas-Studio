# RUEPE 全队列自主执行 — 设计文档

Date: 2026-07-05

Canonical rule: `.cursor/rules/ruepe-task-execution.mdc`

Plan source: approved autonomous queue plan (2026-07-05).

## 目的

在 RUEPE 单线程规则下，从 `milestone-execution-plan` Task 41 起顺序完成 M5 剩余工程项（41–47），同步 foundation 规划桩与 backlog 对账，最后整批人工桌面验收。执行期不向用户提问；链暂停时用户发送「继续任务」续跑。

## 阶段边界

| 阶段 | 范围 | 自动链 |
| :--- | :--- | :--- |
| A | milestone-execution-plan Task 41–47 | 是 |
| B | core-platform-foundation Task 24–27 交叉 `[x]` | 随 A 同步 |
| C | backlog REQ-050/090–097 对账 | 是 |
| D | Phase 7 人工验收 + checklist | 工程完成后 |
| E | conversation-context-engine / infinite-canvas | 暂缓，另开指针 |

## 自主执行协议

1. Read `docs/progress/backlog.md`「当前执行项」→ 打开 spec 任务块。
2. 每项完整 RUEPE 五阶段；测试通过前不得 `[x]`。
3. 进度双写：spec Evidence + `project-log.md` + backlog 指针。
4. 每条用户消息最多连续 3 项；达上限输出链摘要。
5. HDR / REQ-098 在 Phase D 统一执行；工程阶段仅 Product Deferral + 自动化证据。

## 已完成基线

- hjwall-canvas-full-migration: 33/33
- hjwall-assets-workflows-100-migration: 64/64
- canvas-agent-orchestration: 22/22

## Task 41–47 交付摘要

见 approved plan file; implementation evidence recorded in spec tasks and `docs/progress/test-report.md`.
