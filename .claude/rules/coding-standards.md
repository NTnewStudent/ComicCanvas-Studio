---
alwaysApply: true
description: 通用编码规范（TS / 架构 / 注解）
---

# 通用编码规范

## 语言与运行时

- **Node.js 20+**，**TypeScript 5+ 严格模式**（`strict: true`）。
- 渲染层与主进程共享类型走 `shared/`，不重复定义。
- 跨进程通信只走 IPC 契约（`shared/ipc.ts`），渲染层禁止直接 `import` 主进程模块。

## 命名规范

| 类型 | 规则 | 示例 |
| :--- | :--- | :--- |
| React 组件 | `PascalCase.tsx` | `ImageGenerationNode.tsx` |
| Hook | `useXxx.ts` | `useCanvasChat.ts` |
| Store | `useXxxStore.ts` | `useCanvasStore.ts` |
| Tool 实现 | `XxxTool.ts` | `CreateNodeTool.ts` |
| 类型/接口 | `PascalCase` | `interface CanvasPlan` |
| 常量 | `UPPER_SNAKE_CASE` | `NODE_CONNECTION_MATRIX` |
| 函数/变量 | `camelCase` | `composeFinalPrompt` |

## 架构规范

- **DB 访问只走仓储层**（`desktop/src/main/db/repositories/`），业务层不直接写 SQL / Drizzle 查询散落各处。
- **IPC handler 薄、service 厚**：handler 只做校验 + 转调 service。
- **工具（Tool）自描述**：每个 Tool 实现统一接口（schema / 权限 / 执行 / 渲染），见 `tool-contracts.md`。
- **纯函数放 `lib/`**：连接矩阵校验、prompt 拼接、布局算法等必须是无副作用纯函数，便于属性测试。

## 代码注解（强制）

- 所有导出符号必须有 JSDoc：意图、参数、返回值、异常。
- 所有 IPC / 服务方法标注契约锚点：`@see docs/api-contracts/...`。
- 所有异常 throw/catch 必须有行内注释说明原因。
- 严禁 `catch (e) {}` 吞异常（至少记录日志或上报）。

## 禁止事项

- ❌ `any`（用 `unknown` + 收窄）。
- ❌ 渲染层直连主进程模块 / Node API（必须经 preload 暴露的 IPC）。
- ❌ 硬编码色值 / 字号 / 圆角（用 design token）。
- ❌ 在 `lib/` 依赖框架运行时或 Node API（保持纯函数、可测）。
- ❌ 绕过 `shared/` 与 `docs/api-contracts/` 各端私自定义契约。
