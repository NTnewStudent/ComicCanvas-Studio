# .cursor/ — Cursor IDE 治理层

ComicCanvas Studio 的 Cursor 专属配置层。完整项目身份与全局禁止见根目录 `AGENTS_CURSOR.md` 与 `AGENTS_CODEX.md`。

本目录**不修改** `.codex/`、`.claude/`、`.kiro/`、`.agents/` 源文件。

官方文档：[Rules](https://cursor.com/docs/rules) · [Subagents](https://cursor.com/docs/subagents)

---

## 目录结构

```
.cursor/
├── README.md
├── mcp.json
├── rules/                         # Project Rules（.mdc）
│   ├── project-identity.mdc       # alwaysApply
│   ├── coding-standards.mdc       # alwaysApply
│   ├── ruepe-task-execution.mdc   # alwaysApply — RUEPE 逐项任务执行
│   ├── ltm-operations.mdc         # alwaysApply
│   ├── project-commands.mdc       # Apply Intelligently（description）
│   ├── electron-node.mdc          # globs
│   ├── agent-runtime.mdc
│   ├── canvas-engine.mdc
│   ├── tool-contracts.mdc
│   ├── data-persistence.mdc
│   ├── tests.mdc
│   ├── ltm-memory-format.mdc
│   ├── agent-*.mdc                # Apply Manually（@ 引用，无 description）
│   ├── skill-*.mdc
│   └── qingtian-mcp.mdc
└── agents/                        # Subagents（.md + YAML frontmatter）
    ├── orchestrator-agent.md
    ├── canvas-agent.md
    ├── tooling-agent.md
    └── pm-agent.md
```

---

## Rules vs Subagents

| | Project Rules | Subagents |
| :--- | :--- | :--- |
| 路径 | `.cursor/rules/*.mdc` | `.cursor/agents/*.md` |
| 格式 | `description` / `globs` / `alwaysApply` | `name` / `description` / `model` / `readonly` / `is_background` + 正文 prompt |
| 激活 | `@规则名`、globs、alwaysApply、智能 description | `/subagent名`、Agent 自动委托 |
| 用途 | 向**当前** Agent 注入约束 | **独立 context** 执行子任务 |

---

## Rules 激活速查

### alwaysApply: true

| 文件 | 内容 |
| :--- | :--- |
| `project-identity.mdc` | 项目身份、契约、禁止 |
| `coding-standards.mdc` | TS/架构规范 |
| `ruepe-task-execution.mdc` | RUEPE 五阶段、backlog 指针、spec 逐项、测试门禁、进度双写 |
| `ltm-operations.mdc` | LTM 已停用 |

### Apply Intelligently（description）

| 文件 | 内容 |
| :--- | :--- |
| `project-commands.mdc` | Bun/Git 命令安全策略 |

### globs 自动附加

| 文件 | 匹配 |
| :--- | :--- |
| `electron-node.mdc` | `desktop/src/main/**`, `desktop/src/preload/**` |
| `agent-runtime.mdc` | `desktop/src/main/agent/**` |
| `canvas-engine.mdc` | `desktop/src/renderer/canvas/**` |
| `tool-contracts.mdc` | `desktop/src/main/tools/**` |
| `data-persistence.mdc` | `desktop/src/main/db/**` |
| `tests.mdc` | `**/*.{test,spec}.{ts,tsx}` |
| `ltm-memory-format.mdc` | `ltm/**` |

### Apply Manually（无 description，仅 `@`）

| Rule | 引用 |
| :--- | :--- |
| agent-orchestrator | `@agent-orchestrator` |
| agent-canvas | `@agent-canvas` |
| agent-tooling | `@agent-tooling` |
| agent-pm | `@agent-pm` |
| skill-canvas-node-designer | `@skill-canvas-node-designer` |
| skill-pm-req-planner | `@skill-pm-req-planner` |
| skill-creator | `@skill-creator` |

---

## Subagents 激活速查

| Subagent | 显式调用 | 说明 |
| :--- | :--- | :--- |
| orchestrator-agent | `/orchestrator-agent` | CanvasPlan 编排 |
| canvas-agent | `/canvas-agent` | 画布渲染 |
| tooling-agent | `/tooling-agent` | 主进程 / Tool / DB |
| pm-agent | `/pm-agent` | 需求 / 契约 / 进度 |

Subagent 的 `description` 供主 Agent 自动委托；可写 "Use proactively when ..." 提高触发率。

---

## 源文件映射

| Cursor 文件 | 源 |
| :--- | :--- |
| `rules/*.mdc` | `.claude/rules/`、`.kiro/steering/rules/` |
| `rules/project-commands.mdc` | `.codex/rules/project-commands.rules` |
| `rules/agent-*.mdc` | `.kiro/steering/agents/agent-*.md` |
| `agents/*.md` | `.codex/agents/*.toml` + 上述 agent rules |

---

## 注意事项

1. `AGENTS_CURSOR.md` 为 Cursor 入口文档；Cursor 默认可自动加载根目录 `AGENTS.md`，本文件需手动引用或在设置中配置。
2. 四套 IDE 配置共享 `specs/` 作为产品 spec 真源。
3. 不使用 LTM；不要运行 `ltm/bin/ltm.py`。
4. `mcp.json` / `qingtian-mcp.mdc` 为环境相关配置。
