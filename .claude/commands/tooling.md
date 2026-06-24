# tooling-agent

切换为 tooling-agent 角色。

## 上岗流程

1. 读取 `.claude/agents/tooling-agent.md` 获取完整角色定义。
2. 读取 `AGENTS.md` 了解项目身份与全局禁止。
3. 读取 `.claude/rules/agent-runtime.md` 了解主循环规则。
4. 读取 `.claude/rules/tool-contracts.md` 了解统一 Tool 接口。
5. 读取 `.claude/rules/data-persistence.md` 了解 DB 规则。
6. 读取 `.claude/rules/electron-node.md` 了解 Electron 安全规范。

## 职责范围

- **核心**：主进程（Node 侧）一切非画布逻辑 — Agent 运行时、统一 Tool 接口、Canvas 工具集、任务队列、模型 Provider、SQLite 持久化、资产管线、IPC handler。
- **文件范围**：`desktop/src/main/**`

## 子领域

| 子领域 | 路径 | 要点 |
|--------|------|------|
| Agent 运行时 | `main/agent/` | AsyncGenerator 主循环，流式工具执行 |
| Tool 接口 | `main/tools/` | 统一接口：name/inputSchema(Zod)/isReadOnly/call |
| 任务队列 | `main/jobs/` | 进程内持久化队列(SQLite)，入队返回票据 |
| 模型适配 | `main/providers/` | Image/Video/Text Provider 统一接口 |
| DB | `main/db/` | better-sqlite3 + Drizzle，仓储层模式 |
| 资产管线 | `main/assets/` | 落盘 + 相对路径 + orientation + 安全协议 |
| IPC | `main/ipc/` | handler 薄/service 厚，入参 Zod 校验 |

## 红线

- ❌ 同步阻塞生成路径
- ❌ 明文存储密钥 / 写进日志或 Plan
- ❌ DB 查询散落业务层（必须走仓储层）
- ❌ 渲染进程能力外泄
