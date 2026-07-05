# Audit And Observability Contract

## Owner

- Primary: tooling-agent
- Supporting: pm-agent
- Shared source: `shared/jobs.ts`, `shared/tools.ts`, `shared/agents.ts`, `shared/knowledge.ts`

## Scope

本契约覆盖 job、资产、网关、工具、插件、agent、skill 和知识库中的审计条目、
追踪 ID、健康检查、安全错误信封、红化、修复/隔离报告，以及诊断事件。

Non-goals（非目标）：

- 日志中不包含原始服务商密钥、认证头、隐藏 prompt 或绝对路径。
- IPC 边界之间不传递堆栈追踪。
- 不将部分注册表状态暴露为健康状态。

## Request/Response Contracts

### `audit.list`

Request:

```ts
interface AuditListRequest {
  traceId?: string
  actorId?: string
  capability?: string
  limit: number
}
```

Response:

```ts
interface AuditListResponse {
  entries: AuditEntry[]
}
```

### `health.check`

Request:

```ts
interface HealthCheckRequest {
  components?: HealthComponent[]
}
```

Response:

```ts
interface HealthCheckReport {
  status: 'ok' | 'degraded' | 'failed'
  checks: HealthCheckResult[]
  checkedAt: number
}
```

### Safe Error Envelope（安全错误信封）

```ts
interface SafeErrorEnvelope {
  errorClass: string
  message: string
  traceId: string
  retryable: boolean
}
```

Rules（规则）：

- 受权限控制的操作必须（SHALL）记录 actor、capability、target、decision，以及关联 ID。
- 跨越 IPC 的错误必须（SHALL）使用安全信封。
- 健康检查必须（SHALL）覆盖 DB、job 运行时、资产协议、网关注册表、工具注册表、
  agent 注册表、skill 注册表，以及知识库索引。

## Errors

| Error class | Meaning |
| :--- | :--- |
| `audit_query_invalid` | 审计过滤条件未通过校验。 |
| `health_component_unknown` | 请求的健康检查组件未注册。 |
| `diagnostic_unavailable` | 无法安全地生成诊断信息。 |
| `redaction_failed` | 日志/导出的 payload 无法被红化，因此被阻止。 |

## Permissions

- 审计和健康视图需要诊断权限。
- 调试导出需要用户明确的操作。
- 红化必须在日志、追踪记录、LTM 记录和调试导出被持久化或展示之前执行。
- 修复/隔离操作属于写操作，可能需要确认。

## Tests

- Unit：红化会移除 API key、认证头、隐藏 prompt 和绝对路径。
- Unit：安全错误信封包含稳定的类别且不含堆栈追踪。
- Integration：工具/agent/job 操作共享追踪 ID。
- Integration：注册表重载失败时报告降级状态，且不暴露部分条目。
- Audit：权限决策会连同 actor、capability、target 和 decision 一起被持久化。
