# .kiro/ — Kiro IDE 治理层

ComicCanvas Studio 的 Kiro IDE 配置层。完整项目身份与全局禁止见根目录 `AGENTS.md` 和 `CLAUDE.md`。

本目录是 **Kiro** 专属运行时配置，源文件（`.codex/`、`.claude/`、`.agents/`）保持原样不变。

---

## 目录结构

```
.kiro/
├── README.md
├── steering/
│   ├── rules/                           # 规则类 steering（always + fileMatch）
│   │   ├── project-identity.md          # always — 项目身份、核心契约、全局禁止
│   │   ├── coding-standards.md          # always — 通用编码规范
│   │   ├── ltm-operations.md            # always — LTM 已停用
│   │   ├── electron-node.md             # fileMatch: desktop/src/main/**, preload/**
│   │   ├── agent-runtime.md             # fileMatch: desktop/src/main/agent/**
│   │   ├── canvas-engine.md             # fileMatch: desktop/src/renderer/canvas/**
│   │   ├── tool-contracts.md            # fileMatch: desktop/src/main/tools/**
│   │   ├── data-persistence.md          # fileMatch: desktop/src/main/db/**
│   │   ├── tests.md                     # fileMatch: **/*.test.ts, **/*.spec.ts 等
│   │   └── ltm-memory-format.md         # fileMatch: ltm/**，历史格式说明
│   ├── agents/                          # Agent 角色定义（manual，# 引用激活）
│   │   ├── agent-orchestrator.md        # #agent-orchestrator
│   │   ├── agent-canvas.md              # #agent-canvas
│   │   ├── agent-tooling.md             # #agent-tooling
│   │   └── agent-pm.md                  # #agent-pm
│   └── skills/                          # Skill 定义（manual，# 引用激活）
│       ├── skill-canvas-node-designer.md # #skill-canvas-node-designer
│       ├── skill-pm-req-planner.md       # #skill-pm-req-planner
│       └── skill-creator.md              # #skill-creator
└── hooks/                               # Kiro 自动化钩子（JSON，v1 schema）
    ├── ltm-capture-on-stop.json         # disabled
    └── ltm-checkpoint-post-task.json    # disabled
```

---

## 激活方式速查

### rules/ — 始终加载（inclusion: always）
每次对话自动注入，无需手动引用：

| 文件 | 内容 |
| :--- | :--- |
| `rules/project-identity.md` | 项目身份、核心契约、全局禁止、角色速查 |
| `rules/coding-standards.md` | 通用 TS/架构编码规范 |
| `rules/ltm-operations.md` | LTM 已停用提示 |

### rules/ — 文件匹配自动加载（inclusion: fileMatch）
当 chat 中引用或打开匹配路径的文件时自动加载：

| 文件 | 匹配路径 |
| :--- | :--- |
| `rules/electron-node.md` | `desktop/src/main/**`, `desktop/src/preload/**` |
| `rules/agent-runtime.md` | `desktop/src/main/agent/**` |
| `rules/canvas-engine.md` | `desktop/src/renderer/canvas/**` |
| `rules/tool-contracts.md` | `desktop/src/main/tools/**` |
| `rules/data-persistence.md` | `desktop/src/main/db/**` |
| `rules/tests.md` | `**/*.test.ts`, `**/*.spec.ts`, `**/*.test.tsx`, `**/*.spec.tsx` |
| `rules/ltm-memory-format.md` | `ltm/**`（历史格式说明） |

### agents/ — 手动激活（inclusion: manual）
在 chat 输入框用 `#` 引用，或输入 `/` 选择 slash command：

| 角色 | 引用方式 | 用途 |
| :--- | :--- | :--- |
| orchestrator-agent | `#agent-orchestrator` | 自然语言 → CanvasPlan 编排 |
| canvas-agent | `#agent-canvas` | 画布 / 节点 / 连线实现 |
| tooling-agent | `#agent-tooling` | 主进程 / Tool / DB / 队列 |
| pm-agent | `#agent-pm` | 需求 / 契约 / 进度管理 |

### skills/ — 手动激活（inclusion: manual）

| Skill | 引用方式 | 用途 |
| :--- | :--- | :--- |
| canvas-node-designer | `#skill-canvas-node-designer` | 新增/修改节点类型（六处一致）|
| pm-req-planner | `#skill-pm-req-planner` | EARS 需求规格化三件套 |
| skill-creator | `#skill-creator` | 创建新 Kiro steering skill |

---

## 对应关系（与源文件映射）

| Kiro 文件 | 对应源文件 |
| :--- | :--- |
| `rules/project-identity.md` | `AGENTS.md` + `CLAUDE.md` |
| `rules/coding-standards.md` | `.claude/rules/coding-standards.md` |
| `rules/ltm-operations.md` | `.claude/rules/ltm-operations.md` |
| `rules/ltm-memory-format.md` | `.claude/rules/ltm-memory-format.md` |
| `rules/electron-node.md` | `.claude/rules/electron-node.md` |
| `rules/agent-runtime.md` | `.claude/rules/agent-runtime.md` |
| `rules/canvas-engine.md` | `.claude/rules/canvas-engine.md` |
| `rules/tool-contracts.md` | `.claude/rules/tool-contracts.md` |
| `rules/data-persistence.md` | `.claude/rules/data-persistence.md` |
| `rules/tests.md` | `.claude/rules/tests.md` |
| `agents/agent-orchestrator.md` | `.claude/agents/orchestrator-agent.md` + `.codex/agents/orchestrator-agent.toml` |
| `agents/agent-canvas.md` | `.claude/agents/canvas-agent.md` + `.codex/agents/canvas-agent.toml` |
| `agents/agent-tooling.md` | `.claude/agents/tooling-agent.md` + `.codex/agents/tooling-agent.toml` |
| `agents/agent-pm.md` | `.claude/agents/pm-agent.md` + `.codex/agents/pm-agent.toml` |
| `skills/skill-canvas-node-designer.md` | `.agents/skills/canvas-node-designer/SKILL.md` |
| `skills/skill-pm-req-planner.md` | `.agents/skills/pm-req-planner/SKILL.md` |
| `skills/skill-creator.md` | `.agents/skills/skill-creator/SKILL.md` |
| `hooks/ltm-capture-on-stop.json` | 已停用 |
| `hooks/ltm-checkpoint-post-task.json` | 已停用 |

---

## Kiro Spec（规格驱动开发）

使用 Kiro Spec 模式处理大型功能时，pm-agent 的产出目录统一为根目录 `specs/`（全项目共享真源）：

```
specs/<feature-slug>/
├── requirements.md   ← EARS 风格 AC + INV-x 不变量
├── design.md         ← 架构图 + 组件 + 数据模型 + 测试策略
└── tasks.md          ← 可勾选实现任务清单
```

在 Kiro chat 中引用 `#skill-pm-req-planner` 开始需求规格化流程。

---

## 注意事项

1. 本目录所有文件为 Kiro IDE 专属配置，**不修改** `.codex/`、`.claude/`、`.agents/` 源文件。
2. 三套系统（Kiro / Claude Code / Codex）共享同一个 `specs/` 目录作为产品 spec 真源。
3. 当前项目不再使用 LTM；不要运行 `ltm/bin/ltm.py`。
4. Kiro 引擎会递归扫描 `steering/` 子目录，`rules/`、`agents/`、`skills/` 均正常加载。
