# Agents Contract

## Owner

- Primary: orchestrator-agent
- Supporting: tooling-agent, pm-agent
- Shared source: `shared/agents.ts`, `shared/tools.ts`, `shared/skills.ts`, `shared/knowledge.ts`

## Scope

This contract covers AgentRegistry, built-in agents, custom agents, agent runs, context policy, tool/skill permissions, CanvasPlan output, sub-agent spawning, progress events, and trace metadata.

Non-goals:

- No hidden write path around tools.
- No sub-agent permission expansion.
- No executable CanvasPlan output.
- No persisted graph writes from child draft tools before parent-controlled merge.

## Request/Response Contracts

### `agent.list`

Request:

```ts
interface AgentListRequest {
  includeDisabled?: boolean
}
```

Response:

```ts
type AgentListResponse = AgentDefinition[]
```

### `agent.save`

Request:

```ts
type AgentSaveRequest = AgentDefinition
```

Response:

```ts
type AgentSaveResponse = AgentDefinition
```

Rules:

- Saved custom agents SHALL be persisted with `source: 'user'`.
- Built-in agent IDs SHALL return `agent_builtin_readonly` and SHALL NOT mutate persisted rows.
- `name`, `instructions`, `maxTurns`, tool policy, skill policy, gateway policy, context policy, and permission policy SHALL be validated before persistence.

### `agent.delete`

Request:

```ts
interface AgentDeleteRequest {
  agentId: string
}
```

Response:

```ts
interface AgentDeleteResponse {
  agentId: string
  deleted: true
}
```

### `agent.run`

Request:

```ts
interface AgentRunRequest {
  agentId: string
  message: string
  contextPolicyOverride?: Partial<AgentContextPolicy>
}
```

Response:

```ts
interface AgentRunTicket {
  runId: string
  jobId: string
  status: 'pending'
}
```

### `agent.spawn`

Request:

```ts
interface SpawnSubAgentInput {
  spec: SubAgentSpec
  depth?: number
}
```

Response:

```ts
interface SpawnSubAgentResult {
  output: string
  status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded'
  turnsUsed: number
  droppedTools: string[]
  droppedSkills: string[]
  trace: {
    runId: string
    parentRunId: string
    parentTraceId: string
    depth: number
    startedAt: number
    completedAt: number
    requestedTools: string[]
    effectiveTools: string[]
    requestedSkills: string[]
    effectiveSkills: string[]
    droppedTools: string[]
    droppedSkills: string[]
    status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded'
    error?: string
  }
  error?: string
}
```

Rules:

- Built-in agents SHALL include orchestrator, canvas, tooling, and PM roles.
- Agent runs are asynchronous and return tickets.
- Agent-produced CanvasPlan SHALL be sanitized before application.
- Child permissions SHALL be parent permissions intersected with target/requested policy.
- Sub-agent spawn results SHALL include an independent trace with run ID, parent run/trace IDs, effective permissions, dropped permissions, terminal status, and timings.
- Sub-agent canvas tools SHALL run against an isolated draft graph copy; `applySubAgentResult` SHALL sanitize that draft and persist a new graph version only when the parent explicitly merges it.

## Errors

| Error class | Meaning |
| :--- | :--- |
| `agent_not_found` | Agent ID does not exist or is disabled. |
| `agent_policy_invalid` | Agent configuration violates policy schema. |
| `agent_context_failed` | Context Pack could not be built safely. |
| `agent_permission_denied` | Tool, skill, or spawn permission was denied. |
| `agent_builtin_readonly` | Built-in agent definition cannot be edited or deleted. |
| `agent_depth_exceeded` | Spawn depth exceeded configured maximum. |
| `agent_run_failed` | Agent loop failed with safe error metadata. |

## Permissions

- Custom agent creation/editing requires settings write permission.
- Built-in agents are read-only unless a migration explicitly updates them.
- `allowedTools`, `allowedSkills`, gateway policy, and context policy define maximum capability.
- Sub-agent effective permissions SHALL be less than or equal to parent permissions.

## Tests

- Unit: built-in agent registry contains required agent IDs.
- Unit: custom agent policy validation rejects overbroad or malformed settings.
- Integration: custom agent settings create, edit, list, and delete through typed IPC/preload APIs.
- UI: custom agent form validates required fields and prevents built-in delete/edit actions.
- Property: sub-agent permission intersection never expands access.
- Integration: sub-agent draft graph writes do not change the persisted workflow graph before parent merge.
- Integration: `agent.run` returns job/run ticket and streams terminal event.
- Injection: executable CanvasPlan strings are dropped or rejected before apply.
