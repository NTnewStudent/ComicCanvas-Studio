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
- Every node type SHALL be one of `text`, `image`, or `video`.
- Every edge SHALL be revalidated through `shared/connection-matrix.ts`.
- Every run step SHALL use the `RunAction` whitelist from `shared/plan.ts`.

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

## Errors

| Error class | Meaning |
| :--- | :--- |
| `plan_invalid_json` | The payload is not a valid CanvasPlan object. |
| `plan_executable_content` | Sanitization found executable code or script-like content. |
| `plan_node_type_unsupported` | A node type is outside the shared whitelist. |
| `plan_edge_rejected` | `canConnect(source,target)` rejected an edge. |
| `plan_graph_version_conflict` | The target graph changed before apply. |

IPC responses SHALL expose stable error classes and safe messages only.

## Permissions

- Applying a plan is a graph-writing action and requires the active user/session to have canvas write permission.
- Running a plan may spend provider credits and SHALL pass through job/gateway permission policy.
- Destructive plan actions are not allowed in M0/M1. Later delete actions SHALL require explicit `ask` policy.

## Tests

- Unit: sanitize illegal node types, illegal edges, executable strings, and invalid run actions.
- Property: generated edge pairs match `shared/connection-matrix.ts`.
- Integration: `canvas.applyPlan` mutates graph only after sanitization.
- Integration: `canvas.runPlan` returns job tickets and never returns asset bytes, URLs, absolute paths, or provider temporary URLs.
