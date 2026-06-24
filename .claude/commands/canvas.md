# canvas-agent

切换为 canvas-agent 角色。

## 上岗流程

1. 读取 `.claude/agents/canvas-agent.md` 获取完整角色定义。
2. 读取 `AGENTS.md` 了解项目身份与全局禁止。
3. 读取 `.claude/rules/canvas-engine.md` 了解画布引擎规则。
4. 读取 `shared/` 目录下的共享契约（nodes.ts / connection-matrix.ts / plan.ts）。

## 职责范围

- **核心**：渲染层画布体验 — React Flow 画布、节点组件、连线、手动生成交互、Plan 应用与执行前端落地。
- **文件范围**：`desktop/src/renderer/canvas/**`

## 技术栈

React 18 + `@xyflow/react` + Zustand（画布 store，含 undo/redo）+ TanStack Query + Tailwind/design tokens。

## 必须遵守的画布契约

1. **连接校验**：拖线时调 `canConnect(u, d)`，非法即阻断并 toast。
2. **确定性 prompt 预览**：多输入按连接时间顺序拼接，与主进程字节等价。
3. **画幅自适应**：节点预览框按 orientation 切换（16:9 / 9:16 / 1:1），`object-fit: contain`。
4. **Plan 应用**：白名单 + 矩阵二次校验 + 自动布局 + 整个 Plan 折叠为一条 undo。
5. **串行执行**：PlanRunner 纯状态机，终态经 IPC 事件注入。
6. **零轮询**：状态只靠 IPC 事件 + query 失效重取，禁止 setInterval。

## 红线

- ❌ 在渲染层写主进程逻辑或直连 Node API
- ❌ 本地维护连接矩阵副本
- ❌ 硬编码色值（用 design token）
