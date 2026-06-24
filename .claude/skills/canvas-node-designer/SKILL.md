---
name: canvas-node-designer
description: 设计/新增一种画布节点类型。产出节点数据模型、连接矩阵更新、UI 渲染约定、生成动作映射与测试点。用于 canvas-agent 与 tooling-agent 协作新增节点。
---

# canvas-node-designer

新增或修改一种画布节点时，确保跨「共享契约 / 渲染层 / 主进程 / 连接矩阵 / 测试」五处一致落地。

## 何时使用

要新增节点类型（如新的生成节点、合成节点）或调整既有节点的连接/数据模型时。

## 产出清单

1. **共享类型**（`shared/nodes.ts`）：新增 `NodeType` 字面量 + `XxxNodeData` 接口（JSDoc 注明每个字段意图）。
2. **连接矩阵**（`shared/connection-matrix.ts`）：在 `NODE_CONNECTION_MATRIX` 增/改该类型的上下游允许集合；同步更新 PBT 穷举用例。
3. **渲染组件**（`renderer/canvas/nodes/XxxNode.tsx`）：遵守画幅自适应（orientation）、`object-fit: contain`、宽度锚定、占位骨架、零轮询。
4. **主进程动作**（如属生成节点）：在 Canvas 工具集/任务队列登记 `runNode` 的 stepType 与 provider 映射；resolveasset 走资产管线。
5. **Plan 白名单**：把新类型加入 `applyPlan` 的节点白名单与 orchestrator 的可产出类型，并在清洗器允许。
6. **测试**：连接矩阵等价 PBT、（生成节点）orientation 完整性、终态事件唯一。

## 检查项

- [ ] 连接矩阵前后端共享、无本地副本
- [ ] 生成类节点全量异步，无同步资产返回
- [ ] 数据模型字段全部 JSDoc
- [ ] 新增类型已纳入 Plan 清洗白名单
- [ ] 配套测试覆盖核心不变量
