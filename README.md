# ComicCanvas Studio

> AIGC 漫剧画布 + Agent 自动编排桌面客户端 — 本地优先，混合存储（媒体上云 + 项目本地）。
> Electron + TypeScript + Node.js + SQLite。

用户既能**手动**操作 React Flow 画布，节点化生成图片 / 视频 / 角色三视图；也能用**自然语言驱动 Agent** 自动完成「生成节点 → 连线 → 串行执行任务」的编排闭环。手动操作与 Agent 编排复用同一套 Tool 实现，区别仅在触发源。

融合两个参考项目的核心能力：
- **画布侧**：React Flow 节点画布、连接关系矩阵、确定性 prompt 拼接、声明式 CanvasPlan 编排、异步任务 / 资产管线。
- **Agent 侧**：AsyncGenerator 主循环、统一 Tool 接口、上下文压缩 / 故障恢复、Skills / Hooks、子 Agent spawn。

完整调研与架构决策见 [`docs/research-report.md`](docs/research-report.md) 与 [`docs/architecture/01-system-architecture.md`](docs/architecture/01-system-architecture.md)。

---

## 技术栈

| 层 | 选型 |
| :--- | :--- |
| 桌面外壳 | Electron + TypeScript 5（strict） |
| 渲染层 | React 18 + Vite 5 + @xyflow/react + Zustand v4 + TanStack Query v5 + Tailwind |
| 主进程 / 运行时 | Node.js 20+（Electron main process） |
| 数据库 | SQLite（better-sqlite3 + Drizzle ORM），DB 抽象层可切 MySQL |
| 任务队列 | 进程内持久化队列（落 SQLite `jobs` 表），无 BullMQ / Redis |
| 实时通信 | Electron IPC 事件（`webContents.send` + 渲染层订阅），无 WebSocket |
| Agent | AsyncGenerator 主循环 + 统一 Tool 接口 + Skills + 子 Agent |
| 资产 | 本地 `appData/assets/`，DB 存相对路径，渲染走 `cc-asset://` 安全协议 |
| 包管理 / 构建 | Bun 1.3.14（见 `.bun-version` / `bun.lock`） |

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Renderer (React 18 · Vite · contextIsolation=true · sandbox)              │
│                                                                            │
│   canvas/ ──── React Flow 画布 · 节点 · 连线 · Zustand graph store          │
│   chat/   ──── Agent 对话区 · blocks(Text/Thinking/ToolCall/…) · run trace  │
│   settings/ ── 网关 / Agent / 工具 / 资产文件夹配置                          │
│   projects/ · assets/ · stores/                                            │
└───────────────▲───────────────────────────────────┬──────────────────────┘
                │  window.api（preload 白名单，具名方法） │
   contextBridge │                                    │ IPC invoke / 事件订阅
                │            shared/ipc.ts（唯一契约） ▼
┌───────────────┴────────────────────────────────────────────────────────┐
│  Main Process (Node 20+)                                                 │
│                                                                          │
│  ipc/         薄 handler：Zod 校验 → 转调 service（domain.action 命名）    │
│  agent/       AsyncGenerator 主循环 · orchestrator · intent-analysis     │
│               compaction（上下文压缩）· recovery（故障恢复）· cost          │
│               sanitize-plan / sanitize-graph · spawn-sub-agent            │
│  tools/       统一 Tool 接口：canvas / asset / fs / web-search / plugin    │
│  jobs/        持久化任务队列 + JobWorker（入队即返票据，终态回推）           │
│  providers/   模型网关适配器（OpenAI 兼容，热拔插）· 本地网关引导            │
│  storage/     媒体云存储 provider（asset cloud url）                       │
│  db/          Drizzle schema · migrations · repositories（仓储层）         │
│  assets/      本地资产管线（cc-asset:// 协议 · 路径越界校验）               │
│  knowledge/ · skills/ · audit/ · security/                               │
└───────────────┬──────────────────────────────────────────────────────────┘
                │
        ┌───────┴────────┐         ┌────────────────────────┐
        │  SQLite (本地)   │         │  模型网关 / 云存储 (远程) │
        │  项目 · 队列 · 对话│        │  image / video / text    │
        └────────────────┘         └────────────────────────┘

shared/  ── 前后端唯一真源契约：connection-matrix · plan · nodes · graph
            ipc · tools-agents · gateway · chat-blocks · composed-prompt …
```

**关键数据流**

1. **手动生成**：画布 `runNode` → Tool 入 `jobs` 队列 → 立即返票据 → JobWorker 调网关 → `job.completed`/`job.failed` IPC 事件回推 → 节点刷新。绝不在入队入口同步等待模型。
2. **Agent 编排**：自然语言 → Agent 主循环 → `proposePlan` 产出声明式 `CanvasPlan` → `sanitizePlan`（白名单 + 连接矩阵 + 去代码）→ applyPlan 落图 → 串行 `runNode`。
3. **连接约束**：`shared/connection-matrix.ts` 是唯一真源（`text → image|video`、`image → image|video`、`video → video`），前后端共同消费，不各存副本。

---

## 仓库布局

```
ComicCanvas-Studio/
├── CLAUDE.md / AGENTS.md          # 项目规则 + Agent 行为准则（多工具镜像 AGENTS_*.md）
├── .claude/ .codex/ .cursor/ …    # 各 AI 工具治理层（agents / rules / skills / commands）
├── specs/                         # 项目级 requirements / design / tasks 全局真源
├── shared/                        # 前后端唯一真源契约（连接矩阵 / Plan / IPC / 节点 …）
├── desktop/
│   └── src/
│       ├── main/                  # 主进程：agent / tools / jobs / providers / storage
│       │                          #        db / assets / knowledge / skills / ipc
│       ├── preload/               # contextBridge 白名单 API
│       └── renderer/src/          # 渲染层：canvas / chat / settings / projects / assets
├── tests/                         # vitest 单元 / 属性 / 集成测试
├── scripts/                       # CI 辅助脚本（run-vitest / verify-repo / release-dry-run）
└── docs/                          # research-report / architecture / api-contracts / progress
```

> `hjwall/`、`cc-haha-main/` 为本地参考仓库，已被 `.gitignore` 忽略，不属于产品代码。

---

## 快速开始

```bash
# 依赖（Bun 1.3.14）
bun install --frozen-lockfile

# 配置环境变量（可选）
cp .env.example .env

# 开发运行（会先 rebuild better-sqlite3 native 模块）
bun run dev

# 完整 CI：lint + typecheck + test + build + 仓库卫生检查
bun run ci
```

### 模型网关配置

模型 API Key **不入库、不写明文配置、不进日志**。两种注入方式：

- **设置页**：运行时在 UI 填 baseUrl / Key，走 OS 安全存储；改配置后重新初始化 Provider，无需重启。
- **本地引导文件**：开发期可在应用根目录放 `local-gateways.json`（已被 git 忽略），或用环境变量 `COMIC_CANVAS_GATEWAYS_FILE` 指定路径。格式见 [`.env.example`](.env.example) 与 [`docs/api-contracts/gateway-providers.md`](docs/api-contracts/gateway-providers.md)。

未配置任何真实网关时，运行时回落到内置 stub provider，便于离线开发与测试。

---

## 核心契约（`shared/`）

| 文件 | 作用 |
| :--- | :--- |
| `connection-matrix.ts` | 节点连接矩阵（唯一真源） |
| `plan.ts` | 声明式 `CanvasPlan` / `RunAction` 类型 |
| `nodes.ts` / `graph.ts` | 节点 / 边 / 图数据模型 |
| `composed-prompt.ts` | 确定性 prompt 拼接（前后端字节等价） |
| `tools-agents.ts` | 统一 Tool 接口 + Agent 描述 |
| `gateway.ts` | 网关配置视图（`GatewayConfigView`，不含密钥） |
| `chat-blocks.ts` | Agent 对话块（Text / Thinking / ToolCall / …）契约 |
| `ipc.ts` | IPC 通道契约（`domain.action`） |

---

## 测试

```bash
bun run test          # 全量 vitest
```

- 纯函数（`lib/`）优先属性测试（`fast-check`）：连接矩阵穷举、prompt 拼接字节等价、`sanitizePlan` 去代码。
- 每个 jobId 的 `job.completed` + `job.failed` 合计恰好一次（终态唯一性，强制）。
- 详见 [`.claude/rules/tests.md`](.claude/rules/tests.md)。

---

## 全局红线

- ❌ CanvasPlan 里出现可执行代码 / 脚本字符串
- ❌ 前后端各自维护连接矩阵副本（只消费 `shared/connection-matrix.ts`）
- ❌ 生图 / 生视频走同步阻塞路径（必须入任务队列，IPC 事件回推终态）
- ❌ `contextIsolation: false` 或 `nodeIntegration: true`
- ❌ TypeScript `any`（用 `unknown` + 类型收窄）
- ❌ 密钥明文存储 / 写日志 / 入库
- ❌ DB 查询散落业务层（走仓储层）
- ❌ 未在 `docs/api-contracts/` 登记契约就开新 IPC 通道

---

## CI/CD

GitHub Actions 在 push/PR 上运行 lint、typecheck、unit tests、build 和仓库卫生检查；tag `v*.*.*` 触发 release dry-run。详见 [`docs/ci-cd.md`](docs/ci-cd.md)。

## 项目记忆

当前项目不使用 LTM。进度以 `specs/`、`docs/progress/`、git 状态与用户最新指令为准，不要运行 `ltm/bin/ltm.py` 或依赖 `ltm/runtime/active-context.json`。
