---
inclusion: manual
---

# skill: canvas-node-designer

新增画布节点类型或修改已有节点的数据模型、连接行为、渲染表现或生成动作时使用本 skill。

需要同时保持 shared 契约、连接矩阵、渲染层 UI、主进程 run 映射、Plan 白名单和测试六处一致。

## 必须产出

### 1. shared/nodes.ts 类型更新
- 添加或更新 `NodeType` 字面量。
- 添加或更新节点数据接口。
- 所有导出类型和字段必须有 JSDoc。

### 2. shared/connection-matrix.ts 连接矩阵更新
- 更新上游/下游允许集合。
- 保持该文件是唯一连接真源。
- 更新穷举或属性测试。

### 3. 渲染层节点组件
- 放置于渲染层画布节点结构下（`desktop/src/renderer/canvas/nodes/`）。
- 遵循 orientation 尺寸规范：landscape 16:9，portrait 9:16，square 1:1，`object-fit: contain`。
- 使用 design token，不硬编码颜色或圆角。
- 生成状态事件驱动，不轮询。

### 4. 主进程 run 行为（若节点生成内容）
- 注册 runNode 步骤类型与 provider 映射。
- 入本地队列；永不同步返回生成资产。
- 通过本地资产管线持久化资产。

### 5. Plan 白名单与编排更新
- 将类型加入 Plan 应用白名单。
- 将类型加入 sanitizePlan/orchestrator 允许输出。
- 确认可执行代码/脚本字符串仍被丢弃。

### 6. 测试
- 连接矩阵穷举/PBT 覆盖。
- orientation 和资产终态行为（相关时）。
- 生成节点的终态事件唯一性。

## 检查清单

- [ ] 无连接矩阵副本
- [ ] 生成内容完全异步
- [ ] 导出字段有 JSDoc
- [ ] Plan sanitizer 白名单已更新
- [ ] IPC/服务契约变更已登记到 `docs/api-contracts/`
- [ ] 测试覆盖核心不变量
