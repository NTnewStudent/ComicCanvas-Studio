# 调研汇报：hjwall 画布 + cc-haha-main Agent → 融合新项目

> 输出人：架构师视角整理 | 目标：在当前目录新建一个「漫剧画布 + Agent 自动编排」的桌面客户端项目
> 参考来源：`../hjwall`（AIGC 漫剧生成业务工程）、`../cc-haha-main`（Claude Code 本地 Agent 克隆）
>
> ⚠️ **更新说明（2026-06-24）**：本报告记录了初始调研与迁移规划，当时治理层目标定为 `.kiro/`。后续决策已将治理层统一为 **`.claude/`**（Claude Code 原生格式），`.kiro/` 已删除。下文 `.kiro/...` 的「迁移目标」均应读作 `.claude/` 下对应位置：`steering`/`rules` → `.claude/rules/`，`agents` → `.claude/agents/*.md`，`skills`/`specs` → `.claude/{skills,specs}/`，`hooks` → `.claude/settings.json` 的 Stop 钩子。最新结构以 `CLAUDE.md` 与 `.claude/README.md` 为准。

---

## 0. 一句话结论

把 **hjwall 的「React Flow 画布 + 声明式 Plan 编排 + 异步任务管线 + 资产管线」** 与 **cc-haha 的「AsyncGenerator Agent 主循环 + 统一 Tool 接口 + Skills/Hooks 体系」** 融合，做成一个 **Electron + TS + 本地 SQLite** 的离线优先桌面客户端：用户既能手动操作画布生图/生视频/生角色，也能用自然语言驱动 Agent 自动「生成节点 → 连线 → 串行执行任务」。

---

## 1. hjwall 调研结果（画布侧）

### 1.1 项目结构
- `backend/`：NestJS 10 + TypeORM + MySQL 8 + Redis(BullMQ) + JWT + Swagger。
- `pc-client/`：React 18 + Vite 5 + TS strict + React Router v6 + Zustand v4 + TanStack Query v5 + Tailwind。**画布功能全在 `pc-client/src/modules/workflow-canvas/`**。
- `cms-admin/`：Vue 3（规划，冻结）。
- 文档驱动：`docs/api-contracts/`（契约先行）、`docs/modules/`、`docs/progress/`。

### 1.2 画布核心（workflow-canvas 模块）
- **引擎**：`@xyflow/react`（React Flow）。`store.ts`（Zustand）管理 nodes/edges/undo 历史。
- **节点类型**（`types/index.ts` 的 `WfNodeType`）：
  `text` / `imageConfig` / `videoConfig` / `image` / `video` / `scene` / `character` / `audio` / `videoCompose` / `superResolution` / `muxAudioVideo`。
- **连线语义**（`WfEdgeType`）：`promptOrder`（提示词拼接顺序）/ `imageOrder` / `imageRole`（首帧/尾帧/参考图）/ `default`。
- **连接关系矩阵**（REQ-0761，`lib/connection-matrix.ts`）：前后端共享唯一真源 `NODE_CONNECTION_MATRIX`，定义「上游类型 → 允许下游类型集合」，画布与后端 Graph 校验器等价校验。
- **确定性 Prompt 拼接**（`lib/composed-prompt.ts`）：多输入按「连接时间顺序 Connection_Time_Order」用 `\n` 拼接 + 自身 prompt 追加，前后端字节等价、可重放（snapshot-at-submit）。
- **画幅自适应**：节点预览框宽度锚定、高度按 `orientation`（landscape/portrait/square）切换，`object-fit: contain` 不裁切。

### 1.3 Agent 编排画布（REQ-080，关键参考）
这正是用户「Agent 自动生成节点、自动执行任务」的需求原型：
- **对话入口** `hooks/useCanvasChat.ts`：用户发自然语言 → 异步入队（HTTP 立即返回票据，不阻塞 LLM）→ WS 事件 `stepType=workflow_canvas_orchestrate` 回填。
- **声明式 Plan**（`types/api.ts` 的 `OrchestratePlan`）：后端 LLM 产出**白名单清洗过的纯 JSON**（`nodes[] / edges[] / runSteps[] / summary / question`），**不含任何可执行代码**——安全核心。
- **Plan → 画布** `lib/plan-applier.ts`：节点类型白名单二次过滤 + 连线 `connectRules` 二次校验 + 自动分层布局 + 整个 Plan 折叠为一条 undo 快照。
- **串行执行** `lib/plan-runner.ts`：纯状态机驱动 `runSteps`，上一步终态(completed)才触发下一步，任一步 failed 短路，剩余步骤保留待手动执行。

### 1.4 异步任务 + 资产管线（REQ-0761）
- **全量异步**：所有生图/生视频走 WS 队列（BullMQ `agent-task` + `AgentWorker` + `AgentTaskGateway /ws/task`）；同步 HTTP 只做「建任务行 + 入队 + 返回票据」，响应体深度扫描禁止出现任何资产 URL。
- **资产管线**：LLM 网关原图字节 → 转存 COS → 落库只存 COS 裸 URL → 响应一律加签 Signed_URL；横竖判定 `width>height⇒landscape`。
- **计费**：`BillingService.preflight` 预扣 → 成功 `chargeOnSuccess`，失败归还。
- 6 条系统级不变量 INV-1..INV-6（COS 白名单 / 必返签名 / 确定性 prompt / 同步无资产 / orientation 完整 / 矩阵唯一真源）。

### 1.5 项目记录模式（LTM —— 用户指定沿用）
- `ltm/`：项目本地长期记忆，`ltm/bin/ltm.py` 工具 + `config.json` + `manifest.json`。
- 记录 4 类账本（`events.jsonl` / `checkpoints.jsonl` / `sessions.jsonl` / `open_threads.jsonl`）+ runtime（`active-context.json` / `last-recall.md`）。
- 钩子 `.kiro/hooks/ltm-postturn-capture.kiro.hook`（agentStop → `ltm.py capture-turn`）。
- 提交策略：工具入库，`store/runtime/reports/snapshots` 不入库。含密钥红化规则。

### 1.6 .kiro 治理结构（用户指定整体迁移）
- `steering/`：auto-included（coding-standards / project-overview / repo-structure）+ fileMatch（各端规则、module-specs、tests、ltm-memory-format）。
- `agents/`：4 个 sub-agent JSON（pm / frontend / cms-frontend / backend），`prompt: file://...`、`resources: [...]`。
- `skills/`：pm-req-planner / canvas-design / skill-creator / mcp-builder 等（多为 Anthropic 通用 skill）。
- `rules/`：backend-plugin.md（NestJS 规范）。
- `specs/`：requirements.md + design.md + tasks.md（Kiro spec 三件套，EARS 风格 + Correctness Properties）。
- `hooks/`：LTM 捕获钩子。

---

## 2. cc-haha-main 调研结果（Agent 侧）

### 2.1 Agent 核心循环（`src/query.ts`）
- **不是 ReAct，而是 AsyncGenerator 驱动的流式状态机**：`while(true)` + `state = next` + `continue`，无递归。
- 五阶段：① 消息压缩（snip/micro/折叠/auto-compact 四级）② 流式 API 调用（工具在流式中即执行）③ 决策点（有无 tool_use）④ 工具编排（只读并行≤10、写入串行）⑤ 状态更新。
- 6 种故障恢复策略（prompt 过长、输出 token 升级、stop hook、预算续跑等）。

### 2.2 统一 Tool 接口（`src/Tool.ts`）
每个工具是自描述/自验证/自渲染的生命周期单元：
- 身份：`name / aliases / searchHint`
- 能力声明：`isEnabled / isConcurrencySafe / isReadOnly / isDestructive`
- 生命周期：`validateInput → checkPermissions → call`
- 渲染：`renderToolUseMessage / renderToolResultMessage / renderToolUseProgressMessage`
- schema：Zod `inputSchema`
- 7 步执行管道：查找 → Zod 解析 → 自定义校验 → PreToolUse 钩子 → 权限检查 → 执行 → PostToolUse 钩子。
- 工具注册三阶段：基础工具池 → 过滤 → MCP 合并；支持延迟加载（ToolSearch）。

### 2.3 Skills 体系（`docs/skills/02-implementation.md`）
- SKILL.md + YAML frontmatter（`description / when_to_use / allowed-tools / model / context: inline|fork / agent / paths / hooks`）。
- 发现来源优先级：bundled → 内置插件 → 目录（managed/user/project）→ MCP。
- 注入：每轮以 `<system-reminder>` 列出可用 skill（1% 上下文预算截断）。
- 执行：`inline`（展开到当前对话）/ `fork`（独立子代理 + 独立 token 预算 + 工具白名单）。
- 条件激活：带 `paths` 的 skill 在操作匹配文件时动态激活。

### 2.4 桌面客户端（`desktop/`）
- Tauri + React + Vite。提供了「本地 Agent 打包成桌面应用」的工程参考（sidecar 进程托管 Agent）。

### 2.5 可复用资产
- Agent 主循环模型、Tool 接口契约、Skills frontmatter 规范、Hooks 生命周期、权限分层、上下文压缩思想。
- 注意：cc-haha 是 CLI/终端 Agent（Ink 渲染），其 UI 层不直接复用；**复用的是 Agent 内核设计与契约**。

---

## 3. 融合架构决策（架构师定稿）

| 维度 | 决策 | 理由 |
| :--- | :--- | :--- |
| 形态 | **Electron + TypeScript + Node.js** 桌面客户端 | 用户指定；离线优先、可打包分发 |
| 渲染层 | React 18 + Vite + `@xyflow/react` + Zustand + TanStack Query | 直接复用 hjwall 画布范式 |
| Agent 运行时 | 跑在 Electron **主进程/Node 侧**，AsyncGenerator 主循环 + 统一 Tool 接口 + Skills | 复用 cc-haha 内核 |
| 数据库 | **SQLite（better-sqlite3 + Drizzle ORM）**，DB 访问层抽象，MySQL 可切换 | 桌面端零外部依赖；抽象层保留 MySQL 选项 |
| 队列/实时 | **进程内持久化任务队列（落 SQLite）+ Electron IPC 事件** 替代 BullMQ/Redis + WS | 桌面无 Redis；IPC 取代 WS 回推节点状态 |
| 编排范式 | 自然语言 → **声明式 Canvas Plan(JSON)** → 应用画布 → runSteps 串行执行 | 复用 hjwall REQ-080，安全（无可执行代码） |
| 资产 | 生成字节落本地资产目录（`appData/assets/`）+ DB 存相对路径，渲染走 `safe-file://` 协议 | 桌面端无需 COS；保留 orientation/白名单思想 |
| 治理 | `.kiro`（steering/agents/rules/skills/hooks/specs）+ `AGENTS.md`/`CLAUDE.md` + `ltm/` | 整体迁移 hjwall 模式 |

### 3.1 核心数据流（用户需求落地）
```
用户自然语言 ─┐
              ▼
        Orchestrator Agent (AsyncGenerator 主循环)
              │  调用 Canvas 工具集（统一 Tool 接口）
              ▼
        声明式 Canvas Plan { nodes, edges, runSteps }
              │  白名单清洗 + 连接矩阵校验
              ▼
        applyPlan() → 画布生成节点 + 自动连线（一条 undo）
              ▼
        PlanRunner 串行执行 runSteps
              │  每步 → 入队本地任务 → JobWorker 调模型 → 落资产
              ▼
        IPC 事件回推节点状态（pending/processing/completed/failed）
              ▼
        画布节点实时刷新（生图/生视频/生角色三视图）
```

### 3.2 Canvas Agent 工具集（Agent 可调用）
`canvas.createNode` / `canvas.connectNodes` / `canvas.updateNodeData` / `canvas.runNode` / `canvas.queryGraph` / `canvas.proposePlan`（产出声明式 Plan）——全部走 cc-haha 的统一 Tool 接口（Zod schema + 权限 + 渲染）。

---

## 4. 迁移清单（hjwall → 新项目）

| 来源 | 去向 | 处理 |
| :--- | :--- | :--- |
| `.kiro/steering/*`（auto 三件套 + ltm-*） | `.kiro/steering/` | 迁移并改写为本项目（桌面/SQLite/Agent）口径 |
| `.kiro/agents/*.json` | `.kiro/agents/` | 重定义为 orchestrator/canvas/tooling/pm 四 agent |
| `.kiro/rules/backend-plugin.md` | `.kiro/rules/electron-node.md` | 改写为 Electron/Node 后端规范 |
| `.kiro/skills/pm-req-planner、skill-creator` | `.kiro/skills/` | 迁移；新增 canvas-node-designer |
| `.kiro/hooks/ltm-postturn-capture.kiro.hook` | `.kiro/hooks/` | 迁移，workspaceFolderName 改名 |
| `ltm/{README,config,manifest}.json` + 格式 steering | `ltm/` | 迁移项目记录模式（LTM）整套 |
| `.kiro/specs/*` 三件套范式 | `.kiro/specs/canvas-agent-orchestration/` | 用同范式写新 spec |
| `AGENTS.md`/`CLAUDE.md` 行为准则 | 根目录 | 迁移 + 替换项目身份与 agent 分工 |

> 说明：`ltm/bin/ltm.py` 是 ltm-power 工具脚本，需用户用 ltm-power 重新生成或从 hjwall 拷贝（不在本次代码产出范围）。已在 `ltm/README.md` 标注。

---

## 5. 不在本次范围 / 后续里程碑
本次只产出**治理层（AGENTS.md + .kiro + ltm + 架构/规格文档）**。后续按 spec 实现：
1. M1：Electron 骨架 + SQLite schema + DB 抽象层
2. M2：React Flow 画布 + 节点类型 + 连接矩阵 + 手动生图/生视频
3. M3：本地任务队列 + JobWorker + 模型适配器 + 资产管线 + IPC 实时
4. M4：Agent 主循环 + Tool 接口 + Canvas 工具集 + 声明式 Plan + applyPlan + PlanRunner
5. M5：Skills/Hooks 体系 + 角色三视图链路端到端
