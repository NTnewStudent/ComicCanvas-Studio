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
- Built-in agent IDs SHALL be editable by saving a persisted override with `source: 'builtin'`; code-defined built-in defaults remain the fallback when no override exists.
- `name`, `instructions`, `maxTurns`, tool policy, skill policy, gateway policy, context policy, trigger policy, and permission policy SHALL be validated before persistence.

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

Terminal response:

```ts
type AgentResponse =
  | { type: 'answer'; summary: string; text: string; dropped: string[] }
  | { type: 'clarification'; summary: string; question: string; missing: string[]; dropped: string[] }
  | { type: 'canvasPlan'; plan: CanvasPlan }
```

Events:

```ts
interface AgentResponseReadyEvent {
  runId: string
  messageId: string
  response: Exclude<AgentResponse, { type: 'canvasPlan' }>
}

interface AgentToolStartedEvent {
  runId: string
  messageId: string
  callId: string
  toolId: string
  inputSummary: string
}

interface AgentToolCompletedEvent {
  runId: string
  messageId: string
  callId: string
  toolId: string
  invocationId: string
  status: 'completed' | 'failed' | 'denied'
  summary: string
}

interface AgentPermissionRequiredEvent {
  runId: string
  messageId: string
  callId: string
  toolId: string
  reason: string
  requiredPermissions: ToolPermission[]
}
```

Rules:

- `agent.toolStarted` SHALL be emitted immediately before ToolRuntime executes an agent-requested tool call.
- `agent.toolCompleted` SHALL be emitted after ToolRuntime returns for that call, including denied and failed outcomes.
- `agent.permissionRequired` SHALL be emitted when a tool returns `decision: 'ask'` and the loop pauses for `agent.approveTool`.
- Tool lifecycle events SHALL include `runId` and `messageId` so renderer timelines can correlate them with chat turns.

- `answer` is for ordinary conversation, coding/help questions, time/date questions, and general knowledge responses that do not require graph mutation.
- `clarification` is for greetings, low-signal requests, and ambiguous tasks where the Agent needs more information before selecting tools or creating nodes.
- `canvasPlan` is reserved for explicit canvas graph/node/workflow tasks and is delivered through the canvas plan path.
- Non-`canvasPlan` terminal responses SHALL emit `agent.responseReady` and SHALL NOT store a CanvasPlan for `canvas.chatGetPlan`.

### `agent.approveTool`

Request:

```ts
interface AgentToolApprovalInput {
  runId: string
  callId: string
  approvedBy: string
}
```

Response:

```ts
type AgentToolApprovalResponse = AgentRunTicket
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
  status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded' | 'approval_required'
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
    status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded' | 'approval_required'
    error?: string
  }
  error?: string
}
```

Rules:

- Built-in agents SHALL include `general-purpose`, `canvas-orchestrator`, compatibility `orchestrator`, canvas, tooling, and PM roles.
- `general-purpose` SHALL be the default conversation entry for canvas chat. Its description and instructions SHALL focus on understanding, requirement decomposition, ambiguity clarification, and delegation to local capabilities.
- `canvas-orchestrator` SHALL own explicit canvas graph/node/workflow CanvasPlan generation. The legacy `orchestrator` ID SHALL remain a compatibility alias.
- Agent runs SHALL analyze user intent before graph mutation or CanvasPlan output. Greetings, small talk, and low-signal requests SHALL return an `AgentResponse` clarification instead of creating graph nodes.
- Intent analysis SHALL expose a visible progress summary with classification, complexity, execution mode, recommended agent, and local capability check. This is an auditable summary, not raw chain-of-thought.
- `agent.getRun` trace metadata SHALL persist the structured `intentAnalysis` and `capabilityCheck` so UI surfaces can recover the Agent's visible reasoning summary after reload or job completion.
- Simple explicit node-creation requests MAY use `executionMode: 'direct'` to produce a minimal CanvasPlan. Direct mode SHALL NOT bypass ToolRuntime, plan-apply gates, or user approval policy.
- Requests to generate images or videos SHALL use generation config nodes (`imageConfigV2` / `videoConfigV2`) plus run steps; reference `image` and `video` nodes SHALL NOT be treated as generation nodes.
- Built-in agents SHALL be editable through settings and persisted as overrides, but SHALL NOT be deletable.
- Agent runs are asynchronous and return tickets.
- Agent runs SHALL resolve the selected AgentDefinition before loop execution and SHALL reject disabled agents or triggers not allowed by the agent trigger policy.
- Agent context loops SHALL initialize from the resolved AgentDefinition, trigger policy, user message, and current ToolRuntime descriptors.
- Agent context loops SHALL filter tools by `allowedTools`, enabled state, and permission kinds before model/planner execution.
- Agent-requested tool calls SHALL execute only through ToolRuntime; tool observations SHALL be appended to loop messages before the next model/planner turn.
- Agent-requested tools that return a permission `ask` decision SHALL pause the loop with `agent_tool_approval_required`, preserve the pending tool call, input, reason, and required permissions, and SHALL NOT execute the tool until `agent.approveTool` resumes it.
- `agent.approveTool` SHALL enqueue a new `agent.run` job, execute only the preserved pending tool call through ToolRuntime, append its observation to the paused loop, and continue model/planner turns until a sanitized CanvasPlan or terminal error is produced.
- Agent context loops SHALL compact older assistant/tool messages deterministically against the agent context token budget while preserving the system prompt, current user request, and a compacted summary boundary.
- Agent loops that exceed `maxTurns` SHALL terminate with structured metadata including `errorClass`, `turnsUsed`, dropped tools, compaction summary, and omitted message count.
- Gateway-backed Agent models SHALL return JSON shaped as `toolCalls` or `AgentResponse`; invalid JSON SHALL be converted into a safe `clarification` response with dropped audit metadata instead of mutating the graph.
- OpenAI-compatible gateways SHALL use native `tools` / `tool_calls` when `resolveAgentToolProtocol` selects `native`; stub and unknown gateways SHALL keep the JSON `toolCalls` protocol.
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
| `agent_tool_approval_required` | Tool execution is paused until the user approves the pending tool call. |
| `agent_builtin_readonly` | Built-in agent definition cannot be deleted. |
| `agent_depth_exceeded` | Spawn depth exceeded configured maximum. |
| `agent_max_turns_exceeded` | Agent loop reached the configured turn limit before producing a plan. |
| `agent_run_failed` | Agent loop failed with safe error metadata. |

## Permissions

- Custom agent creation/editing requires settings write permission.
- Built-in agent editing requires settings write permission and stores an override row instead of mutating code defaults.
- `allowedTools`, `allowedSkills`, gateway policy, context policy, trigger policy, and permission policy define maximum capability.
- Sub-agent effective permissions SHALL be less than or equal to parent permissions.

## Tests

- Unit: built-in agent registry contains required agent IDs.
- Unit: custom agent policy validation rejects overbroad or malformed settings.
- Integration: custom agent settings create, edit, list, and delete through typed IPC/preload APIs.
- Integration: built-in agent settings save as persisted overrides and reject delete.
- UI: agent form validates required fields, edits built-ins, and prevents built-in delete actions.
- Unit: Agent context loop filters tools by policy, rejects disallowed triggers, executes ToolRuntime calls, feeds tool observations into the next turn, compacts over-budget context, and emits structured max-turns terminal metadata.
- Property: sub-agent permission intersection never expands access.
- Integration: sub-agent draft graph writes do not change the persisted workflow graph before parent merge.
- Integration: `agent.run` returns job/run ticket and streams terminal event.
- Injection: executable CanvasPlan strings are dropped or rejected before apply.
