---
inclusion: manual
---

# canvas-agent

渲染层画布体验：React Flow 画布、节点组件、连线交互、Plan 应用与执行前端落地。

## 项目身份

ComicCanvas Studio — AIGC 漫剧画布 + Agent 自动编排桌面客户端（Electron + TS + SQLite，本地优先）。

## 范围

`desktop/src/renderer/canvas/**`

## 技术栈

React 18 + `@xyflow/react` + Zustand v4（画布 store，含 undo/redo）+ TanStack Query v5 + Tailwind/design tokens

## 设计系统

- 在任何渲染层 UI/UX 工作之前，先读取并遵守 `global/design/DESIGN.md`。
- 全局视觉语言：Obsidian Midnight + Champagne Gold quiet-luxury canvas。使用文档中的 `--cc-*` token、组件规范、动效指导、无障碍基准与评审清单。
- 若缺少 token，先补充设计规范或在实现计划中说明新增语义 token，不得硬编码一次性值。

## 节点类型（shared/nodes.ts）

`text` / `image` / `video`。image 节点把「配置」与「生成结果」合一；video 节点含首/尾帧图引用与时长参数。

## 连线类型

`promptOrder`（提示词拼接顺序）/ `imageOrder` / `imageRole`（first_frame/last_frame/input_reference）/ `default`

## 前端复用基线

使用 `hjwall/pc-client/src/modules/workflow-canvas/` 作为主要渲染层参考，再适配 ComicCanvas 契约和 `global/design/DESIGN.md`。

## 必须遵守的画布契约

1. **连接校验**：`onConnect` 调 `canConnect(u,d)`（来自 `shared/connection-matrix.ts`），非法则阻断并 toast 中文原因，≤200ms
2. **确定性 prompt 预览**：多输入按 `edge.createdAt` 升序拼接，`lib/composed-prompt.ts` 与主进程字节等价
3. **画幅自适应**：预览框宽度锚定，高度按 `orientation`（landscape 16:9 / portrait 9:16 / square 1:1）切换，`object-fit: contain`
4. **Plan 应用**：`lib/plan-applier.ts` — 节点白名单 + 连线矩阵二次校验 + 分层布局 + 整个 Plan 折叠为**一条** undo 快照
5. **串行执行**：`lib/plan-runner.ts` 纯状态机，终态经 IPC 事件注入（上一步 `completed` 才触发下一步，`failed` 短路）
6. **零轮询**：状态只靠 IPC 事件 + query 失效重取，禁止 `setInterval` / `refetchInterval`

## lib/ 纯函数（无副作用，可测）

`connection-matrix` / `composed-prompt` / `plan-applier` / `plan-runner` / `auto-layout`

## 上岗读取清单

1. `project-identity` steering（已自动加载）
2. 本文件
3. `canvas-engine` steering（已按文件路径自动加载）
4. `global/design/DESIGN.md`
5. `shared/`（nodes.ts / connection-matrix.ts / plan.ts）

## 红线

- ❌ 在渲染层写主进程逻辑或直连 Node API（必须经 preload IPC）
- ❌ 本地维护连接矩阵副本（消费 `shared/connection-matrix.ts`）
- ❌ 硬编码色值/字号/圆角（用 design token）
- ❌ `setInterval` 轮询资产状态
- ❌ 未经 `shared/ipc.ts` 注册的 IPC 用法
