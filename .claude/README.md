# .claude/ — Claude Code 治理层

ComicCanvas Studio 的项目规则与 Agent 配置。完整项目身份与全局禁止见根目录 `CLAUDE.md`。

## 结构

```
.claude/
├── settings.json        # 权限配置（LTM 自动捕获已停用）
├── agents/              # 4 个子 agent 定义（自包含，@name 激活）
│   ├── orchestrator-agent.md
│   ├── canvas-agent.md
│   ├── tooling-agent.md
│   └── pm-agent.md
├── rules/               # 规则（alwaysApply 或按 globs 自动激活）
│   ├── coding-standards.md     # alwaysApply
│   ├── ltm-operations.md       # alwaysApply（LTM 已停用）
│   ├── ltm-memory-format.md    # 历史格式说明
│   ├── electron-node.md        # globs: desktop/src/main|preload/**
│   ├── agent-runtime.md        # globs: desktop/src/main/agent/**
│   ├── canvas-engine.md        # globs: desktop/src/renderer/canvas/**
│   ├── tool-contracts.md       # globs: desktop/src/main/tools/**
│   ├── data-persistence.md     # globs: desktop/src/main/db/**
│   └── tests.md                # globs: **/*.{test,spec}.{ts,tsx}
├── commands/            # 斜杠命令
│   ├── orchestrator.md / canvas.md / tooling.md / pm.md
│   └── ltm-recall.md / ltm-checkpoint.md（停用提示）
├── skills/              # 可激活技能
│   ├── pm-req-planner/         # EARS 需求规格化（含 assets 模板）
│   ├── canvas-node-designer/   # 新增节点五处一致
│   └── skill-creator/          # 创建新 skill 脚手架
└── specs/               # 需求/设计/任务三件套
    └── canvas-agent-orchestration/
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

## 角色导航

| 角色 | 定义 | 范围 |
| :--- | :--- | :--- |
| orchestrator-agent | `agents/orchestrator-agent.md` | `desktop/src/main/agent/` + `shared/plan.ts` |
| canvas-agent | `agents/canvas-agent.md` | `desktop/src/renderer/canvas/` |
| tooling-agent | `agents/tooling-agent.md` | `desktop/src/main/**` |
| pm-agent | `agents/pm-agent.md` | `docs/` + `.claude/specs/` |

## 真源契约

- `shared/connection-matrix.ts` — 节点连接矩阵
- `shared/plan.ts` — 声明式 CanvasPlan
- `shared/nodes.ts` — 节点 / 边类型
- `shared/ipc.ts` — IPC 通道
- `shared/tools-agents.ts` — Tool / Agent / Gateway / Folder
- `docs/api-contracts/` — 契约登记

## 总任务清单

`docs/progress/backlog.md`（里程碑 + REQ + 不变量）

## 项目记录

当前项目不再使用 LTM。不要运行 `ltm/bin/ltm.py`；任务状态以 `specs/`、
`docs/progress/`、git 状态和用户最新指令为准。
