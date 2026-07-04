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
type ToolListResponse = ToolDescriptor[]
```

`ToolDescriptor` entries SHALL include `inputParametersJsonSchema` (JSON Schema draft 2020-12 snapshot of tool inputs) when registered through ToolRuntime.

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

Tool errors preserve the historical `errorClass/message/retryable` envelope and
may include a stable domain `code` plus safe structured `details` for Agent
recovery:

```ts
interface ToolError {
  errorClass: string
  code?: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}
```

| Error class | Meaning |
| :--- | :--- |
| `tool_not_found` | Tool ID is missing, disabled, or quarantined. |
| `tool_input_invalid` | Input failed schema validation. |
| `tool_permission_denied` | Permission policy denied execution. |
| `tool_runtime_failed` | Tool failed during execution. |
| `plugin_manifest_invalid` | Plugin manifest failed validation. |
| `plugin_quarantined` | Plugin is blocked by safety diagnostics. |

Canvas and Agent-facing tools SHALL use these stable `code` values when the
condition can be classified:

| Code | Retryable | Meaning |
| :--- | :--- | :--- |
| `validation_failed` | false | Generic schema or graph validation failed before mutation. |
| `invalid_edge` | false | A requested connection or edge mutation violates the connection matrix or duplicates an existing edge. |
| `missing_asset` | false | A required asset reference cannot be resolved. |
| `stale_style` | false | A node or project references a style preset that no longer exists. |
| `disabled_style` | true | A node or project references a disabled style preset. |
| `stale_model` | false | A node references a model that is not available in the active gateway catalog. |
| `job_enqueue_failed` | true | The local durable job queue could not persist or enqueue the requested job. |
| `job_failed` | false | A previously enqueued job reached a terminal failed state. |

## Permissions

- Tools declare required permissions and concurrency class at registration.
- Destructive, external-networked, file-writing, or provider-spending tools require explicit permission policy.
- Plugin tools default to `ask` until trusted by the user.
- Sub-agent tool access is capped by parent permissions.

## Tool/UI Equivalence Inventory

Phase A treats every durable manual canvas action as Agent-ready only when it
has a ToolRuntime entry, or when an existing IPC/service contract owns the same
validation and persistence semantics. Transient renderer interaction state may
remain UI-only.

Manual UI and ToolRuntime graph mutations SHALL share
`shared/canvas-actions.ts` for durable create/connect/delete/default-data
semantics. Renderer code may keep local undo stacks, transient selection,
viewport animation, hover state, drag previews, and localized feedback copy.

| Durable action group | Equivalent surface | Status |
| :--- | :--- | :--- |
| graph.query | `canvas.queryGraph` | ToolRuntime |
| graph.validate | `canvas.validateGraph` | ToolRuntime |
| graph.save-load-version | `canvas.saveGraph`, `canvas.loadGraph`, `canvas.listWorkflowVersions`, `canvas.restoreWorkflowVersion` | IPC/service-backed |
| graph.import-export | `canvas.importWorkflow`, `canvas.exportWorkflow` | IPC/service-backed |
| node.create | `canvas.createNode` | ToolRuntime |
| node.duplicate | `canvas.duplicateNode`, `canvas.duplicateSelection` | ToolRuntime |
| node.rename | `canvas.renameNode` | ToolRuntime |
| node.data | `canvas.updateNodeData` | ToolRuntime |
| node.position-batch | `canvas.setNodePosition`, `canvas.layoutSelection` | ToolRuntime |
| node.delete-batch | `canvas.deleteNode`, `canvas.deleteSelection` | ToolRuntime |
| edge.connect | `canvas.connectNodes` | ToolRuntime |
| edge.connect-to-create | `canvas.connectToCreate` | ToolRuntime |
| edge.update-delete | `canvas.updateEdge`, `canvas.deleteEdge` | ToolRuntime |
| selection.extract | `canvas.extractSelection` | ToolRuntime |
| snippet.save-insert | `canvasSnippet.save`, `canvasSnippet.get`, `canvasSnippet.list`, `canvasSnippet.delete` | IPC/service-backed |
| workflow.project-template | `canvas.listWorkflows`, `canvas.importWorkflow`, `canvas.copyWorkflowTemplate` | IPC/service-backed |
| style.resolve | `style.list`, `style.setProjectDefault`, `style.getProjectDefault`, runtime style injection | IPC/service-backed |
| job.recovery | `job.recover`, `job.list`, `canvas.runNode` | IPC/service-backed |
| media.drop | local media classifier plus `asset.import` and `canvas.createNode`/`canvas.updateNodeData` | Service-backed |
| media.image-edit | `ImageEditIntent` through asset/node update services | Service-backed |
| asset.category-reference | `asset.getCategories`, `asset.createCategory`, `asset.updateCategory`, `asset.assignCategory`, `asset.removeCategory`, `asset.trash` | IPC/service-backed |
| viewport.fit-view | none | Transient UI-only |
| hover-menu-drag-preview | none | Transient UI-only |

MJ node/component actions are excluded from Phase A Tool/UI equivalence. The
local runtime keeps `mjImage` as a legacy-known graph type only; MJ add/run,
multi-result UI parity, and URL refresh are out of scope.

## Tests

- Unit: tool registration validates schemas, permissions, and owner.
- Unit: permission policy returns allow, ask, or deny with audit reason.
- Unit: disabled plugin tool cannot be invoked.
- Integration: built-in canvas tools and plugin tools share ToolRuntime.
- Quarantine: invalid plugin manifest keeps the registry on the previous valid snapshot.
