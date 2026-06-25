---
description: "Testing rules covering property-based tests, unit tests, IPC integration tests and prohibitions"
globs: "**/*.test.ts,**/*.spec.ts,**/*.test.tsx,**/*.spec.tsx"
---

# 测试规则

## 优先测试不变量（属性测试）
- 用 `fast-check` 对纯函数写属性测试（PBT），优先覆盖：
  - 连接矩阵：穷举 NodeType × NodeType，断言 `canConnect` 等价
  - composed-prompt：任意拓扑下，前后端字节等价
  - sanitizePlan：含可执行代码时，`dropped` 非空且产物干净

## 单元测试
- 纯函数（lib/）100% 单元测试覆盖
- Tool 实现：mock ToolContext，覆盖 isReadOnly/isConcurrencySafe/call 正常路径 + 错误路径

## 集成测试（IPC）
- 关键 IPC handler 用 `electron-mocha` 或 vitest + Electron runner
- 验证：入队 → Worker 消费 → IPC 终态事件 → 前端节点刷新

## 终态事件唯一性（强制）
- 每个 jobId 的 `job.completed` + `job.failed` 合计恰好 1 次

## 禁止
- ❌ `setTimeout` / `setInterval` 在测试里做时序等待（用 fake timers 或事件驱动 await）
- ❌ 测试依赖文件系统绝对路径
