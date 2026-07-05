# No-Demo Acceptance Review

日期：2026-06-25

## 占位符扫描

检查范围：

- `specs/`
- `docs/api-contracts/`
- `docs/architecture/`
- `docs/progress/`
- `.codex/`
- `.agents/`
- `AGENTS.md`

M1 之前所需的结果：

- 基础契约中没有未解决的占位符文本。
- `.codex/` 或 `.claude/` 下没有权威产品需求文档链接。
- 工具专属目录仅保留为运行时/配置层。

最终 M0 验证时要运行的命令：

```bash
rg -n "TBD|TODO|FIXME|placeholder|\\.claude/specs|\\.codex/specs" specs docs/api-contracts docs/architecture docs/progress .codex .agents AGENTS.md
```

## No-Demo Acceptance Review

基础层现已具备实现前所需的最低工业级契约：

| 模块 | 契约 | 负责方 | 失败行为 | 测试策略 | 恢复/安全 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| CanvasPlan | `docs/api-contracts/canvas-plan.md`, `shared/plan.ts` | orchestrator-agent/canvas-agent | 拒绝无效 JSON、可执行内容、非法连线 | sanitize 测试、连接测试 | plan apply 重新校验 |
| Jobs | `docs/api-contracts/jobs.md`, `shared/jobs.ts` | tooling-agent | 稳定的错误分类、重试资格 | 状态机与终态唯一性测试 | 启动时恢复 |
| Assets | `docs/api-contracts/assets-files.md`, `shared/assets.ts` | tooling-agent | 元数据/路径/引用错误 | orientation、路径越界、引用测试 | 安全协议、墓碑标记 |
| Gateway | `docs/api-contracts/gateway-providers.md`, `shared/gateway.ts` | tooling-agent | 能力/供应商/超时错误 | 归一化与 mock provider 测试 | 密钥加密、红化 |
| Tools/Plugins | `docs/api-contracts/tools-plugins.md`, `shared/tools.ts` | tooling-agent | 权限/schema/隔离错误 | 注册表、权限、隔离测试 | ToolRuntime 边界 |
| Agents | `docs/api-contracts/agents.md`, `shared/agents.ts` | orchestrator-agent | 策略/上下文/运行错误 | 权限单调性与运行测试 | trace 元数据、子 agent 限制 |
| Skills | `docs/api-contracts/skills.md`, `shared/skills.ts` | orchestrator-agent | 元数据/引用/权限错误 | 惰性加载与重新加载测试 | 上一份有效快照 |
| Knowledge/RAG | `docs/api-contracts/knowledge-context.md`, `shared/knowledge.ts` | tooling-agent | 范围/索引/上下文错误 | 范围、删除、引用测试 | 限定范围检索与红化 |
| Audit/Observability | `docs/api-contracts/audit-observability.md`, `shared/ipc.ts` | tooling-agent/pm-agent | 安全的错误包装 | 红化与健康检查测试 | trace ID、健康检查 |

## M0 退出决策

只有以下条件全部满足，M1 才能开始：

- `bun run ci` 通过。
- `python ltm/bin/ltm.py selftest` 通过。
- `docs/api-contracts/` 包含所需的拆分契约。
- `shared/` 包含针对 jobs、assets、gateway、tools、agents、skills、knowledge 和 IPC 的专项契约。
- `docs/architecture/core-platform-implementation-readiness.md` 存在，且覆盖 DB schema、仓储层、迁移、运行时计划、设置面、内置工具、skills 与 agents。
- `docs/progress/backlog.md` 仅将有证据支撑的 REQ 标记为完成。

当前决策：

- 该分支中最终的 M0 验证命令通过后，M1 即可开始。
