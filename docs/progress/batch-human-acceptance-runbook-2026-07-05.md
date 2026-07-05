# 批量人工验收 Runbook（2026-07-05）

日期：2026-07-05

工程队列已完成：M5 milestone-execution-plan **47/47**。

## 前置条件

1. `bun install && bun run rebuild:native`
2. `bun scripts/run-vitest.mjs run`（完整测试套件）
3. `bun run dev` — 启动桌面客户端

## 场景来源

执行以下文件中的每个场景：

- `docs/progress/hjwall-canvas-phase7-human-review-scenarios.md`

## 检查清单

在以下文件中记录 Pass/Fail：

- `docs/progress/human-desktop-review-checklist.md`

关键关卡：

- `HDR-PHASEA-001` — Phase A 矩阵总览
- `HDR-050` / `HDR-051` — Agent plan apply/run 桌面端流程

## 已落地的自动化证据

| Area | Tests |
| :--- | :--- |
| SkillRegistry | `tests/skill-registry.test.ts` 3/3 |
| PluginLoader | `tests/plugin-loader.test.ts` 2/2 |
| KnowledgeStore | `tests/knowledge-store.test.ts` 1/1 |
| Audit/redaction | `tests/redaction.test.ts` 2/2 |
| M5 integration | `tests/m5-integration.test.ts` 1/1 |
| Agent plan apply | `tests/agent-plan-apply-run.test.ts` |

## 会话模板

使用 `docs/progress/phase-a-human-review-session-template.md`，并附加：

- 评审人姓名 + 日期
- App commit SHA
- 逐场景 Pass/Fail 备注

## 验收后动作

1. 当所有阻塞性 HDR 行均为 Pass 时，更新 REQ-098 → ✅
2. 按 backlog 焦点，将 RUEPE 指针推进到 Phase E（`conversation-context-engine` task 1）或 infinite-canvas
