# Skills Contract

## Owner

- Primary: orchestrator-agent
- Supporting: tooling-agent, pm-agent
- Shared source: `shared/skills.ts`, `shared/tools.ts`, `shared/agents.ts`

## Scope

本契约覆盖 SkillRegistry 的发现、元数据校验、懒加载、调用、版本管理、
热重载、权限，以及内置、用户自定义与插件 skill 的调用追踪记录。

Non-goals（非目标）：

- 不将每个 skill 引用自动加载进每个 agent context。
- 不绕过 ToolRuntime 进行 skill 权限绕行。
- `.codex/` 或 `.claude/` 下不放置项目产品规格文档。

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

Internal service request（内部服务请求）：

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

Rules（规则）：

- Registry 的 list 响应只暴露元数据。
- 调用时只加载所需的指令文件和引用。
- Skill 在使用前需声明所需的工具与权限。
- 重载失败时保留此前有效的 skill 快照。

## Errors

| Error class | Meaning |
| :--- | :--- |
| `skill_not_found` | Skill ID 不存在或已被禁用。 |
| `skill_metadata_invalid` | 元数据未通过校验。 |
| `skill_reference_missing` | 所需的指令/引用文件缺失。 |
| `skill_permission_denied` | 所需的工具/权限超出 agent 策略。 |
| `skill_reload_failed` | 重载失败；此前有效的快照保持生效。 |

## Permissions

- Skill 调用权限受调用方 agent 策略上限约束。
- Skill 不能启用 agent 本身无法使用的工具。
- 用户/插件 skill 默认为禁用或 `ask`，直到被信任。
- Skill 引用只能包含来自已批准 skill 根目录的本地文件。

## Tests

- Unit：内置、用户和插件 skill 的元数据校验。
- Unit：懒加载只加载被选中的引用。
- Unit：权限越界在工具执行前失败。
- Integration：重载失败时保留此前有效的 skill 列表。
- Trace：调用记录存储 skill ID、版本、agent run ID，以及已加载的引用。
