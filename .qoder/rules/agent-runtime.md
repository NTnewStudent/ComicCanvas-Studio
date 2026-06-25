---
description: "Agent runtime rules covering main loop, tool orchestration, context management and CanvasPlan output"
globs: "desktop/src/main/agent/**"
---

# Agent 运行时规则

## 主循环
- AsyncGenerator 状态机：`while(true)` + 计算 `next` State + `state = next` + `continue`，**禁止递归**
- State 至少含：`messages` / `toolUseContext` / `turnCount` / `transition`
- `yield` 流式产出消息（供 IPC 推到渲染层对话区）

## 工具编排
- 模型产 `tool_use` 即可在流式中开始执行
- 只读工具并行（≤8），写入/破坏性工具串行
- 执行管道：查找 → Zod 解析 → validateInput → PreToolUse 钩子 → 权限检查 → 执行 → PostToolUse 钩子

## 上下文管理
- 长对话渐进式压缩（snip → 折叠 → 摘要），不简单截断
- 系统提示词：静态可缓存区 + 动态区（环境/记忆/可用 skill 列表）

## 故障恢复
- 输出 token 超限升级、prompt 过长压缩重试、模型失败降级——均通过修改 State 实现，不用异常穿透

## 编排产物
- 产出 `CanvasPlan`（`shared/plan.ts`），纯声明式 JSON
- 经 `sanitizePlan`（白名单 + 矩阵 + 去代码）才允许进入 applyPlan

## 红线
- ❌ 主循环里同步阻塞等待资产生成
- ❌ 把密钥 / 完整对话历史明文写日志
