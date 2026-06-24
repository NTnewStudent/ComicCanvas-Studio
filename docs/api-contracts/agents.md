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
interface AgentListResponse {
  agents: AgentDefinition[]
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

## Errors

| Error class | Meaning |
| :--- | :--- |
| `agent_not_found` | Agent ID does not exist or is disabled. |
| `agent_policy_invalid` | Agent configuration violates policy schema. |
| `agent_context_failed` | Context Pack could not be built safely. |
| `agent_permission_denied` | Tool, skill, or spawn permission was denied. |
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
- Property: sub-agent permission intersection never expands access.
- Integration: `agent.run` returns job/run ticket and streams terminal event.
- Injection: executable CanvasPlan strings are dropped or rejected before apply.
