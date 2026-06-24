# Tools And Plugins Contract

## Owner

- Primary: tooling-agent
- Supporting: orchestrator-agent, pm-agent
- Shared source: `shared/tools.ts`, `shared/agents.ts`

## Scope

This contract covers ToolRuntime, ToolRegistry, built-in tools, plugin-provided tools, permission decisions, progress streaming, concurrency classes, audit records, plugin validation, and quarantine.

Non-goals:

- No direct tool-to-renderer calls.
- No plugin marketplace in the first implementation.
- No tool execution outside ToolRuntime.

## Request/Response Contracts

### `tool.list`

Request:

```ts
interface ToolListRequest {
  includeDisabled?: boolean
  ownerKind?: 'builtin' | 'plugin'
}
```

Response:

```ts
interface ToolListResponse {
  tools: ToolDescriptor[]
}
```

### `tool.invoke`

Request:

```ts
interface ToolInvokeRequest {
  toolId: string
  input: unknown
  actor: ToolActor
  traceId: string
}
```

Response:

```ts
interface ToolInvokeAccepted {
  invocationId: string
  status: 'accepted'
}
```

Events:

```ts
type ToolEvent =
  | { channel: 'tool.progress'; invocationId: string; progress: ToolProgress }
  | { channel: 'tool.completed'; invocationId: string; output: unknown }
  | { channel: 'tool.failed'; invocationId: string; error: ToolError }
```

Rules:

- Built-in and plugin tools SHALL use the same ToolRuntime path.
- Tool input and output SHALL be schema-validated.
- Read-only tools may run concurrently; writes follow serial or exclusive policy.
- Plugin load failure SHALL quarantine the plugin/tool and expose diagnostics.

## Errors

| Error class | Meaning |
| :--- | :--- |
| `tool_not_found` | Tool ID is missing, disabled, or quarantined. |
| `tool_input_invalid` | Input failed schema validation. |
| `tool_permission_denied` | Permission policy denied execution. |
| `tool_runtime_failed` | Tool failed during execution. |
| `plugin_manifest_invalid` | Plugin manifest failed validation. |
| `plugin_quarantined` | Plugin is blocked by safety diagnostics. |

## Permissions

- Tools declare required permissions and concurrency class at registration.
- Destructive, external-networked, file-writing, or provider-spending tools require explicit permission policy.
- Plugin tools default to `ask` until trusted by the user.
- Sub-agent tool access is capped by parent permissions.

## Tests

- Unit: tool registration validates schemas, permissions, and owner.
- Unit: permission policy returns allow, ask, or deny with audit reason.
- Unit: disabled plugin tool cannot be invoked.
- Integration: built-in canvas tools and plugin tools share ToolRuntime.
- Quarantine: invalid plugin manifest keeps the registry on the previous valid snapshot.
