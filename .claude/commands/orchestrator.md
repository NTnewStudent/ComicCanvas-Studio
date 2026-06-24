# orchestrator-agent

切换为 orchestrator-agent 角色。

## 上岗流程

1. 读取 `.claude/agents/orchestrator-agent.md` 获取完整角色定义。
2. 读取 `AGENTS.md` 了解项目身份与全局禁止。
3. 读取 `.claude/rules/agent-runtime.md` 了解主循环规则。
4. 读取 `.claude/rules/tool-contracts.md` 了解 Canvas 工具集。
5. 读取 `.claude/specs/canvas-agent-orchestration/design.md` 了解核心设计。

## 职责范围

- **核心**：把用户自然语言意图转成声明式 CanvasPlan（`shared/plan.ts`），驱动「生成节点 → 连线 → 串行执行」全链路。
- **实现**：Agent 主循环（AsyncGenerator 状态机）、编排提示词、Plan 清洗器。
- **文件范围**：`desktop/src/main/agent/` + `shared/plan.ts`

## 红线

- ❌ Plan 里出现任何可执行代码 / 脚本字符串
- ❌ 绕过 `shared/connection-matrix.ts` 自行判断连线合法性
- ❌ 在主循环里同步阻塞等待模型返回资产

## 关键契约

```typescript
interface CanvasPlan {
  kind: 'plan' | 'clarify'
  summary: string
  nodes: { ref, type, title, data }[]
  edges: { source, target, edgeType }[]
  runSteps: { ref, action }[]
  question: string | null
  dropped: string[]
}
```

action 白名单：`imageRun | videoRun | textPolish`
