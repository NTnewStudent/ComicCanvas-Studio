---
globs: desktop/src/renderer/canvas/**
---

# 画布引擎规则

## 状态管理
- 单一 Zustand store 持有 `nodes` / `edges` / `viewport` / undo 历史（`past`/`future`）
- 节点/边数据模型严格用 `shared/nodes.ts` 类型
- 批量应用（Plan）折叠为一条 undo 快照

## 连接
- `onConnect` 调 `canConnect(u,d)`（`shared/connection-matrix.ts`），非法则阻断 + toast 中文原因
- 连线 `edgeType` 由规则推断（promptOrder / imageOrder / imageRole / default）

## Prompt 拼接
- 按 `edge.createdAt` 升序拼接，分隔符 `\n`（U+000A）
- `lib/composed-prompt.ts` 与主进程构造的文本部分字节等价

## 节点 UI
- 宽度锚定，高度按 `orientation` 切换（16:9 / 9:16 / 1:1），`object-fit: contain`
- pending/processing 按目标 orientation 渲染骨架，终态 ≤1s 替换

## 实时
- 状态只靠 IPC 事件 + query 失效重取，禁止 `setInterval` / `refetchInterval`

## 纯函数（lib/）
`connection-matrix` / `composed-prompt` / `plan-applier` / `plan-runner` / `auto-layout` — 无副作用，配套属性测试
