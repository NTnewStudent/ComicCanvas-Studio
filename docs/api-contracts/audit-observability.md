# Audit And Observability Contract

## Owner

- Primary: tooling-agent
- Supporting: pm-agent
- Shared source: `shared/jobs.ts`, `shared/tools.ts`, `shared/agents.ts`, `shared/knowledge.ts`

## Scope

This contract covers audit entries, trace IDs, health checks, safe error envelopes, redaction, repair/quarantine reports, and diagnostic events across jobs, assets, gateways, tools, plugins, agents, skills, and knowledge.

Non-goals:

- No raw provider keys, auth headers, hidden prompts, or absolute paths in logs.
- No stack traces across IPC boundaries.
- No partial registry state exposed as healthy.

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

### Safe Error Envelope

```ts
interface SafeErrorEnvelope {
  errorClass: string
  message: string
  traceId: string
  retryable: boolean
}
```

Rules:

- Permissioned actions SHALL record actor, capability, target, decision, and correlation IDs.
- Errors crossing IPC SHALL use safe envelopes.
- Health checks SHALL cover DB, job runtime, asset protocol, gateway registry, tool registry, agent registry, skill registry, and knowledge index.

## Errors

| Error class | Meaning |
| :--- | :--- |
| `audit_query_invalid` | Audit filter failed validation. |
| `health_component_unknown` | Requested health component is not registered. |
| `diagnostic_unavailable` | Diagnostics cannot be produced safely. |
| `redaction_failed` | A log/export payload could not be redacted and was blocked. |

## Permissions

- Audit and health views require diagnostics permission.
- Debug exports require explicit user action.
- Redaction runs before logs, traces, LTM records, and debug exports are persisted or displayed.
- Repair/quarantine actions are write operations and may require confirmation.

## Tests

- Unit: redaction removes API keys, auth headers, hidden prompts, and absolute paths.
- Unit: safe error envelopes contain stable class and no stack trace.
- Integration: tool/agent/job actions share trace IDs.
- Integration: registry reload failure reports degraded health without exposing partial entries.
- Audit: permission decisions are persisted with actor, capability, target, and decision.
