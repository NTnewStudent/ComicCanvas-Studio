# Skills Contract

## Owner

- Primary: orchestrator-agent
- Supporting: tooling-agent, pm-agent
- Shared source: `shared/skills.ts`, `shared/tools.ts`, `shared/agents.ts`

## Scope

This contract covers SkillRegistry discovery, metadata validation, lazy loading, invocation, versioning, hot reload, permissions, and invocation trace records for built-in, user-defined, and plugin skills.

Non-goals:

- No automatic loading of every skill reference into every agent context.
- No skill permission bypass around ToolRuntime.
- No project product spec under `.codex/` or `.claude/`.

## Request/Response Contracts

### `skill.list`

Request:

```ts
interface SkillListRequest {
  includeDisabled?: boolean
  source?: SkillSource
}
```

Response:

```ts
interface SkillListResponse {
  skills: SkillDefinition[]
}
```

### `skill.invoke`

Internal service request:

```ts
interface SkillInvokeRequest {
  skillId: string
  agentRunId: string
  input: Record<string, unknown>
  requiredReferences?: string[]
}
```

Response:

```ts
interface SkillInvocationRecord {
  id: string
  skillId: string
  version: string
  agentRunId: string
  loadedReferences: SkillReference[]
  status: 'completed' | 'failed'
}
```

Rules:

- Registry list responses expose metadata only.
- Invocation loads only required instruction files and references.
- Skills declare required tools and permissions before use.
- Failed reload keeps previous valid skill snapshot.

## Errors

| Error class | Meaning |
| :--- | :--- |
| `skill_not_found` | Skill ID is missing or disabled. |
| `skill_metadata_invalid` | Metadata failed validation. |
| `skill_reference_missing` | Required instruction/reference file is missing. |
| `skill_permission_denied` | Required tool/permission exceeds agent policy. |
| `skill_reload_failed` | Reload failed; previous valid snapshot remains active. |

## Permissions

- Skill invocation permissions are capped by invoking agent policy.
- A skill cannot enable tools that the agent cannot use.
- User/plugin skills default to disabled or `ask` until trusted.
- Skill references may include local files only from approved skill roots.

## Tests

- Unit: metadata validation for built-in, user, and plugin skills.
- Unit: lazy loading loads selected references only.
- Unit: permission overreach fails before tool execution.
- Integration: reload failure keeps previous valid skill list.
- Trace: invocation record stores skill ID, version, agent run ID, and loaded references.
