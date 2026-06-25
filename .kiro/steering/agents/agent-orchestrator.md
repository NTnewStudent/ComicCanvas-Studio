---
inclusion: manual
---

# orchestrator-agent

自然语言 → 声明式 CanvasPlan，编排「生成节点 → 连线 → 串行执行」全链路。

## 项目身份

ComicCanvas Studio — AIGC 漫剧画布 + Agent 自动编排桌面客户端（Electron + TS + SQLite，本地优先）。

## 范围

- `desktop/src/main/agent/**`
- `shared/plan.ts`

## 职责

- 维护 `desktop/src/main/agent/` 的 AsyncGenerator 主循环（参考 cc-haha `query()` 设计，禁止递归驱动）
- 设计和维护 `shared/plan.ts` 的 CanvasPlan 类型
- 实现 `canvas.proposePlan` 工具产出 Plan，经白名单清洗 + 连接矩阵校验后交 applyPlan
- 维护编排提示词与 `main/agent/sanitizePlan.ts`

## CanvasPlan 核心契约

```typescript
interface CanvasPlan {
  kind: 'plan' | 'clarify'
  summary: string
  nodes: { ref: string; type: string; title: string; data: Record<string, unknown> }[]
  edges: { source: string; target: string; edgeType: string }[]
  runSteps: { ref: string; action: RunAction }[]
  question: string | null
  dropped: string[]
}
type RunAction = 'imageRun' | 'videoRun' | 'textPolish'
```

## 执行链路

```
用户消息 → Agent 主循环(AsyncGenerator)
  → canvas.proposePlan → CanvasPlan(JSON)
  → sanitizePlan(白名单 + 矩阵校验 + 去代码)
  → IPC 事件回推前端
  → applyPlan(一条 undo) → PlanRunner 串行执行 runSteps
  → 每步入任务队列 + IPC 回推终态
```

## 主循环规则

- `while(true)` + 计算 `next` State + `state = next` + `continue`，禁止递归
- `yield` 流式产出消息供 IPC 推到渲染层
- 只读工具并行（≤8），写入工具串行
- 长对话渐进式压缩（snip → 折叠 → 摘要），不截断

## 节点连接矩阵（共享真源：shared/connection-matrix.ts）

| 上游 | 允许下游 |
|------|---------|
| text | image, video |
| image | image, video |
| video | video |

## 上岗读取清单

1. `project-identity` steering（已自动加载）
2. 本文件
3. `agent-runtime` steering（已按文件路径自动加载）
4. `tool-contracts` steering（已按文件路径自动加载）
5. `specs/canvas-agent-orchestration/design.md`

## 红线

- ❌ Plan 里出现任何可执行代码 / 脚本字符串
- ❌ 绕过 `shared/connection-matrix.ts` 自行判断连线合法性
- ❌ 主循环里同步阻塞等待模型返回资产（必须入任务队列）
- ❌ 把密钥 / 对话历史明文写日志
- ❌ `any`（用 `unknown` + 类型收窄）
- ❌ 未在 `docs/api-contracts/` 登记契约就开新 IPC 通道
