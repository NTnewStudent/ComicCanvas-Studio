# 历史任务与规范差异分析

日期：2026-06-25

## 目的

本文档对比历史的 `task/M0-M5` PRD 文件与根目录下规范化的 `specs/` 目录树。目的是在保持 `specs/` 作为唯一执行事实来源的同时，防止有用的里程碑细节被遗忘。

## 当前来源状态

| 来源 | 状态 | 用途 |
| :--- | :--- | :--- |
| `specs/core-platform-foundation/` | 规范来源 | 实现前的平台基础契约 |
| `specs/canvas-agent-orchestration/` | 规范来源 | 画布编排 MVP 的需求/设计/任务 |
| `task/M0-M5` | 历史草稿 | 仅作参考；有用的细节已迁移到 `specs/milestone-execution-plan/` 中 |

## 覆盖情况汇总

| 领域 | 在 `task/` 中 | 在当前 `specs/` 中 | 差距 |
| :--- | :--- | :--- | :--- |
| M0 契约/治理 | 详细的 REQ-001..009，但为 Claude 时代且状态已过时 | Foundation spec 覆盖治理；canvas spec 覆盖共享契约 | 需要核对状态，并去除 `.claude` 作为治理事实来源 |
| M1 Electron/DB/jobs/provider/assets/IPC | 详细的实现任务与文件路径 | Foundation spec 覆盖契约；canvas spec 有高层任务 | 需要将详细的 M1 任务列表迁移到规范 spec 中 |
| M2 画布 UI | 详细的 Text/Image/Video 节点、store、prompt 面板、保存/加载、零轮询 | Canvas spec 仅覆盖压缩后的任务 | 需要保留组件级别的 UI 任务 |
| M3 网关 | 详细的 OpenAI provider、轮询、设置 UI、safeStorage、热切换、模型映射 | Foundation spec 覆盖网关抽象 | 需要补充具体的 provider/设置/安全任务 |
| M4 Agent 编排 | 详细的 orchestrator、tools、sanitizePlan、chat IPC、applyPlan、PlanRunner、Chat UI | Canvas spec 覆盖了大部分逻辑，但缺少 Chat UI 与准确的工具列表细节 | 需要合并详细的 UI/IPC 任务，并对齐工具命名 |
| M5 Agent 进阶 | 详细的 spawnSubAgent、隔离、自定义 agent UI、@mention、工具 UI、资产文件夹 | Foundation spec 广泛覆盖了 agents/tools/assets | 需要保留具体的进阶产品任务 |
| Skills 运行时 | 未覆盖 | Foundation spec 覆盖内置/自定义 skills | 需要为 SkillRegistry 与 skill 管理补充里程碑任务 |
| Plugin 工具 | 仅部分覆盖工具 UI | Foundation spec 覆盖 PluginLoader/隔离检疫（quarantine） | 需要补充具体的插件 manifest/加载/禁用任务 |
| Knowledge/RAG | 未覆盖 | Foundation spec 覆盖 KnowledgeStore/ContextBuilder | 需要补充具体的导入/检索/删除/重建任务 |
| 审计/可观测性/恢复 | 在不变量中仅有少量覆盖 | Foundation spec 覆盖审计与健康检查 | 需要补充具体的审计/日志/红化/健康检查任务 |

## 决策

1. `task/` 仍作为历史参考，不得用作执行事实来源。
2. 详细的里程碑实现计划已迁移到 `specs/milestone-execution-plan/` 中。
3. Backlog 仍作为 REQ 注册表；spec 中包含需求/设计/任务的细节。
4. M0 必须先完成基础契约，M1 才能开始。
5. `shared/tools-agents.ts` 应在 foundation 工作期间拆分为聚焦的共享契约，因此 `task/` 中关于编辑该文件的旧引用，均由 `shared/tools.ts`、`shared/agents.ts`、`shared/skills.ts`、`shared/gateway.ts` 与 `shared/knowledge.ts` 取代。

## 已补充到规范 spec 中的缺失项

- `specs/milestone-execution-plan/requirements.md`
- `specs/milestone-execution-plan/design.md`
- `specs/milestone-execution-plan/tasks.md`

## 后续状态

- 已完成：将 `specs/milestone-execution-plan/` 添加到 `specs/README.md`。
- 已完成：更新 `docs/progress/backlog.md`，将执行规划指向新的里程碑 spec。
- 已完成：在 `task/README.md` 中添加提示，说明 `task/` 是历史草稿材料。
- 已完成（2026-07-05）：M5 tasks 41–47 已结项；foundation tasks 24–27 已交叉引用；skills/plugins/knowledge/audit 运行时已实现。
