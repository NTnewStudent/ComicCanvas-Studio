---
name: pm-req-planner
description: 把粗略需求转成标准化需求文档（EARS 风格 Acceptance Criteria + Correctness Properties），落 .claude/specs/<feature>/。用于 pm-agent 的需求规格化。
---

# pm-req-planner

把一句话需求拆成可验证的规格文档，沿用 hjwall 的 spec 风格（EARS + 不变量）。

## 何时使用

用户提出新功能 / 改造需求，需要在动手前先固化为「需求 → 设计 → 任务」三件套时。

## 产出

在 `.claude/specs/<feature-slug>/` 下生成：
- `requirements.md`：Introduction + Glossary + Requirements（User Story + EARS Acceptance Criteria）+ Correctness Properties（INV-x）。
- `design.md`：Overview + Architecture（mermaid）+ Components/Interfaces + Data Models + Testing Strategy + Migration/Cutover。
- `tasks.md`：可勾选的实现任务清单，每条标注验证方式与关联 Requirement。

## EARS 写法

- WHEN <触发> THE <系统> SHALL <行为>
- IF <条件> THEN THE <系统> SHALL <行为>
- WHILE <状态> THE <系统> SHALL <行为>
- WHERE <场景> THE <系统> SHALL <行为>
- FOR ALL <集合> ... SHALL ...（用于不变量）

## 本项目口径

- 凡涉及生成：必须写「全量异步 + IPC 事件 + 无同步资产返回」相关 AC。
- 凡涉及连线：必须引用 `shared/connection-matrix.ts` 作为唯一真源。
- 凡涉及 Agent 产物：必须约束 Plan 为纯声明式 JSON（无可执行代码）。
- 不变量优先用属性测试（fast-check）覆盖。

模板见 `assets/`。
