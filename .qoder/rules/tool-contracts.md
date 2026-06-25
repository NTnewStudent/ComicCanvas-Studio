---
description: "Tool interface contracts, canvas tool set, execution rules and prohibitions"
globs: "desktop/src/main/tools/**"
---

# Tool 接口契约

## 统一接口

```typescript
interface Tool<I, O> {
  name: string
  description: string
  inputSchema: ZodSchema<I>
  isReadOnly(input: I): boolean
  isConcurrencySafe(input: I): boolean
  validateInput?(input: I, ctx: ToolContext): ValidationResult
  checkPermissions?(input: I, ctx: ToolContext): PermissionResult // allow|ask|deny
  call(input: I, ctx: ToolContext): AsyncGenerator<ToolProgress, O>
  renderToolUseMessage(input: I): string
}
```

## Canvas 工具集

| 工具 | 只读 | 作用 |
|------|------|------|
| canvas.queryGraph | ✓ | 读取画布图快照 |
| canvas.proposePlan | ✓ | 产出声明式 CanvasPlan（不直接改画布）|
| canvas.createNode | ✗ | 创建节点（类型白名单）|
| canvas.connectNodes | ✗ | 连线（canConnect 校验）|
| canvas.updateNodeData | ✗ | 更新节点数据 |
| canvas.runNode | ✗ | 入任务队列 + 返票据 |

## 规则

- 写类工具串行执行；只读工具并行（≤8）
- `connectNodes` 必须消费 `shared/connection-matrix.ts`
- `runNode` 只入队 + 回票据，不同步等待结果
- 破坏性工具（删节点/清空）默认 `ask` 权限
- 所有 service 方法与 IPC handler 需要 JSDoc 和 `@see docs/api-contracts/...` 锚点
- 所有 throw/catch 需要行内注释说明原因

## 红线

- ❌ 工具 `call` 返回里夹带可执行代码
- ❌ 工具内直连渲染进程（只能经 IPC）
- ❌ `runNode` 同步阻塞等待生成结果
