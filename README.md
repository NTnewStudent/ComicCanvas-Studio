# ComicCanvas Studio

> AIGC 漫剧画布 + Agent 自动编排桌面客户端 — local-first (Electron + TypeScript + Node.js + SQLite)。

用户既能手动操作画布生成图片 / 视频 / 角色（三视图），也能用自然语言驱动 Agent 自动「生成节点 → 连线 → 串行执行任务」。

## 这是什么

融合两个参考项目的核心：
- **画布侧**（参考 `../hjwall`）：React Flow 节点画布、连接关系矩阵、确定性 prompt 拼接、声明式 Plan 编排、异步任务/资产管线。
- **Agent 侧**（参考 `../cc-haha-main`）：AsyncGenerator Agent 主循环、统一 Tool 接口、Skills/Hooks 体系。

完整调研与架构决策见 [`docs/research-report.md`](docs/research-report.md) 与 [`docs/architecture/01-system-architecture.md`](docs/architecture/01-system-architecture.md)。

## 技术栈

| 层 | 技术 |
| :--- | :--- |
| 桌面外壳 | Electron + TypeScript |
| 渲染层 | React 18 + Vite 5 + @xyflow/react + Zustand + TanStack Query + Tailwind |
| 运行时 / 服务 | Node.js 20+（Electron 主进程） |
| 数据库 | SQLite（better-sqlite3 + Drizzle ORM），DB 抽象层（可切 MySQL） |
| 任务 / 实时 | 进程内持久化任务队列 + Electron IPC 事件 |
| Agent | AsyncGenerator 主循环 + 统一 Tool 接口 + Skills |

## 仓库布局（规划）

```
comic-canvas/
├── AGENTS.md / CLAUDE.md        # Agent 行为准则 + 项目身份
├── .codex/                      # Codex 原生配置：agents / rules / config
├── .agents/                     # Codex 仓库级 skills
├── .claude/                     # Claude Code 兼容层，不承载新的产品 spec
├── specs/                       # 项目级 requirements / design / tasks 全局真源
├── ltm/                         # 项目长期记忆（LTM 项目记录模式）
├── shared/                      # 前后端唯一真源契约（连接矩阵 / Plan 类型 / IPC 契约）
├── desktop/                     # Electron 应用
│   └── src/
│       ├── main/                # 主进程：agent / jobs / providers / db / ipc
│       └── renderer/            # 渲染层：canvas / nodes / stores / hooks
└── docs/                        # 调研 / 架构 / 契约 / 进度
```

## 开发状态

当前阶段：**治理层（governance scaffold）已建立**。代码实现按根目录 `specs/` 与 `docs/progress/backlog.md` 里程碑推进。

## CI/CD

第一版仓库已经提供可执行的 CI/CD foundation：

```bash
npm ci
npm run ci
```

GitHub Actions 会在 push/PR 上运行 lint、typecheck、unit tests、build 和仓库卫生检查；tag `v*.*.*` 会运行 release dry-run。详见 [`docs/ci-cd.md`](docs/ci-cd.md)。
