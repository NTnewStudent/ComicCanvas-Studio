# ComicCanvas Studio — 总任务清单（Backlog）

> 全局真源。需求编号 REQ-xxx，状态：⬜ 未开始 / 🔵 进行中 / ✅ 完成 / 🅿️ 暂缓
> 全局 spec 入口见 `specs/README.md`；细粒度实现任务见 `specs/core-platform-foundation/tasks.md`、`specs/milestone-execution-plan/tasks.md` 与 `specs/canvas-agent-orchestration/tasks.md`。
> 最近更新：2026-06-26

---

## 里程碑

| 里程碑 | 目标 | 状态 |
| :--- | :--- | :--- |
| **M0** 契约 & 治理 | shared/ 契约、根级 specs/ 全局 spec、Codex 治理、调研汇报 | ✅ |
| **M1** 骨架可跑 | Electron + DB + 队列 + 一个 stub provider 端到端跑通手动生图 | ✅ |
| **M2** 画布完整 | 三节点完整交互、连接校验、确定性 prompt、资产管线 | ✅ |
| **M3** 网关系统 | OpenAI 兼容适配 + 设置页 + 热拔插 + 真实生图/生视频 | ✅ |
| **M4** Agent 编排 | 主循环 + Canvas 工具集 + Plan 清洗/应用/串行执行 | ✅ |
| **M5** Agent 进阶 | super-agent + 子 agent spawn + 工具/agent 管理 UI | ⬜ |

---

## REQ 列表

### M0 — 契约 & 治理

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-001 | `shared/nodes.ts` 三节点类型 + data 模型 | ✅ |
| REQ-002 | `shared/connection-matrix.ts` 连接矩阵 + canConnect | ✅ |
| REQ-003 | `shared/plan.ts` CanvasPlan 类型 | ✅ |
| REQ-004 | `shared/ipc.ts` IPC 通道契约 | ✅ |
| REQ-005 | `shared/tools-agents.ts` Tool/Agent/Gateway/Folder 类型 + spawnSubAgent | ✅ |
| REQ-006 | Codex/GPT 原生治理层（`.codex/` + `.agents/`，`.claude/` 仅兼容归档） | ✅ |
| REQ-007 | `docs/api-contracts/tools-agents.md` 工具集契约 | ✅ |
| REQ-008 | `shared/composed-prompt.ts` 确定性 prompt 拼接纯函数 | ✅ |
| REQ-009 | LTM 初始化（ltm/bin/ltm.py selftest 通过） | ✅ |
| REQ-018 | `specs/core-platform-foundation/` 核心平台基础契约（画布 / 队列 / 资产 / 网关 / Tools / Plugins / Agents / Skills / Knowledge/RAG） | ✅ |
| REQ-019 | `docs/api-contracts/*` 模块契约拆分登记（jobs/assets/gateway/tools/agents/skills/knowledge/audit） | ✅ |
| REQ-057 | `specs/milestone-execution-plan/` 从 `task/M0-M5` 迁移执行任务并查缺补漏 | ✅ |

### M1 — 骨架可跑

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-010 | Electron 脚手架（main + preload + renderer + electron-vite） | ✅ |
| REQ-011 | Drizzle schema + DB 抽象层（sqlite 默认 / mysql 可切） | ✅ |
| REQ-012 | 仓储层（workflow / jobs / asset / chat_message） | ✅ |
| REQ-013 | JobQueue + JobWorker 骨架（入队返票据，worker 占位） | ✅ |
| REQ-014 | Provider 接口 + stub provider | ✅ |
| REQ-015 | 资产管线（saveBytes + classifyOrientation + cc-asset:// 越界校验） | ✅ |
| REQ-016 | IPC handler 骨架（canvas.* / job.* 订阅） | ✅ |
| REQ-017 | 端到端：手动 createNode → runNode → stub 生图 → 节点刷新 | ✅ |

### M2 — 画布完整

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-020 | React Flow 画布 store（nodes/edges/viewport/undo） | ✅ |
| REQ-021 | Text 节点（折叠/展开，文本输入） | ✅ |
| REQ-022 | Image 节点（配置+生成+结果合一，四态） | ✅ |
| REQ-023 | Video 节点（含首/尾帧图，时长参数） | ✅ |
| REQ-024 | 连接校验（onConnect 调 canConnect + toast） | ✅ |
| REQ-025 | Connected Inputs Panel + 确定性 prompt 预览（字节等价） | ✅ |
| REQ-026 | 节点画幅自适应（orientation 切换 + contain + 骨架） | ✅ |
| REQ-027 | 节点 inline 改名（双击 label） | ✅ |
| REQ-028 | 画布保存/加载（持久化 graph JSON） | ✅ |
| REQ-029 | 零轮询验证（IPC 事件 + query 失效，无 setInterval） | ✅ |

### M3 — 网关系统

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-030 | OpenAI 兼容 Provider（/v1/images、/v1/chat 等） | ✅ |
| REQ-031 | 异步网关轮询（提交→remote_task_id→查询→落盘） | ✅ |
| REQ-032 | 设置页：网关配置（URL + Key + 模型映射） | ✅ |
| REQ-033 | API Key 走 OS safeStorage（不落明文/日志） | ✅ |
| REQ-034 | 网关热拔插（保存后重新初始化 Provider，不重启） | ✅ |
| REQ-035 | 多渠道模型映射（image/video/text 分别指向不同 endpoint） | ✅ |

### M4 — Agent 编排

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-040 | Orchestrator AsyncGenerator 主循环 | ✅ |
| REQ-041 | Tool 统一接口 + ToolRegistry | ✅ |
| REQ-042 | Canvas 工具集（queryGraph/proposePlan/createNode/connectNodes/updateNodeData/deleteNode/runNode） | ✅ |
| REQ-043 | sanitizePlan（白名单 + 矩阵 + 去代码 + dropped） | ✅ |
| REQ-044 | chatSend 异步入队 + IPC 终态 + chatGetPlan | ✅ |
| REQ-045 | applyPlan（二次校验 + 分层布局 + 一条 undo） | ✅ |
| REQ-046 | PlanRunner（串行 + failed 短路保留剩余） | ✅ |
| REQ-047 | 对话区 UI（消息面板 + Plan 预览 + 应用/执行按钮） | ✅ |
| REQ-048 | agent orchestration smoke path（自然语言 → Plan → applyPlan → runNode → stub asset → done node） | ✅ |

### M5 — Agent 进阶

| ID | 需求 | 状态 |
| :--- | :--- | :--- |
| REQ-050 | super-agent（allowedTools '*'，默认入口） | ⬜ |
| REQ-051 | agent.spawnSubAgent（内联定义 + 权限继承 + 深度上限） | ✅ |
| REQ-052 | 子 agent 隔离上下文执行 + 结果返回 | ✅ |
| REQ-053 | 用户自定义 agent（设置页创建 + DB 持久化 + AgentRegistry） | ✅ |
| REQ-054 | 对话区 agent 选择器（@mention 风格） | ✅ |
| REQ-055 | 工具管理设置页（启用/禁用 + ToolRuntime 拒绝路径） | ✅ |
| REQ-056 | 资产文件夹（用户自定义 + 嵌套 + 拖拽整理） | ✅ |

### V2 节点复刻（2026-06-26 迭代）

- REQ-060 ImageConfigV2Node（生图节点 V2）— 复刻 hjwall ImageConfigV2Node UI ✅
- REQ-061 VideoConfigV2Node（生视频节点 V2）— 复刻 hjwall VideoConfigV2Node UI ✅
- REQ-062 设计系统重置 — DESIGN.md 重置为 hjwall 炭黑+翠绿版本（含亮色模式章节） ✅
- REQ-063 CSS 动画系统移植 — 7 个 @keyframes + Handle 自定义 + 按钮系统 ✅
- REQ-064 画布引擎性能优化 — 消除双态同步 + React.memo + nodeTypes 模块级 + onlyRenderVisibleElements ✅
- REQ-065 共享组件库 — RunStatusBadge / Chip / PopoverMenu / PromptFocusModal / MentionTextarea ✅
- REQ-066 V2 节点注册 — nodeTypes + 连接矩阵 + store + 工具栏 ✅

> 接口端暂未实现（生成按钮为桩），等网关对接后集成。

### 会话迭代 2026-06-26（REQ-070 ~ REQ-076）

- REQ-070 Qoder IDE 配置迁移 — 4 agents + 10 rules + 3 skills + settings.json 从 .kiro/.codex 迁移到 .qoder ✅
- REQ-071 白屏修复 — preload .js→.mjs + CSP unsafe-inline + sandbox false（临时措施） ✅
  - ⚠️ sandbox: false 与 core-foundation R10.1 安全要求冲突，后续需评估恢复方案（preload ESM 配置或 CJS 构建）
- REQ-072 路由 + 侧边栏导航 — React Router + WorkspaceLayout + WorkspaceSidebar ✅
- REQ-073 wf-neo 双主题设计系统 — DESIGN.md 重置 + styles.css token + tailwind.config.ts ✅
- REQ-074 界面中文化 — 19 个组件 UI 文案从英文改为中文 ✅
- REQ-075 前端设计规范规则 — .qoder/rules/frontend-design-standards.md（glob 自动激活） ✅
 REQ-076 画布引擎性能优化 — 消除双态同步 + React.memo + nodeTypes 模块级 + onlyRenderVisibleElements ✅

### hjwall 核心功能迁移（REQ-077 ~ REQ-084）— 2026-06-26

- REQ-077 画布项目管理（多工作流创建/切换/重命名/删除） ✅
- REQ-078 工作流保存/加载（Ctrl+S + 自动保存 + 加载恢复） ✅
- REQ-079 画布内资产库面板（浮动面板+搜索+分类+时间排序） ✅
- REQ-080 画布左侧操作栏增强（数据驱动+展开菜单+功能按钮） ✅
- REQ-081 画布内 AI 对话（浮动 FAB + 展开面板 + Plan 应用） ✅
- REQ-082 画布右键菜单（空白区添加节点+节点操作） ✅
- REQ-083 节点引用创建（@mention 自动创建/清理连线） ✅
- REQ-084 后端接口本地化验证（IPC 映射完整性确认） ✅

---

## 安全与不变量（贯穿所有里程碑）

- [x] Canvas Plan 纯声明式 JSON，无可执行代码（PBT 注入测试） — `sanitize-plan.test.ts`
- [x] 连接矩阵唯一真源，前后端 canConnect 等价（PBT 穷举） — `connection-matrix.test.ts`
- [x] 确定性 prompt 前后端字节等价（PBT） — `composed-prompt.test.ts`
- [x] 终态事件唯一性：每 jobId completed+failed 恰好 1 次 — `job-ipc-fanout.test.ts`
- [x] 子 agent 权限 ⊆ 父 agent，禁止提权
- [x] 子 agent 递归深度 ≤ MAX_SPAWN_DEPTH(2)
- [x] 渲染进程沙箱（contextIsolation/nodeIntegration/sandbox） — `electron-security.test.ts`（⚠️ sandbox 当前为 false，见 REQ-071 例外）
- [x] API Key 不落明文 / 日志 / LTM — `key-vault.test.ts`

---

## 当前焦点

**当前焦点** → M5 第 41 项（SkillRegistry and skill management）
**下一步** → 实现内置/用户/plugin skill 发现、metadata-first 列表、懒加载引用、权限校验与 reload 一致性，并接入设置页管理 UI。
**前端路线** → M2-M5 所有 renderer UI 均以 Tailwind + `cn` + `global/design/DESIGN.md` 为基线；优先参考 `hjwall/pc-client` 对应模块的组件、交互和测试模式，再按 ComicCanvas 契约重实现，参考项目不提交。

---

## CI/CD Foundation

| ID | Requirement | Status |
| :--- | :--- | :--- |
| REQ-058 | Repository CI/CD foundation: reproducible Bun lockfile, lint/typecheck/test/build scripts, GitHub Actions CI, release dry-run, and repository hygiene checks that exclude local reference projects. | ✅ |
| REQ-059 | Frontend/backend build entry migration to Bun: pin `.bun-version`, use `bun.lock`, run CI/CD through `bun run`, and reject npm lock/config drift. | ✅ |
