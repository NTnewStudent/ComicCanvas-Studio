# Canvas Plan Contract

## Owner

- Primary: pm-agent
- Implementation: orchestrator-agent, canvas-agent, tooling-agent
- Shared source: `shared/plan.ts`, `shared/nodes.ts`, `shared/connection-matrix.ts`

## Scope

This contract covers declarative CanvasPlan creation, sanitization, application, and run-step execution for text, image, and video comic-drama workflows. CanvasPlan is data only. It cannot contain executable code, scripts, dynamic imports, shell commands, or provider-specific payloads.

Non-goals:

- No direct model invocation from plan application.
- No synchronous generated asset return.
- No renderer-only copy of node, edge, or run-step rules.

## Request/Response Contracts

### `canvas.chatSend`

Request:

```ts
interface CanvasChatSendRequest {
  message: string
  agentId?: string
}
```

Response:

```ts
interface CanvasChatSendResponse {
  runId: string
  jobId: string
  messageId: string
  status: 'pending'
}
```

Rules:

- `canvas.chatSend` SHALL enqueue an `agent.run` job and return within one second without returning a CanvasPlan synchronously.
- The response SHALL include `runId` so renderer UI can recover the Agent trace summary through `agent.getRun`.
- The orchestration job SHALL run the orchestrator AsyncGenerator in the main process and emit progress/terminal job events through the local job runtime.
- If the terminal `AgentResponse` is `canvasPlan`, the produced CanvasPlan SHALL be retrievable only after async completion through `canvas.chatGetPlan`.
- If the terminal `AgentResponse` is `answer` or `clarification`, the main process SHALL emit `agent.responseReady`; no CanvasPlan SHALL be stored for that message.

### `agent.responseReady`

Event:

```ts
interface AgentResponseReadyEvent {
  runId: string
  messageId: string
  response:
    | { type: 'answer'; summary: string; text: string; dropped: string[] }
    | { type: 'clarification'; summary: string; question: string; missing: string[]; dropped: string[] }
}
```

Rules:

- Renderer chat surfaces SHALL render `answer.text` or `clarification.question` directly.
- Renderer chat surfaces SHALL NOT call `canvas.chatGetPlan` for `agent.responseReady`.
- Ordinary questions such as greetings, date/time questions, coding help, or general knowledge answers SHALL use this event path unless the user explicitly asks to create or run a canvas workflow.

### `canvas.chatGetPlan`

Request:

```ts
interface CanvasChatGetPlanRequest {
  messageId: string
}
```

Response:

```ts
type CanvasChatGetPlanResponse = CanvasPlan
```

Rules:

- `canvas.chatGetPlan` SHALL return the latest stored plan for the message ID after the agent job completes.
- If a plan is unavailable because the Agent produced an `answer` or `clarification`, callers SHALL use `agent.responseReady` / `agent.getRun` instead of polling `canvas.chatGetPlan`.
- If a plan is unavailable because the plan job failed, the handler SHALL return a stable safe error envelope; it SHALL NOT expose internal prompts or provider details.

### `canvas.applyPlan`

Request:

```ts
interface CanvasApplyPlanRequest {
  plan: CanvasPlan
  mode: 'draft' | 'apply'
  sourceAgentRunId?: string
}
```

Response:

```ts
interface CanvasApplyPlanResponse {
  graphVersion: string
  appliedNodeIds: string[]
  appliedEdgeIds: string[]
  dropped: string[]
}
```

Rules:

- The main or renderer plan applicator SHALL sanitize the plan before graph mutation.
- Every Agent-created node type SHALL be one of `text`, `image`, `video`, `imageConfigV2`, `videoConfigV2`, `character`, `scene`, `audio`, `videoCompose`, `superResolution`, or `muxAudioVideo`.
- `image` and `video` are media reference nodes; generation run steps SHALL target `imageConfigV2` and `videoConfigV2`.
- `mjImage` is legacy-known for graph compatibility but unavailable for Agent-created plans and run steps.
- Every edge SHALL be revalidated through `shared/connection-matrix.ts`.
- Every run step SHALL use the `RunAction` whitelist from `shared/plan.ts`.
- Sub-agent draft graph merge SHALL sanitize child-produced graph JSON, strip executable strings from node data, revalidate edges through `shared/connection-matrix.ts`, and write a new immutable workflow version only after parent approval.

### `canvas.runPlan`

Request:

```ts
interface CanvasRunPlanRequest {
  graphVersion: string
  runSteps: PlanRunStep[]
}
```

Response:

```ts
interface CanvasRunPlanResponse {
  jobIds: string[]
  status: 'queued'
}
```

Rules:

- `canvas.runPlan` SHALL enqueue local jobs and return job IDs only.
- A failed run step SHALL short-circuit later steps while preserving their pending state for inspection.

### `canvas.saveGraph`

Request:

```ts
interface CanvasSaveGraphRequest {
  projectId: string
  graph: CanvasGraphSnapshot
}

interface CanvasGraphSnapshot {
  nodes: Array<{
    id: string
    type: 'text' | 'image' | 'video'
    position: { x: number; y: number }
    data: CanvasNodeData
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    data: CanvasEdgeData
  }>
  viewport: { x: number; y: number; zoom: number }
}
```

Response:

```ts
interface CanvasSaveGraphResponse {
  graphVersion: string
}
```

Rules:

- `canvas.saveGraph` SHALL persist a new immutable workflow version through the workflow repository.
- The save transaction SHALL include the graph version insert and workflow `updatedAt` refresh.
- Every saved edge SHALL be revalidated through `shared/connection-matrix.ts`; missing-node and illegal-type edges SHALL be dropped from the persisted version.
- The persisted graph SHALL include node positions and viewport so app restart/load can restore the visible canvas layout.

### `canvas.loadGraph`

Request:

```ts
interface CanvasLoadGraphRequest {
  projectId: string
}
```

Response:

```ts
type CanvasLoadGraphResponse = CanvasGraphSnapshot
```

Rules:

- `canvas.loadGraph` SHALL return the latest workflow version for the requested project.
- If no graph exists, it SHALL return an empty graph with `viewport: { x: 0, y: 0, zoom: 1 }`.
- Loaded graph responses SHALL contain only safe graph JSON and SHALL NOT include generated bytes, provider URLs, or absolute filesystem paths.

### Workflow Project Summaries

Response item for `canvas.listWorkflows`:

```ts
interface WorkflowSummaryView {
  id: string
  name: string
  scope: 'draft' | 'template'
  published: boolean
  description: string | null
  visibility: 'private' | 'public'
  ownerId: string
  ownedByCurrentUser: boolean
  tags: string[]
  thumbnailUrl: string | null
  updatedAt: string
  nodeCount: number
  edgeCount: number
  coverAssetId: string | null
  latestRunStatus: 'idle' | 'pending' | 'running' | 'done' | 'error'
  defaultStylePresetId: string | null
  archived: boolean
  versionChecksum: string
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
  }
}
```

Rules:

- Workflow summaries SHALL be derived from the latest persisted workflow graph version.
- `canvas.listWorkflows` SHALL return private draft workflows. `canvas.listWorkflowTemplates` defaults to published public templates and MAY accept `{ scope: 'my' | 'public' | 'all' }` for local management surfaces.
- Workflow templates SHALL use the same summary shape as projects with `scope: 'template'`; public template list rows SHALL have `visibility: 'public'` and `published: true`, while local owner/admin views MAY include unpublished private template drafts.
- Template summaries SHALL include description, visibility, owner, owned-by-current-user, tags, and thumbnail URL metadata for hjwall parity cards.
- `edgeCount` SHALL count the latest graph edges before UI filtering so project cards can show authored graph scale.
- `coverAssetId` SHALL use the explicit workflow cover when present; otherwise it MAY fall back to the first asset-bearing node.
- `latestRunStatus` SHALL summarize latest node run state with this priority: running, pending, error, done, idle.
- `versionChecksum` SHALL be a deterministic SHA-256 checksum of the latest graph JSON.
- `warningSummary` SHALL expose unsupported node and invalid edge counts for lenient save/debug UI; strict run validation remains a separate gate.

### Workflow Import/Export Safety

`canvas.exportWorkflow` response:

```ts
interface WorkflowExportJson {
  schemaVersion: 1
  name: string
  graph: CanvasGraphSnapshot
}
```

`canvas.importWorkflow` request:

```ts
interface WorkflowImportRequest {
  json: string
  name?: string
}
```

Response:

```ts
interface WorkflowImportResponse {
  workflowId: string
  graphVersion: string
  dropped: string[]
}
```

Rules:

- Workflow import JSON SHALL require `schemaVersion: 1`. Unknown, missing, or future schema versions SHALL return `invalid_workflow_json`.
- Workflow import JSON SHALL be parsed and validated before persistence. Malformed JSON, missing graph objects, non-array nodes/edges, or invalid viewport payloads SHALL return `invalid_workflow_json`.
- Import and export payloads SHALL NOT contain API keys, bearer tokens, secret access keys, provider credentials, generated bytes, provider URLs, or absolute filesystem paths.
- Import SHALL reject unsafe payloads with `unsafe_workflow_json` when secret-like keys/values or absolute paths are present anywhere in the JSON tree.
- Import SHALL sanitize graph nodes, edges, and viewport through the shared graph persistence rules before writing a workflow version.
- Import SHALL preserve compatible graph content and report incompatible or dropped records in `dropped` so the renderer can show warnings.
- Imported workflows SHALL always be created as private drafts with `scope: 'draft'` and `published: false`, even when the source JSON came from a template export.
- Renderer import flows SHALL navigate to the imported draft after success and keep dropped warnings visible until the user dismisses or leaves the flow.

### Workflow Version History and Restore

`canvas.listWorkflowVersions` request:

```ts
interface WorkflowVersionListRequest {
  workflowId: string
  limit?: number
}
```

Response item:

```ts
interface WorkflowVersionSummaryView {
  id: string
  createdAt: string
  createdBy: string
  nodeCount: number
  edgeCount: number
  checksum: string
  restoreSourceVersionId: string | null
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
  }
}
```

`canvas.restoreWorkflowVersion` request:

```ts
interface WorkflowVersionRestoreRequest {
  workflowId: string
  versionId: string
}
```

Response:

```ts
interface WorkflowVersionRestoreResponse {
  workflowId: string
  graphVersion: string
  restoredFromVersionId: string
  checksum: string
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
  }
}
```

Rules:

- Workflow graph versions SHALL be immutable. Restoring a historical version SHALL create a new latest graph version and SHALL NOT update or delete the source version.
- Version history SHALL be ordered newest first and capped by the requested `limit`, clamped to a safe maximum.
- Version debug metadata SHALL include created time, creator, node count, edge count, deterministic SHA-256 checksum, warning summary, and `restoreSourceVersionId` when the version was created by restore.
- Version summaries SHALL describe the persisted safe graph. If save/import sanitization dropped unsupported nodes or invalid edges before persistence, the persisted version warning summary MAY be zero.
- Restore responses SHALL include the new graph version ID, source version ID, checksum, and warning summary so renderer UI and future Agent tools can reference the exact restore path.
- Renderer project UI SHALL expose version/debug metadata and restore actions as engineering-complete controls. Product acceptance remains manual desktop review.

### Graph Validation Modes

`canvas.validateGraph` request:

```ts
interface WorkflowGraphValidationRequest {
  workflowId?: string
  graph?: CanvasGraphSnapshot
  mode?: 'lenient' | 'strict'
}
```

Response:

```ts
interface WorkflowGraphValidationResponse {
  mode: 'lenient' | 'strict'
  valid: boolean
  issues: {
    code: string
    severity: 'warning' | 'error'
    message: string
    nodeId?: string
    edgeId?: string
    refId?: string
  }[]
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
    unavailableModels: number
    unavailableStyles: number
    unavailableAssets: number
  }
}
```

Rules:

- Draft save SHALL use lenient validation. Unsupported nodes, invalid edges, unavailable models, unavailable style presets, disabled style presets, and unavailable assets SHALL be recorded as warnings and SHALL NOT block persistence.
- Runtime actions including `canvas.runNode`, explicit strict validation, and future template publish SHALL use strict validation. Strict issues SHALL be returned as blocking errors and SHALL NOT enqueue provider jobs.
- `canvas.saveGraph` SHALL persist lenient validation warnings with the immutable graph version. Version list/debug UI SHALL read the persisted warning summary so historical diagnostics remain stable.
- Model availability validation SHALL use an injected model registry when available. If no model registry is configured, validation SHALL NOT invent model failures.
- Asset availability validation SHALL use the asset repository and treat failed, trashed, tombstoned, or missing assets as unavailable.
- Style availability validation SHALL use the style repository, including disabled presets, and SHALL treat missing or disabled styles as unavailable for strict runtime.

## Workflow Node Definitions

`shared/workflow-node-definitions.ts` is the shared node capability source for
manual UI, ToolRuntime, and future Agent planning.

Rules:

- Each `NodeType` SHALL have exactly one definition with label, category,
  capabilities, allowed inputs, allowed outputs, addable flag, connect-create
  flag, runnable flag, and optional run action.
- `allowedInputs` and `allowedOutputs` SHALL be derived from
  `shared/connection-matrix.ts`; renderer code SHALL NOT maintain a separate
  connection table for add/connect-create filtering.
- Canvas add menus, command palette add commands, and connect-to-create menus
  SHALL filter through the shared definitions.
- Feature flags MAY disable node types at runtime. Disabled node types SHALL
  remain known to the shared definition service but SHALL be marked not addable,
  not connect-createable, and not runnable with an unavailable reason.
- ToolRuntime `canvas.runNode` SHALL reject nodes whose definition is not
  runnable before enqueuing a job.
- Gateway model catalogs SHALL provide text/image/video/tool model lists,
  capability flags, and `availableModelIds` for unavailable-model validation.
- MJ remains a known node type only for legacy graph compatibility in local
  Phase A; it SHALL NOT be addable, connect-createable, or runnable.
- Text polish retains the CanvasPlan `textPolish` action vocabulary and SHALL
  enqueue `canvas.polishText` jobs through the same `canvas.runNode` surface.
  Terminal text results SHALL update the text node content and polish status.

## Workflow Runtime Snapshot

`shared/workflow-graph-compiler.ts` compiles a target node into a deterministic
runtime snapshot used by run handlers and future Agent/tool execution.

Snapshot fields:

```ts
interface WorkflowRuntimeSnapshot {
  nodeId: string
  nodeType: NodeType
  runAction: RunAction | null
  modelKey: string | null
  stylePresetId: string | null
  prompt: string
  promptParts: {
    nodeId: string
    nodeType: NodeType
    label: string
    text: string
    source: 'upstream' | 'self'
    order: number
    edgeId?: string
  }[]
  references: {
    nodeId: string
    nodeType: NodeType
    assetId: string
    mediaType: 'image' | 'video' | 'audio'
    role: 'first_frame' | 'last_frame' | 'reference' | 'audio' | 'video'
    order: number
    edgeId?: string
  }[]
  parameters: Record<string, unknown>
  negativePrompt: string | null
}
```

Rules:

- Prompt parts SHALL be deterministic: explicit `promptOrder` wins over edge
  creation time, and edge creation time breaks ties.
- Character and scene nodes SHALL contribute semantic prompt lines and image
  references when an asset is selected.
- Image references SHALL preserve `imageOrder` and `imageRole` so first frame,
  last frame, and reference assets can bind to gateway inputs.
- Style resolution SHALL use node override before project default. The final
  `prompt` SHALL include style prompt-before/after or legacy style text through
  the shared style composer.
- `negativePrompt` SHALL also appear in `parameters.negativePrompt` when the
  effective style provides one.
- `canvas.runNode` image/video payloads SHALL use this snapshot for prompt,
  model key, parameters, and graph-derived references.

### `canvas.copyWorkflowTemplate`

Request:

```ts
interface WorkflowTemplateCopyRequest {
  templateId: string
  name?: string
}
```

Response:

```ts
interface WorkflowTemplateCopyResponse {
  workflowId: string
  graphVersion: string
  name: string
}
```

Rules:

- The source workflow SHALL be `scope: 'template'`, `published: true`, and not deleted.
- The source workflow SHALL also be public-visible for the default copy path.
- Copying SHALL create a new `scope: 'draft'`, `published: false` workflow with a copied latest graph version.
- The copied draft SHALL preserve safe asset references and cover selection by ID only; it SHALL NOT copy provider secrets, absolute paths, generated bytes, or temporary URLs.
- The copied draft SHALL preserve safe template tags and thumbnail metadata, mark itself private, and record a local owner ID.
- If the template is missing, unpublished, or has no graph version, the handler SHALL return a safe non-retryable error envelope.

### `canvas.publishWorkflowTemplate`

Request:

```ts
interface WorkflowTemplatePublishRequest {
  workflowId: string
  visibility?: 'private' | 'public'
}
```

Response: `WorkflowSummaryView` or safe error envelope.

Rules:

- Publishing SHALL run strict graph validation against the latest workflow graph version before mutating template visibility/published state.
- Strict validation failures SHALL return `workflow_template_validation_failed` with issues and SHALL NOT publish the template.
- Unsupported legacy nodes, including MJ-related nodes, SHALL remain blocking validation errors for local Phase A template publish.

### `canvasSnippet.list` / `canvasSnippet.get`

Request:

```ts
interface CanvasSnippetListRequest {
  scope?: 'my' | 'public' | 'all'
}
interface CanvasSnippetGetRequest {
  snippetId: string
}
```

Response:

```ts
interface CanvasSnippetView {
  id: string
  schemaVersion: 1
  name: string
  description?: string
  scope: 'my' | 'public'
  ownerId: string
  ownedByCurrentUser: boolean
  tags?: string[]
  thumbnailUrl?: string
  nodeCount: number
  edgeCount: number
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
  createdAt: number
  updatedAt: number
}
```

Rules:

- `canvasSnippet.list` SHALL support all, my, and public scopes and SHALL return sanitized metadata plus graph fragments.
- `canvasSnippet.get` SHALL return the detail fragment used for insertion and SHALL return a safe not-found envelope when missing.
- Snippet save SHALL sanitize invalid edges and persist scope, owner, tags, description, thumbnail URL, node count, and edge count.
- Snippet delete SHALL only delete snippets owned by the current local user; public or other-user snippets SHALL return a non-retryable permission envelope.
- Renderer snippet insertion SHALL remap node and edge IDs, preserve internal topology, and write one undoable canvas snapshot.

## Errors

| Error class | Meaning |
| :--- | :--- |
| `plan_invalid_json` | The payload is not a valid CanvasPlan object. |
| `plan_executable_content` | Sanitization found executable code or script-like content. |
| `plan_node_type_unsupported` | A node type is outside the shared whitelist. |
| `plan_edge_rejected` | `canConnect(source,target)` rejected an edge. |
| `plan_graph_version_conflict` | The target graph changed before apply. |
| `graph_invalid_json` | The payload is not a valid CanvasGraphSnapshot object. |
| `graph_project_missing` | The save/load request does not identify a project. |
| `graph_persist_failed` | The workflow repository could not persist the graph version atomically. |

IPC responses SHALL expose stable error classes and safe messages only.

## Permissions

- Applying a plan is a graph-writing action and requires the active user/session to have canvas write permission.
- Running a plan may spend provider credits and SHALL pass through job/gateway permission policy.
- Destructive plan actions are not allowed in M0/M1. Later delete actions SHALL require explicit `ask` policy.
- Saving a graph is a graph-writing action and requires canvas write permission.
- Loading a graph is a graph-reading action and requires project read permission.

## Tests

- Unit: sanitize illegal node types, illegal edges, executable strings, and invalid run actions.
- Property: generated edge pairs match `shared/connection-matrix.ts`.
- Integration: `canvas.applyPlan` mutates graph only after sanitization.
- Integration: `applySubAgentResult` does not persist child draft graph changes before parent merge and drops executable node data plus illegal edges during merge.
- Integration: `canvas.runPlan` returns job tickets and never returns asset bytes, URLs, absolute paths, or provider temporary URLs.
- Integration: `canvas.saveGraph` then handler recreation then `canvas.loadGraph` returns latest nodes, legal edges, positions, and viewport.
- Repository: workflow version persistence runs through repository APIs and keeps graph JSON inside `workflow_versions`.
- Repository: workflow summaries expose cover, edge count, latest run status, default style, archived state, checksum, and warning counts from the latest graph version.
- Repository/UI: published workflow templates list separately from drafts and copy into private draft workflows with a new graph version.
