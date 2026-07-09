# Local Agent Platform Run Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local Agent Platform milestone: durable run events, typed artifacts, persisted approvals, deterministic projection, and orchestrator integration without changing the existing canvas IPC compatibility surface.

**Architecture:** Add an append-only Agent Run Spine beside the existing `agent_runs` trace table, then project that spine into chat blocks, artifact view models, task rows, and inspector state. Keep current `agent.delta`, `agent.toolStarted`, `agent.permissionRequired`, `agent.responseReady`, and `canvas.planReady` IPC events working while SQLite becomes the recoverable source of truth.

**Tech Stack:** Electron main process, TypeScript strict, better-sqlite3, shared TypeScript contracts, existing `shared/chat-blocks.ts` reducer, Bun, Vitest, existing in-process job queue.

**Spec:** `specs/local-agent-platform/requirements.md`, `specs/local-agent-platform/design.md`, `specs/local-agent-platform/tasks.md`

---

## File Structure

- Create `shared/agent-run-events.ts`: shared event, artifact, permission grant, child task, snapshot, and inspector contracts.
- Create `shared/agent-run-projector.ts`: pure projection from persisted run snapshot to `ChatTurn`, artifacts, task tree rows, and inspector model.
- Modify `shared/agents.ts`: extend `AgentToolApprovalInput` with approval scope and extend `agent.getRun`-compatible response types.
- Modify `shared/ipc.ts`: keep existing channels and widen `agent.getRun` payload shape only through optional fields.
- Modify `docs/api-contracts/agents.md`: register Agent Run Spine, projection, artifacts, grants, and local-only boundaries before handler changes.
- Create `desktop/src/main/db/migrations/0015_agent_run_spine.sql`: run metadata columns plus `agent_run_events`, `agent_artifacts`, `agent_permission_grants`, and `child_agent_tasks`.
- Modify `desktop/src/main/db/migrate.ts`: append migration `0015_agent_run_spine`.
- Modify `desktop/src/main/db/schema.ts`: add new table names and Drizzle table declarations.
- Create `desktop/src/main/db/repositories/agent-run-event.repo.ts`: append/list event repository with per-run sequence ordering.
- Create `desktop/src/main/db/repositories/agent-artifact.repo.ts`: create/list artifact repository.
- Create `desktop/src/main/db/repositories/agent-permission-grant.repo.ts`: save/find active local approval grants.
- Create `desktop/src/main/db/repositories/child-agent-task.repo.ts`: persist child task summaries for projection even before full built-in team UI lands.
- Modify `desktop/src/main/db/repositories/agent-run.repo.ts`: persist the new run metadata and paused state fields while preserving old callers.
- Create `desktop/src/main/agent/run-spine.ts`: service that creates runs, appends events, saves artifacts/grants/tasks, updates run status, and returns snapshots.
- Create `desktop/src/main/agent/permission-service.ts`: local permission grant matcher used by ToolRuntime policy.
- Modify `desktop/src/main/tools/runtime.ts`: move reusable approval storage behind an injectable grant store so SQLite grants become the source of truth for agent runs.
- Modify `desktop/src/main/agent/orchestrator.ts`: append spine events during chat send, job start, progress, tool lifecycle, approvals, artifacts, completion, and failure.
- Modify `desktop/src/main/runtime.ts`: instantiate new repositories, run spine, and permission service; wire them into orchestrator and ToolRuntime.
- Modify `desktop/src/main/ipc/agent.handler.ts`: return projected snapshot from `agent.getRun` when available.
- Test `tests/agent-run-contracts.test.ts`: shared contract vocabulary and local-only guardrails.
- Test `tests/agent-run-spine-db.test.ts`: migration, schema tables, repositories, and run snapshot persistence.
- Test `tests/agent-run-projector.test.ts`: replay/live projection determinism.
- Test `tests/agent-permission-grants.test.ts`: once/run/session matching and destructive ask-first behavior.
- Modify `tests/orchestrator-runtime.test.ts`: run spine integration, approval pause/resume persistence, and terminal artifact projection.
- Modify `tests/db-schema.test.ts`, `tests/shared-contracts.test.ts`, `tests/api-contract-docs.test.ts`, and `tests/main-runtime-wiring.test.ts`: guard the new contract and runtime wiring.

## Event Vocabulary

The first milestone uses this exact event vocabulary:

```ts
export const AGENT_RUN_EVENT_TYPES = [
  'run.created',
  'run.started',
  'intent.analyzed',
  'context.built',
  'progress',
  'model.delta',
  'tool.started',
  'tool.completed',
  'permission.requested',
  'permission.resolved',
  'artifact.created',
  'plan.ready',
  'response.ready',
  'run.completed',
  'run.failed'
] as const
```

`child.task.created`, `child.task.progress`, and `child.task.completed` are represented in the first milestone by `child_agent_tasks` rows and inspector/task-tree projection. Their active execution wiring is a separate workbench-team milestone, so this plan does not change `agent.spawnChild` behavior beyond snapshot visibility.

---

### Task 1: Shared Contracts And API Docs

**Files:**
- Create: `shared/agent-run-events.ts`
- Create: `tests/agent-run-contracts.test.ts`
- Modify: `shared/agents.ts`
- Modify: `shared/ipc.ts`
- Modify: `docs/api-contracts/agents.md`
- Modify: `tests/shared-contracts.test.ts`
- Modify: `tests/api-contract-docs.test.ts`

- [ ] **Step 1.1: Write failing shared contract tests**

Create `tests/agent-run-contracts.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AGENT_ARTIFACT_KINDS,
  AGENT_RUN_EVENT_TYPES,
  type AgentRunEventRecord,
  type LocalPermissionGrant
} from '../shared/agent-run-events'

describe('Agent Run Spine shared contracts', () => {
  it('defines the first milestone event vocabulary in stable order', () => {
    expect(AGENT_RUN_EVENT_TYPES).toEqual([
      'run.created',
      'run.started',
      'intent.analyzed',
      'context.built',
      'progress',
      'model.delta',
      'tool.started',
      'tool.completed',
      'permission.requested',
      'permission.resolved',
      'artifact.created',
      'plan.ready',
      'response.ready',
      'run.completed',
      'run.failed'
    ])
  })

  it('defines typed artifact kinds used by the workbench projector', () => {
    expect(AGENT_ARTIFACT_KINDS).toEqual([
      'answer',
      'clarification',
      'canvasPlan',
      'canvasPatchDraft',
      'draftGraph',
      'assetReference',
      'searchSummary',
      'memorySuggestion',
      'diagnosticReport',
      'runExport'
    ])
  })

  it('keeps first milestone contracts local-only', () => {
    const sampleEvent: AgentRunEventRecord = {
      id: 'event-1',
      runId: 'run-1',
      sequence: 1,
      type: 'run.created',
      payload: {
        threadId: 'thread-local',
        workflowId: 'workflow-local',
        agentId: 'general-purpose',
        trigger: 'canvasChat',
        messageId: 'message-1',
        policyProfileId: 'local-default'
      },
      createdAt: 1
    }
    const sampleGrant: LocalPermissionGrant = {
      id: 'grant-1',
      toolId: 'canvas.createNode',
      permissionKinds: ['canvas.write'],
      workflowId: 'default',
      scope: 'run',
      runId: 'run-1',
      approvedByLabel: 'user-local',
      createdAt: 2
    }
    const serialized = JSON.stringify({ sampleEvent, sampleGrant })

    expect(serialized).not.toMatch(/organizationId|teamId|roleBinding|cloudWorkspaceId|policyServerUrl|teamMemory/u)
  })

  it('documents the Agent Run Spine API contract before handler changes', () => {
    const content = readFileSync(join('docs', 'api-contracts', 'agents.md'), 'utf8')

    expect(content).toContain('### Agent Run Spine')
    expect(content).toContain('AgentRunEvent')
    expect(content).toContain('LocalPermissionGrant')
    expect(content).toContain('RunProjector')
    expect(content).toContain('本地专业版不包含 organization/team/cloud policy server')
  })
})
```

Update `tests/shared-contracts.test.ts` so `requiredSharedContracts` includes:

```ts
'agent-run-events.ts',
'agent-run-projector.ts'
```

- [ ] **Step 1.2: Run tests to verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-contracts.test.ts tests/shared-contracts.test.ts tests/api-contract-docs.test.ts
```

Expected: FAIL because `shared/agent-run-events.ts`, `shared/agent-run-projector.ts`, and the new docs section do not exist.

- [ ] **Step 1.3: Implement shared contracts**

Create `shared/agent-run-events.ts` with these exported constants, unions, and interfaces:

```ts
/**
 * Durable Agent Run Spine contracts shared by Electron main and renderer.
 * @see docs/api-contracts/agents.md
 */

import type { AgentResponse, AgentRunStatus, AgentTriggerKind } from './agents'
import type { ChatTurn } from './chat-blocks'
import type { CanvasPlan } from './plan'
import type { ToolPermission, ToolPermissionKind } from './tools'

export const AGENT_RUN_EVENT_TYPES = [
  'run.created',
  'run.started',
  'intent.analyzed',
  'context.built',
  'progress',
  'model.delta',
  'tool.started',
  'tool.completed',
  'permission.requested',
  'permission.resolved',
  'artifact.created',
  'plan.ready',
  'response.ready',
  'run.completed',
  'run.failed'
] as const

export type AgentRunEventType = typeof AGENT_RUN_EVENT_TYPES[number]

export const AGENT_ARTIFACT_KINDS = [
  'answer',
  'clarification',
  'canvasPlan',
  'canvasPatchDraft',
  'draftGraph',
  'assetReference',
  'searchSummary',
  'memorySuggestion',
  'diagnosticReport',
  'runExport'
] as const

export type AgentArtifactKind = typeof AGENT_ARTIFACT_KINDS[number]
export type PermissionGrantScope = 'once' | 'run' | 'session'

export interface AgentRunCreatedPayload {
  threadId: string
  workflowId: string
  agentId: string
  trigger: AgentTriggerKind
  messageId: string
  jobId?: string
  policyProfileId: string
  gatewayId?: string
  modelId?: string
}

export type AgentRunEventPayload =
  | AgentRunCreatedPayload
  | { status: AgentRunStatus; jobId?: string }
  | { message: string; progress: number }
  | { delta: string }
  | { callId: string; toolId: string; inputSummary?: string }
  | { callId: string; toolId: string; invocationId?: string; status: 'completed' | 'failed' | 'denied'; summary: string }
  | { callId: string; toolId: string; reason: string; requiredPermissions: ToolPermission[]; inputSummary?: string }
  | { callId: string; approvedByLabel: string; scope: PermissionGrantScope }
  | { artifactId: string; kind: AgentArtifactKind; title: string; summary: string }
  | { messageId: string; planId: string }
  | { messageId: string; response: AgentResponse }
  | { errorClass: string; message: string; retryable: boolean; checkpoint?: string }
  | Record<string, unknown>

export interface AgentRunEventRecord {
  id: string
  runId: string
  sequence: number
  type: AgentRunEventType
  payload: AgentRunEventPayload
  createdAt: number
}

export interface AgentArtifactRecord {
  id: string
  runId: string
  kind: AgentArtifactKind
  title: string
  summary: string
  payload: AgentResponse | CanvasPlan | Record<string, unknown>
  createdAt: number
}

export interface LocalPermissionGrant {
  id: string
  toolId: string
  permissionKinds: ToolPermissionKind[]
  workflowId: string
  scope: PermissionGrantScope
  runId?: string
  expiresAt?: number
  approvedByLabel: string
  createdAt: number
  revokedAt?: number
}

export interface ChildAgentTaskRecord {
  id: string
  parentRunId: string
  roleId: string
  inputSummary: string
  effectiveTools: string[]
  status: AgentRunStatus
  outputSummary?: string
  artifactIds: string[]
  errorClass?: string
  createdAt: number
  updatedAt: number
}

export interface AgentRunRecordSnapshot {
  id: string
  threadId: string
  workflowId: string
  agentId: string
  status: AgentRunStatus
  trigger: AgentTriggerKind
  messageId: string
  jobId?: string
  contextPackId?: string
  policyProfileId: string
  gatewayId?: string
  modelId?: string
  pausedState?: Record<string, unknown>
  usage?: Record<string, unknown>
  trace: Record<string, unknown>
  errorClass?: string
  createdAt: number
  updatedAt: number
}

export interface AgentRunSnapshot {
  run: AgentRunRecordSnapshot
  events: AgentRunEventRecord[]
  artifacts: AgentArtifactRecord[]
  permissionGrants: LocalPermissionGrant[]
  childTasks: ChildAgentTaskRecord[]
}

export interface AgentTaskTreeRow {
  id: string
  parentRunId: string
  roleId: string
  status: AgentRunStatus
  summary: string
  artifactIds: string[]
  errorClass?: string
}

export interface RunInspectorModel {
  runId: string
  status: AgentRunStatus
  agentId: string
  workflowId: string
  trigger: AgentTriggerKind
  modelLabel: string
  latestEventType?: AgentRunEventType
  tools: Array<{ callId: string; toolId: string; status: string; summary?: string }>
  permissions: Array<{ callId: string; toolId: string; reason: string; resolved: boolean }>
  artifacts: Array<{ id: string; kind: AgentArtifactKind; title: string; summary: string }>
  childTasks: AgentTaskTreeRow[]
  error?: { errorClass: string; message: string; retryable: boolean }
}

export interface AgentRunProjection {
  chatTurn: ChatTurn
  taskTree: AgentTaskTreeRow[]
  inspector: RunInspectorModel
  artifacts: AgentArtifactRecord[]
}
```

Modify `shared/agents.ts`:

```ts
import type { AgentRunProjection, AgentRunSnapshot, PermissionGrantScope } from './agent-run-events'
```

Extend `AgentToolApprovalInput`:

```ts
export interface AgentToolApprovalInput {
  runId: string
  callId: string
  approvedBy: string
  scope?: PermissionGrantScope
}
```

Add:

```ts
export interface AgentRunViewResponse {
  runId: string
  status: AgentRunStatus
  trace?: Record<string, unknown>
  snapshot?: AgentRunSnapshot
  projection?: AgentRunProjection
}
```

Modify `shared/ipc.ts` only where `agent.getRun` response is typed so the optional `snapshot` and `projection` fields are allowed without removing existing `runId/status/trace` consumers.

- [ ] **Step 1.4: Update API docs**

In `docs/api-contracts/agents.md`, add a section after the `agent.run` terminal response block:

```md
### Agent Run Spine

`AgentRunEvent` is the durable source of truth for local Agent runs. Existing live IPC events remain delivery channels; replay and `agent.getRun` SHALL reconstruct from persisted `agent_runs`, `agent_run_events`, `agent_artifacts`, `agent_permission_grants`, and `child_agent_tasks`.

```ts
type AgentRunEventType =
  | 'run.created'
  | 'run.started'
  | 'intent.analyzed'
  | 'context.built'
  | 'progress'
  | 'model.delta'
  | 'tool.started'
  | 'tool.completed'
  | 'permission.requested'
  | 'permission.resolved'
  | 'artifact.created'
  | 'plan.ready'
  | 'response.ready'
  | 'run.completed'
  | 'run.failed'

interface LocalPermissionGrant {
  id: string
  toolId: string
  permissionKinds: ToolPermissionKind[]
  workflowId: string
  scope: 'once' | 'run' | 'session'
  runId?: string
  expiresAt?: number
  approvedByLabel: string
  createdAt: number
}
```

Rules:

- `AgentRunEvent` rows SHALL be append-only and strictly ordered by `(run_id, sequence)`.
- `RunProjector` SHALL be pure and deterministic for live events and persisted replay.
- `agent.getRun` MAY include `snapshot` and `projection` fields. Older consumers SHALL continue using `runId`, `status`, and `trace`.
- 本地专业版不包含 organization/team/cloud policy server、team memory、cloud sync、multi-user workspace 或 centralized admin policy。
```

- [ ] **Step 1.5: Run tests to verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-contracts.test.ts tests/shared-contracts.test.ts tests/api-contract-docs.test.ts
```

Expected: PASS.

- [ ] **Step 1.6: Commit contracts**

Run:

```bash
git add shared/agent-run-events.ts shared/agents.ts shared/ipc.ts docs/api-contracts/agents.md tests/agent-run-contracts.test.ts tests/shared-contracts.test.ts tests/api-contract-docs.test.ts
git commit -m "feat: add local agent run spine contracts"
```

---

### Task 2: SQLite Migration And Schema Declarations

**Files:**
- Create: `desktop/src/main/db/migrations/0015_agent_run_spine.sql`
- Modify: `desktop/src/main/db/migrate.ts`
- Modify: `desktop/src/main/db/schema.ts`
- Modify: `tests/db-schema.test.ts`
- Create: `tests/agent-run-spine-db.test.ts`

- [ ] **Step 2.1: Write failing migration tests**

In `tests/db-schema.test.ts`, extend `schemaTables` expectation with:

```ts
'agent_run_events',
'agent_artifacts',
'agent_permission_grants',
'child_agent_tasks'
```

Create `tests/agent-run-spine-db.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'

function withTempDb<T>(run: (db: ReturnType<typeof openDatabaseAtPath>) => T): T {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-run-spine-db-'))
  const dbPath = join(tempDir, 'run-spine.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    return run(db)
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('Agent Run Spine SQLite schema', () => {
  it('applies migration 0015 and creates run spine tables', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-run-spine-migration-'))
    const dbPath = join(tempDir, 'migration.sqlite')

    try {
      const result = migrateDatabaseAtPath(dbPath)

      expect(result.report.applied).toContain('0015_agent_run_spine')
      expect(result.tableNames).toEqual(expect.arrayContaining([
        'agent_run_events',
        'agent_artifacts',
        'agent_permission_grants',
        'child_agent_tasks'
      ]))
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('adds local run metadata columns to agent_runs', () => {
    withTempDb((db) => {
      const columns = db.prepare('PRAGMA table_info(agent_runs)').all() as Array<{ name: string }>
      const names = columns.map((column) => column.name)

      expect(names).toEqual(expect.arrayContaining([
        'thread_id',
        'workflow_id',
        'trigger',
        'message_id',
        'policy_profile_id',
        'gateway_id',
        'model_id',
        'paused_state_json',
        'usage_json',
        'last_checkpoint'
      ]))
    })
  })

  it('creates ordering and lookup indexes for replay', () => {
    withTempDb((db) => {
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name").all() as Array<{ name: string }>
      const names = indexes.map((index) => index.name)

      expect(names).toEqual(expect.arrayContaining([
        'idx_agent_run_events_run_sequence',
        'idx_agent_artifacts_run',
        'idx_agent_permission_grants_lookup',
        'idx_child_agent_tasks_parent'
      ]))
    })
  })
})
```

- [ ] **Step 2.2: Run tests to verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/db-schema.test.ts tests/agent-run-spine-db.test.ts
```

Expected: FAIL because migration `0015_agent_run_spine` and table declarations are missing.

- [ ] **Step 2.3: Add migration**

Create `desktop/src/main/db/migrations/0015_agent_run_spine.sql`:

```sql
ALTER TABLE agent_runs ADD COLUMN thread_id TEXT NOT NULL DEFAULT 'default-thread';
ALTER TABLE agent_runs ADD COLUMN workflow_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE agent_runs ADD COLUMN trigger TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE agent_runs ADD COLUMN message_id TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_runs ADD COLUMN policy_profile_id TEXT NOT NULL DEFAULT 'local-default';
ALTER TABLE agent_runs ADD COLUMN gateway_id TEXT;
ALTER TABLE agent_runs ADD COLUMN model_id TEXT;
ALTER TABLE agent_runs ADD COLUMN paused_state_json TEXT;
ALTER TABLE agent_runs ADD COLUMN usage_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE agent_runs ADD COLUMN last_checkpoint TEXT;

CREATE TABLE IF NOT EXISTS agent_run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(run_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run_sequence
ON agent_run_events(run_id, sequence);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_artifacts_run
ON agent_artifacts(run_id, created_at);

CREATE TABLE IF NOT EXISTS agent_permission_grants (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  workflow_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  permission_json TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER,
  approved_by_label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_permission_grants_lookup
ON agent_permission_grants(workflow_id, tool_id, scope, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS child_agent_tasks (
  id TEXT PRIMARY KEY,
  parent_run_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  input_summary TEXT NOT NULL,
  effective_tools_json TEXT NOT NULL,
  status TEXT NOT NULL,
  output_summary TEXT,
  artifact_ids_json TEXT NOT NULL,
  error_class TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_child_agent_tasks_parent
ON child_agent_tasks(parent_run_id, created_at);
```

Modify `desktop/src/main/db/migrate.ts` by appending:

```ts
{
  id: '0015_agent_run_spine',
  fileName: '0015_agent_run_spine.sql'
}
```

- [ ] **Step 2.4: Update schema declarations**

Modify `desktop/src/main/db/schema.ts`:

```ts
export const schemaTables = [
  'jobs',
  'assets',
  'asset_folders',
  'asset_references',
  'asset_categories',
  'asset_category_assignments',
  'workflows',
  'workflow_versions',
  'chat_messages',
  'gateway_configs',
  'storage_configs',
  'tools',
  'tool_audit',
  'agents',
  'agent_runs',
  'agent_run_events',
  'agent_artifacts',
  'agent_permission_grants',
  'child_agent_tasks',
  'skills',
  'skill_invocations',
  'style_presets',
  'canvas_snippets',
  'knowledge_documents',
  'knowledge_chunks',
  'context_packs'
] as const
```

Add table declarations after `agentRuns`:

```ts
export const agentRunEvents = sqliteTable('agent_run_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  sequence: integer('sequence').notNull(),
  type: text('type').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: integer('created_at').notNull()
})

export const agentArtifacts = sqliteTable('agent_artifacts', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: integer('created_at').notNull()
})

export const agentPermissionGrants = sqliteTable('agent_permission_grants', {
  id: text('id').primaryKey(),
  runId: text('run_id'),
  workflowId: text('workflow_id').notNull(),
  toolId: text('tool_id').notNull(),
  permissionJson: text('permission_json').notNull(),
  scope: text('scope').notNull(),
  expiresAt: integer('expires_at'),
  approvedByLabel: text('approved_by_label').notNull(),
  createdAt: integer('created_at').notNull(),
  revokedAt: integer('revoked_at')
})

export const childAgentTasks = sqliteTable('child_agent_tasks', {
  id: text('id').primaryKey(),
  parentRunId: text('parent_run_id').notNull(),
  roleId: text('role_id').notNull(),
  inputSummary: text('input_summary').notNull(),
  effectiveToolsJson: text('effective_tools_json').notNull(),
  status: text('status').notNull(),
  outputSummary: text('output_summary'),
  artifactIdsJson: text('artifact_ids_json').notNull(),
  errorClass: text('error_class'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})
```

- [ ] **Step 2.5: Run tests to verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/db-schema.test.ts tests/agent-run-spine-db.test.ts
```

Expected: PASS.

- [ ] **Step 2.6: Commit migration**

Run:

```bash
git add desktop/src/main/db/migrations/0015_agent_run_spine.sql desktop/src/main/db/migrate.ts desktop/src/main/db/schema.ts tests/db-schema.test.ts tests/agent-run-spine-db.test.ts
git commit -m "feat: add agent run spine schema"
```

---

### Task 3: Run Spine Repositories

**Files:**
- Create: `desktop/src/main/db/repositories/agent-run-event.repo.ts`
- Create: `desktop/src/main/db/repositories/agent-artifact.repo.ts`
- Create: `desktop/src/main/db/repositories/agent-permission-grant.repo.ts`
- Create: `desktop/src/main/db/repositories/child-agent-task.repo.ts`
- Modify: `desktop/src/main/db/repositories/agent-run.repo.ts`
- Modify: `tests/agent-run-spine-db.test.ts`

- [ ] **Step 3.1: Add failing repository tests**

Append to `tests/agent-run-spine-db.test.ts`:

```ts
import { createAgentArtifactRepository } from '../desktop/src/main/db/repositories/agent-artifact.repo'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'
import { createAgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'
import { createAgentRunRepository } from '../desktop/src/main/db/repositories/agent-run.repo'
import { createChildAgentTaskRepository } from '../desktop/src/main/db/repositories/child-agent-task.repo'

it('persists extended run metadata and append-only events', () => {
  withTempDb((db) => {
    const runs = createAgentRunRepository(db)
    const events = createAgentRunEventRepository(db)

    runs.upsert({
      id: 'run-1',
      threadId: 'thread-1',
      workflowId: 'default',
      messageId: 'message-1',
      trigger: 'canvasChat',
      agentId: 'general-purpose',
      status: 'pending',
      policyProfileId: 'local-default',
      trace: { messageId: 'message-1' },
      usage: { inputTokens: 0 },
      createdAt: 10,
      updatedAt: 10
    })

    events.append({
      id: 'event-1',
      runId: 'run-1',
      type: 'run.created',
      payload: {
        threadId: 'thread-1',
        workflowId: 'default',
        agentId: 'general-purpose',
        trigger: 'canvasChat',
        messageId: 'message-1',
        policyProfileId: 'local-default'
      },
      createdAt: 11
    })
    events.append({
      id: 'event-2',
      runId: 'run-1',
      type: 'progress',
      payload: { message: 'Starting orchestration', progress: 5 },
      createdAt: 12
    })

    expect(events.listByRunId('run-1').map((event) => [event.sequence, event.type])).toEqual([
      [1, 'run.created'],
      [2, 'progress']
    ])
    expect(runs.getById('run-1')).toMatchObject({
      id: 'run-1',
      threadId: 'thread-1',
      workflowId: 'default',
      messageId: 'message-1',
      trigger: 'canvasChat',
      policyProfileId: 'local-default',
      usage: { inputTokens: 0 }
    })
  })
})

it('persists artifacts, permission grants, and child task summaries', () => {
  withTempDb((db) => {
    const artifacts = createAgentArtifactRepository(db)
    const grants = createAgentPermissionGrantRepository(db)
    const children = createChildAgentTaskRepository(db)

    artifacts.create({
      id: 'artifact-1',
      runId: 'run-1',
      kind: 'answer',
      title: 'Answer',
      summary: 'Visible reply',
      payload: { type: 'answer', summary: 'Visible reply', text: '你好', dropped: [] },
      createdAt: 20
    })
    grants.save({
      id: 'grant-1',
      runId: 'run-1',
      workflowId: 'default',
      toolId: 'canvas.createNode',
      permissionKinds: ['canvas.write'],
      scope: 'run',
      approvedByLabel: 'user-local',
      createdAt: 21
    })
    children.upsert({
      id: 'child-1',
      parentRunId: 'run-1',
      roleId: 'canvas-planner',
      inputSummary: 'Draft image workflow',
      effectiveTools: ['canvas.queryGraph'],
      status: 'completed',
      outputSummary: 'Draft ready',
      artifactIds: ['artifact-1'],
      createdAt: 22,
      updatedAt: 23
    })

    expect(artifacts.listByRunId('run-1')).toHaveLength(1)
    expect(grants.findActive({
      runId: 'run-1',
      workflowId: 'default',
      toolId: 'canvas.createNode',
      permissionKinds: ['canvas.write'],
      now: 30
    })?.id).toBe('grant-1')
    expect(children.listByParentRunId('run-1')).toEqual([
      expect.objectContaining({ id: 'child-1', roleId: 'canvas-planner', artifactIds: ['artifact-1'] })
    ])
  })
})
```

- [ ] **Step 3.2: Run tests to verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-spine-db.test.ts
```

Expected: FAIL because repository modules and extended `AgentRunRecord` fields are missing.

- [ ] **Step 3.3: Extend `AgentRunRepository`**

Modify `desktop/src/main/db/repositories/agent-run.repo.ts`:

```ts
import type { AgentRunStatus, AgentTriggerKind } from '../../../../../shared/agents'
```

Extend `AgentRunRecord`:

```ts
export interface AgentRunRecord {
  id: string
  threadId: string
  workflowId: string
  messageId: string
  trigger: AgentTriggerKind
  agentId: string
  status: AgentRunStatus
  policyProfileId: string
  trace: Record<string, unknown>
  usage: Record<string, unknown>
  createdAt: number
  updatedAt: number
  jobId?: string
  contextPackId?: string
  gatewayId?: string
  modelId?: string
  pausedState?: Record<string, unknown>
  errorClass?: string
  lastCheckpoint?: string
}
```

Map the new SQL columns in `AgentRunRow`, `rowToRecord`, and `upsertRun`. Keep defaults for legacy tests by using:

```ts
threadId: row.thread_id || 'default-thread',
workflowId: row.workflow_id || 'default',
messageId: row.message_id || '',
trigger: (row.trigger || 'manual') as AgentTriggerKind,
policyProfileId: row.policy_profile_id || 'local-default',
usage: decodeJson<Record<string, unknown>>(row.usage_json) ?? {},
```

- [ ] **Step 3.4: Implement event repository**

Create `desktop/src/main/db/repositories/agent-run-event.repo.ts`:

```ts
/**
 * Append-only Agent Run Spine event repository.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { AgentRunEventPayload, AgentRunEventRecord, AgentRunEventType } from '../../../../../shared/agent-run-events'
import { decodeJson, encodeJson } from './json'

interface AgentRunEventRow {
  id: string
  run_id: string
  sequence: number
  type: AgentRunEventType
  payload_json: string
  created_at: number
}

export interface AgentRunEventAppendInput {
  id: string
  runId: string
  type: AgentRunEventType
  payload: AgentRunEventPayload
  createdAt: number
}

export interface AgentRunEventRepository {
  append(input: AgentRunEventAppendInput): AgentRunEventRecord
  listByRunId(runId: string): AgentRunEventRecord[]
}

function rowToRecord(row: AgentRunEventRow): AgentRunEventRecord {
  return {
    id: row.id,
    runId: row.run_id,
    sequence: row.sequence,
    type: row.type,
    payload: decodeJson<AgentRunEventPayload>(row.payload_json) ?? {},
    createdAt: row.created_at
  }
}

export function createAgentRunEventRepository(db: BetterSqliteDatabase): AgentRunEventRepository {
  const nextSequence = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM agent_run_events WHERE run_id = ?')
  const insert = db.prepare(`
    INSERT INTO agent_run_events (id, run_id, sequence, type, payload_json, created_at)
    VALUES (@id, @runId, @sequence, @type, @payloadJson, @createdAt)
  `)
  const selectByRun = db.prepare('SELECT * FROM agent_run_events WHERE run_id = ? ORDER BY sequence ASC')

  return {
    append(input) {
      const row = nextSequence.get(input.runId) as { sequence: number }
      const record: AgentRunEventRecord = {
        id: input.id,
        runId: input.runId,
        sequence: row.sequence,
        type: input.type,
        payload: input.payload,
        createdAt: input.createdAt
      }
      insert.run({
        id: record.id,
        runId: record.runId,
        sequence: record.sequence,
        type: record.type,
        payloadJson: encodeJson(record.payload),
        createdAt: record.createdAt
      })
      return record
    },
    listByRunId(runId) {
      return (selectByRun.all(runId) as AgentRunEventRow[]).map(rowToRecord)
    }
  }
}
```

- [ ] **Step 3.5: Implement artifact, grant, and child task repositories**

Create `desktop/src/main/db/repositories/agent-artifact.repo.ts` with `create(record)` and `listByRunId(runId)`.

Create `desktop/src/main/db/repositories/agent-permission-grant.repo.ts` with:

```ts
export interface PermissionGrantLookup {
  runId: string
  workflowId: string
  toolId: string
  permissionKinds: ToolPermissionKind[]
  now: number
}

export interface AgentPermissionGrantRepository {
  save(record: LocalPermissionGrant): LocalPermissionGrant
  findActive(input: PermissionGrantLookup): LocalPermissionGrant | null
  listByRunId(runId: string): LocalPermissionGrant[]
}
```

`findActive` must match active grants when:

```ts
grant.workflowId === input.workflowId
grant.toolId === input.toolId
grant.revokedAt === undefined
(grant.expiresAt === undefined || grant.expiresAt > input.now)
permissionKinds.every((kind) => grant.permissionKinds.includes(kind))
(
  grant.scope === 'session'
  || (grant.scope === 'run' && grant.runId === input.runId)
  || (grant.scope === 'once' && grant.runId === input.runId)
)
```

Create `desktop/src/main/db/repositories/child-agent-task.repo.ts` with `upsert(record)` and `listByParentRunId(parentRunId)`.

- [ ] **Step 3.6: Run repository tests to verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-spine-db.test.ts
```

Expected: PASS.

- [ ] **Step 3.7: Commit repositories**

Run:

```bash
git add desktop/src/main/db/repositories/agent-run.repo.ts desktop/src/main/db/repositories/agent-run-event.repo.ts desktop/src/main/db/repositories/agent-artifact.repo.ts desktop/src/main/db/repositories/agent-permission-grant.repo.ts desktop/src/main/db/repositories/child-agent-task.repo.ts tests/agent-run-spine-db.test.ts
git commit -m "feat: persist agent run spine records"
```

---

### Task 4: Pure Run Projector

**Files:**
- Create: `shared/agent-run-projector.ts`
- Create: `tests/agent-run-projector.test.ts`

- [ ] **Step 4.1: Write failing projector tests**

Create `tests/agent-run-projector.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { AgentRunSnapshot } from '../shared/agent-run-events'
import { projectAgentRunSnapshot } from '../shared/agent-run-projector'

const snapshot: AgentRunSnapshot = {
  run: {
    id: 'run-1',
    threadId: 'thread-1',
    workflowId: 'default',
    agentId: 'general-purpose',
    status: 'completed',
    trigger: 'canvasChat',
    messageId: 'message-1',
    policyProfileId: 'local-default',
    trace: {},
    usage: {},
    createdAt: 10,
    updatedAt: 30
  },
  events: [
    {
      id: 'event-1',
      runId: 'run-1',
      sequence: 1,
      type: 'run.created',
      payload: {
        threadId: 'thread-1',
        workflowId: 'default',
        agentId: 'general-purpose',
        trigger: 'canvasChat',
        messageId: 'message-1',
        policyProfileId: 'local-default'
      },
      createdAt: 10
    },
    { id: 'event-2', runId: 'run-1', sequence: 2, type: 'progress', payload: { message: 'Starting orchestration', progress: 5 }, createdAt: 11 },
    { id: 'event-3', runId: 'run-1', sequence: 3, type: 'tool.started', payload: { callId: 'call-1', toolId: 'canvas.queryGraph', inputSummary: 'Read graph' }, createdAt: 12 },
    { id: 'event-4', runId: 'run-1', sequence: 4, type: 'tool.completed', payload: { callId: 'call-1', toolId: 'canvas.queryGraph', invocationId: 'invoke-1', status: 'completed', summary: '0 nodes' }, createdAt: 13 },
    { id: 'event-5', runId: 'run-1', sequence: 5, type: 'response.ready', payload: { messageId: 'message-1', response: { type: 'answer', summary: 'Greeting', text: '你好，我在。', dropped: [] } }, createdAt: 14 },
    { id: 'event-6', runId: 'run-1', sequence: 6, type: 'run.completed', payload: { status: 'completed' }, createdAt: 15 }
  ],
  artifacts: [
    {
      id: 'artifact-1',
      runId: 'run-1',
      kind: 'answer',
      title: 'Answer',
      summary: 'Greeting',
      payload: { type: 'answer', summary: 'Greeting', text: '你好，我在。', dropped: [] },
      createdAt: 14
    }
  ],
  permissionGrants: [],
  childTasks: []
}

describe('Agent Run Projector', () => {
  it('projects persisted events into the same chat blocks as live reducer events', () => {
    const projection = projectAgentRunSnapshot(snapshot)

    expect(projection.chatTurn).toMatchObject({
      id: 'run-1-assistant',
      role: 'assistant',
      runId: 'run-1',
      messageId: 'message-1',
      status: 'completed',
      blocks: [
        { kind: 'thinking', lines: ['Starting orchestration'] },
        {
          kind: 'toolCall',
          callId: 'call-1',
          toolId: 'canvas.queryGraph',
          status: 'completed',
          inputSummary: 'Read graph',
          resultSummary: '0 nodes',
          isSubAgent: false
        },
        { kind: 'text', markdown: '你好，我在。', streaming: false }
      ]
    })
  })

  it('is deterministic for replayed snapshots', () => {
    expect(projectAgentRunSnapshot(snapshot)).toEqual(projectAgentRunSnapshot({
      ...snapshot,
      events: [...snapshot.events].reverse().sort((left, right) => left.sequence - right.sequence)
    }))
  })

  it('projects permission and failure state into inspector', () => {
    const failed = projectAgentRunSnapshot({
      ...snapshot,
      run: { ...snapshot.run, status: 'approval_required' },
      events: [
        ...snapshot.events.slice(0, 3),
        {
          id: 'event-permission',
          runId: 'run-1',
          sequence: 4,
          type: 'permission.requested',
          payload: {
            callId: 'call-write',
            toolId: 'canvas.createNode',
            reason: 'Creating nodes requires confirmation.',
            requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }]
          },
          createdAt: 20
        }
      ]
    })

    expect(failed.chatTurn.blocks).toContainEqual({
      kind: 'permission',
      callId: 'call-write',
      toolId: 'canvas.createNode',
      reason: 'Creating nodes requires confirmation.',
      resolved: false
    })
    expect(failed.inspector.permissions).toEqual([
      { callId: 'call-write', toolId: 'canvas.createNode', reason: 'Creating nodes requires confirmation.', resolved: false }
    ])
  })
})
```

- [ ] **Step 4.2: Run projector tests to verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-projector.test.ts
```

Expected: FAIL because `shared/agent-run-projector.ts` does not exist.

- [ ] **Step 4.3: Implement projector**

Create `shared/agent-run-projector.ts`:

```ts
/**
 * Pure Agent Run Spine projector used for live reconciliation and persisted replay.
 * @see docs/api-contracts/agents.md
 */

import type { AgentRunEventPayload, AgentRunEventRecord, AgentRunProjection, AgentRunSnapshot, RunInspectorModel } from './agent-run-events'
import { applyAgentEvent, createAssistantTurn, type AgentChatEvent, type ChatTurn } from './chat-blocks'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function payload(event: AgentRunEventRecord): Record<string, unknown> {
  return isRecord(event.payload) ? event.payload : {}
}

function toChatEvent(event: AgentRunEventRecord): AgentChatEvent | null {
  const data = payload(event)

  switch (event.type) {
    case 'progress':
      return typeof data.message === 'string' ? { type: 'progress', message: data.message } : null
    case 'model.delta':
      return typeof data.delta === 'string' ? { type: 'delta', delta: data.delta } : null
    case 'tool.started':
      return typeof data.callId === 'string' && typeof data.toolId === 'string'
        ? { type: 'toolStarted', callId: data.callId, toolId: data.toolId, inputSummary: typeof data.inputSummary === 'string' ? data.inputSummary : '' }
        : null
    case 'tool.completed':
      return typeof data.callId === 'string' && typeof data.toolId === 'string' && typeof data.summary === 'string'
        ? { type: 'toolCompleted', callId: data.callId, toolId: data.toolId, status: data.status === 'failed' || data.status === 'denied' ? data.status : 'completed', summary: data.summary }
        : null
    case 'permission.requested':
      return typeof data.callId === 'string' && typeof data.toolId === 'string' && typeof data.reason === 'string'
        ? { type: 'permissionRequired', callId: data.callId, toolId: data.toolId, reason: data.reason }
        : null
    case 'permission.resolved':
      return typeof data.callId === 'string' ? { type: 'permissionResolved', callId: data.callId } : null
    case 'response.ready':
      return isRecord(data.response) ? { type: 'responseReady', response: data.response as AgentChatEvent & never } : null
    case 'plan.ready':
      return typeof data.planId === 'string' ? { type: 'planReady', planId: data.planId } : null
    case 'run.failed':
      return typeof data.errorClass === 'string' && typeof data.message === 'string'
        ? { type: 'runFailed', errorClass: data.errorClass, message: data.message, retryable: data.retryable === true }
        : null
    default:
      return null
  }
}

function projectChatTurn(snapshot: AgentRunSnapshot): ChatTurn {
  const turn = createAssistantTurn({
    id: `${snapshot.run.id}-assistant`,
    runId: snapshot.run.id,
    messageId: snapshot.run.messageId,
    createdAt: snapshot.run.createdAt
  })

  return snapshot.events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .reduce((current, event) => {
      const chatEvent = toChatEvent(event)
      return chatEvent ? applyAgentEvent(current, chatEvent) : current
    }, turn)
}

function projectInspector(snapshot: AgentRunSnapshot): RunInspectorModel {
  const tools: RunInspectorModel['tools'] = []
  const permissions: RunInspectorModel['permissions'] = []
  let error: RunInspectorModel['error'] | undefined

  for (const event of snapshot.events.slice().sort((left, right) => left.sequence - right.sequence)) {
    const data = payload(event)
    if (event.type === 'tool.started' && typeof data.callId === 'string' && typeof data.toolId === 'string') {
      tools.push({ callId: data.callId, toolId: data.toolId, status: 'running' })
    }
    if (event.type === 'tool.completed' && typeof data.callId === 'string') {
      const tool = tools.find((entry) => entry.callId === data.callId)
      if (tool) {
        tool.status = typeof data.status === 'string' ? data.status : 'completed'
        tool.summary = typeof data.summary === 'string' ? data.summary : undefined
      }
    }
    if (event.type === 'permission.requested' && typeof data.callId === 'string' && typeof data.toolId === 'string' && typeof data.reason === 'string') {
      permissions.push({ callId: data.callId, toolId: data.toolId, reason: data.reason, resolved: false })
    }
    if (event.type === 'permission.resolved' && typeof data.callId === 'string') {
      const permission = permissions.find((entry) => entry.callId === data.callId)
      if (permission) permission.resolved = true
    }
    if (event.type === 'run.failed' && typeof data.errorClass === 'string' && typeof data.message === 'string') {
      error = { errorClass: data.errorClass, message: data.message, retryable: data.retryable === true }
    }
  }

  return {
    runId: snapshot.run.id,
    status: snapshot.run.status,
    agentId: snapshot.run.agentId,
    workflowId: snapshot.run.workflowId,
    trigger: snapshot.run.trigger,
    modelLabel: [snapshot.run.gatewayId, snapshot.run.modelId].filter(Boolean).join('/') || 'local',
    latestEventType: snapshot.events.at(-1)?.type,
    tools,
    permissions,
    artifacts: snapshot.artifacts.map((artifact) => ({ id: artifact.id, kind: artifact.kind, title: artifact.title, summary: artifact.summary })),
    childTasks: snapshot.childTasks.map((task) => ({
      id: task.id,
      parentRunId: task.parentRunId,
      roleId: task.roleId,
      status: task.status,
      summary: task.outputSummary ?? task.inputSummary,
      artifactIds: task.artifactIds,
      ...(task.errorClass ? { errorClass: task.errorClass } : {})
    })),
    ...(error ? { error } : {})
  }
}

export function projectAgentRunSnapshot(snapshot: AgentRunSnapshot): AgentRunProjection {
  const inspector = projectInspector(snapshot)

  return {
    chatTurn: projectChatTurn(snapshot),
    taskTree: inspector.childTasks,
    inspector,
    artifacts: snapshot.artifacts
  }
}
```

During implementation, replace the `response.ready` cast with a narrow local type guard:

```ts
import type { AgentResponse } from './agents'

function isAgentResponse(value: unknown): value is AgentResponse {
  return isRecord(value) && (value.type === 'answer' || value.type === 'clarification' || value.type === 'canvasPlan')
}
```

Use it in `toChatEvent` so TypeScript strict mode passes.

- [ ] **Step 4.4: Run projector tests to verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-projector.test.ts tests/chat-blocks.test.ts
```

Expected: PASS.

- [ ] **Step 4.5: Commit projector**

Run:

```bash
git add shared/agent-run-projector.ts tests/agent-run-projector.test.ts
git commit -m "feat: project agent run spine snapshots"
```

---

### Task 5: AgentRunSpine Service

**Files:**
- Create: `desktop/src/main/agent/run-spine.ts`
- Modify: `tests/agent-run-spine-db.test.ts`

- [ ] **Step 5.1: Add failing service tests**

Append to `tests/agent-run-spine-db.test.ts`:

```ts
import { createAgentRunSpine } from '../desktop/src/main/agent/run-spine'

it('creates snapshots with run, event, artifact, grant, and child task records', () => {
  withTempDb((db) => {
    const spine = createAgentRunSpine({
      runs: createAgentRunRepository(db),
      events: createAgentRunEventRepository(db),
      artifacts: createAgentArtifactRepository(db),
      grants: createAgentPermissionGrantRepository(db),
      childTasks: createChildAgentTaskRepository(db),
      idFactory: (prefix) => `${prefix}-1`,
      clock: () => 100
    })

    spine.createRun({
      runId: 'run-1',
      threadId: 'thread-1',
      workflowId: 'default',
      messageId: 'message-1',
      jobId: 'job-1',
      agentId: 'general-purpose',
      trigger: 'canvasChat',
      policyProfileId: 'local-default'
    })
    spine.appendEvent('run-1', 'progress', { message: 'Thinking', progress: 10 })
    spine.saveArtifact({
      id: 'artifact-answer',
      runId: 'run-1',
      kind: 'answer',
      title: 'Answer',
      summary: 'Greeting',
      payload: { type: 'answer', summary: 'Greeting', text: '你好', dropped: [] },
      createdAt: 101
    })
    spine.savePermissionGrant({
      id: 'grant-1',
      runId: 'run-1',
      workflowId: 'default',
      toolId: 'canvas.createNode',
      permissionKinds: ['canvas.write'],
      scope: 'run',
      approvedByLabel: 'user-local',
      createdAt: 102
    })
    spine.upsertChildTask({
      id: 'child-1',
      parentRunId: 'run-1',
      roleId: 'qa-verifier',
      inputSummary: 'Verify plan',
      effectiveTools: [],
      status: 'completed',
      outputSummary: 'Looks valid',
      artifactIds: ['artifact-answer'],
      createdAt: 103,
      updatedAt: 104
    })

    const snapshot = spine.getSnapshot('run-1')

    expect(snapshot).not.toBeNull()
    expect(snapshot?.run).toMatchObject({ id: 'run-1', status: 'pending', threadId: 'thread-1' })
    expect(snapshot?.events.map((event) => event.type)).toEqual(['run.created', 'progress', 'artifact.created'])
    expect(snapshot?.artifacts).toHaveLength(1)
    expect(snapshot?.permissionGrants).toHaveLength(1)
    expect(snapshot?.childTasks).toHaveLength(1)
  })
})

it('updates run status, paused state, usage, and failure metadata', () => {
  withTempDb((db) => {
    const spine = createAgentRunSpine({
      runs: createAgentRunRepository(db),
      events: createAgentRunEventRepository(db),
      artifacts: createAgentArtifactRepository(db),
      grants: createAgentPermissionGrantRepository(db),
      childTasks: createChildAgentTaskRepository(db),
      idFactory: (prefix) => `${prefix}-status`,
      clock: () => 200
    })

    spine.createRun({
      runId: 'run-status',
      threadId: 'thread-1',
      workflowId: 'default',
      messageId: 'message-status',
      agentId: 'general-purpose',
      trigger: 'manual',
      policyProfileId: 'local-default'
    })
    spine.updateRun({
      runId: 'run-status',
      status: 'approval_required',
      pausedState: { transition: 'approval_required', pendingToolCalls: [] },
      errorClass: 'agent_tool_approval_required',
      lastCheckpoint: 'permission.requested'
    })

    expect(spine.getSnapshot('run-status')?.run).toMatchObject({
      status: 'approval_required',
      pausedState: { transition: 'approval_required', pendingToolCalls: [] },
      errorClass: 'agent_tool_approval_required',
      lastCheckpoint: 'permission.requested'
    })
  })
})
```

- [ ] **Step 5.2: Run tests to verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-spine-db.test.ts
```

Expected: FAIL because `createAgentRunSpine` is missing.

- [ ] **Step 5.3: Implement RunSpine service**

Create `desktop/src/main/agent/run-spine.ts`:

```ts
/**
 * Durable local Agent Run Spine service.
 * @see docs/api-contracts/agents.md
 */

import type {
  AgentArtifactRecord,
  AgentRunEventPayload,
  AgentRunEventType,
  AgentRunSnapshot,
  ChildAgentTaskRecord,
  LocalPermissionGrant
} from '../../../../shared/agent-run-events'
import type { AgentRunStatus, AgentTriggerKind } from '../../../../shared/agents'
import type { AgentArtifactRepository } from '../db/repositories/agent-artifact.repo'
import type { AgentPermissionGrantRepository } from '../db/repositories/agent-permission-grant.repo'
import type { AgentRunEventRepository } from '../db/repositories/agent-run-event.repo'
import type { AgentRunRepository } from '../db/repositories/agent-run.repo'
import type { ChildAgentTaskRepository } from '../db/repositories/child-agent-task.repo'

export interface CreateAgentRunSpineInput {
  runId: string
  threadId: string
  workflowId: string
  messageId: string
  agentId: string
  trigger: AgentTriggerKind
  policyProfileId: string
  jobId?: string
  gatewayId?: string
  modelId?: string
}

export interface UpdateAgentRunInput {
  runId: string
  status: AgentRunStatus
  jobId?: string
  contextPackId?: string
  pausedState?: Record<string, unknown>
  usage?: Record<string, unknown>
  trace?: Record<string, unknown>
  errorClass?: string
  lastCheckpoint?: string
}

export interface AgentRunSpine {
  createRun(input: CreateAgentRunSpineInput): void
  updateRun(input: UpdateAgentRunInput): void
  appendEvent(runId: string, type: AgentRunEventType, payload: AgentRunEventPayload): void
  saveArtifact(record: AgentArtifactRecord): AgentArtifactRecord
  savePermissionGrant(record: LocalPermissionGrant): LocalPermissionGrant
  upsertChildTask(record: ChildAgentTaskRecord): ChildAgentTaskRecord
  getSnapshot(runId: string): AgentRunSnapshot | null
}

export interface AgentRunSpineOptions {
  runs: AgentRunRepository
  events: AgentRunEventRepository
  artifacts: AgentArtifactRepository
  grants: AgentPermissionGrantRepository
  childTasks: ChildAgentTaskRepository
  idFactory?: (prefix: 'event' | 'artifact' | 'grant' | 'child') => string
  clock?: () => number
}

export function createAgentRunSpine(options: AgentRunSpineOptions): AgentRunSpine {
  const clock = options.clock ?? Date.now
  const idFactory = options.idFactory ?? ((prefix) => `${prefix}-${crypto.randomUUID()}`)

  function updateRun(input: UpdateAgentRunInput): void {
    const existing = options.runs.getById(input.runId)
    if (!existing) {
      return
    }
    options.runs.upsert({
      ...existing,
      status: input.status,
      updatedAt: clock(),
      ...(input.jobId ? { jobId: input.jobId } : {}),
      ...(input.contextPackId ? { contextPackId: input.contextPackId } : {}),
      ...(input.pausedState ? { pausedState: input.pausedState } : {}),
      ...(input.usage ? { usage: input.usage } : {}),
      trace: input.trace ? { ...existing.trace, ...input.trace } : existing.trace,
      ...(input.errorClass ? { errorClass: input.errorClass } : {}),
      ...(input.lastCheckpoint ? { lastCheckpoint: input.lastCheckpoint } : {})
    })
  }

  return {
    createRun(input) {
      const now = clock()
      options.runs.upsert({
        id: input.runId,
        threadId: input.threadId,
        workflowId: input.workflowId,
        messageId: input.messageId,
        trigger: input.trigger,
        agentId: input.agentId,
        status: 'pending',
        policyProfileId: input.policyProfileId,
        trace: { messageId: input.messageId, agentId: input.agentId, trigger: input.trigger },
        usage: {},
        createdAt: now,
        updatedAt: now,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.gatewayId ? { gatewayId: input.gatewayId } : {}),
        ...(input.modelId ? { modelId: input.modelId } : {})
      })
      options.events.append({
        id: idFactory('event'),
        runId: input.runId,
        type: 'run.created',
        payload: input,
        createdAt: now
      })
    },
    updateRun,
    appendEvent(runId, type, payload) {
      options.events.append({ id: idFactory('event'), runId, type, payload, createdAt: clock() })
    },
    saveArtifact(record) {
      const saved = options.artifacts.create(record)
      options.events.append({
        id: idFactory('event'),
        runId: saved.runId,
        type: 'artifact.created',
        payload: { artifactId: saved.id, kind: saved.kind, title: saved.title, summary: saved.summary },
        createdAt: clock()
      })
      return saved
    },
    savePermissionGrant(record) {
      return options.grants.save(record)
    },
    upsertChildTask(record) {
      return options.childTasks.upsert(record)
    },
    getSnapshot(runId) {
      const run = options.runs.getById(runId)
      if (!run) {
        return null
      }

      return {
        run: {
          id: run.id,
          threadId: run.threadId,
          workflowId: run.workflowId,
          agentId: run.agentId,
          status: run.status,
          trigger: run.trigger,
          messageId: run.messageId,
          ...(run.jobId ? { jobId: run.jobId } : {}),
          ...(run.contextPackId ? { contextPackId: run.contextPackId } : {}),
          policyProfileId: run.policyProfileId,
          ...(run.gatewayId ? { gatewayId: run.gatewayId } : {}),
          ...(run.modelId ? { modelId: run.modelId } : {}),
          ...(run.pausedState ? { pausedState: run.pausedState } : {}),
          usage: run.usage,
          trace: run.trace,
          ...(run.errorClass ? { errorClass: run.errorClass } : {}),
          createdAt: run.createdAt,
          updatedAt: run.updatedAt
        },
        events: options.events.listByRunId(runId),
        artifacts: options.artifacts.listByRunId(runId),
        permissionGrants: options.grants.listByRunId(runId),
        childTasks: options.childTasks.listByParentRunId(runId)
      }
    }
  }
}
```

- [ ] **Step 5.4: Run tests to verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-spine-db.test.ts
```

Expected: PASS.

- [ ] **Step 5.5: Commit service**

Run:

```bash
git add desktop/src/main/agent/run-spine.ts tests/agent-run-spine-db.test.ts
git commit -m "feat: add agent run spine service"
```

---

### Task 6: Orchestrator Event Append And Artifact Projection

**Files:**
- Modify: `desktop/src/main/agent/orchestrator.ts`
- Modify: `tests/orchestrator-runtime.test.ts`

- [ ] **Step 6.1: Add failing orchestrator integration tests**

Append to `tests/orchestrator-runtime.test.ts`:

```ts
import { createAgentArtifactRepository } from '../desktop/src/main/db/repositories/agent-artifact.repo'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'
import { createAgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'
import { createChildAgentTaskRepository } from '../desktop/src/main/db/repositories/child-agent-task.repo'
import { createAgentRunSpine } from '../desktop/src/main/agent/run-spine'
import { projectAgentRunSnapshot } from '../shared/agent-run-projector'

it('persists every visible successful run transition in the run spine', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-orchestrator-spine-'))
  const dbPath = join(tempDir, 'orchestrator-spine.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    const jobs = createJobRepository(db)
    const agentRuns = createAgentRunRepository(db)
    const runSpine = createAgentRunSpine({
      runs: agentRuns,
      events: createAgentRunEventRepository(db),
      artifacts: createAgentArtifactRepository(db),
      grants: createAgentPermissionGrantRepository(db),
      childTasks: createChildAgentTaskRepository(db),
      idFactory: (() => {
        let next = 0
        return (prefix) => `${prefix}-spine-${(next += 1)}`
      })(),
      clock: (() => {
        let now = 1_782_700_010_000
        return () => now++
      })()
    })
    const events = createJobEventBus()
    const queue = createJobQueue({ jobs, idFactory: () => 'job-spine-1', clock: () => 1_782_700_010_000 })
    const runtime = createOrchestratorRuntime({
      queue,
      events,
      agentRuns,
      runSpine,
      listTools: () => [queryGraphTool],
      idFactory: (prefix) => `${prefix}-spine-1`,
      planIdFactory: () => 'plan-spine-1',
      planner: {
        async *proposePlan() {
          yield { type: 'progress', message: 'Model thinking', progress: 60 }
          return { type: 'answer', summary: 'Greeting', text: '你好，我在。', dropped: [] }
        }
      }
    })
    const worker = createJobWorker({
      jobs,
      events,
      leaseOwner: 'agent-spine-worker',
      clock: () => 1_782_700_010_050,
      handlers: { 'agent.run': runtime.createJobHandler() }
    })

    const ticket = runtime.agentRun({ agentId: 'general-purpose', message: '你好' })
    expect(await worker.runNext()).toBe('job-spine-1')

    const snapshot = runSpine.getSnapshot(ticket.runId)
    expect(snapshot?.events.map((event) => event.type)).toEqual([
      'run.created',
      'run.started',
      'intent.analyzed',
      'context.built',
      'progress',
      'progress',
      'progress',
      'progress',
      'response.ready',
      'artifact.created',
      'run.completed'
    ])
    expect(snapshot?.artifacts).toEqual([
      expect.objectContaining({ kind: 'answer', title: 'Answer', summary: 'Greeting' })
    ])
    expect(snapshot ? projectAgentRunSnapshot(snapshot).chatTurn.blocks : []).toContainEqual({
      kind: 'text',
      markdown: '你好，我在。',
      streaming: false
    })
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 6.2: Run test to verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts
```

Expected: FAIL because `OrchestratorRuntimeOptions` has no `runSpine` field and no events are appended.

- [ ] **Step 6.3: Wire run spine into orchestrator options**

Modify `desktop/src/main/agent/orchestrator.ts`:

```ts
import type { AgentRunSpine } from './run-spine'
```

Extend `OrchestratorRuntimeOptions`:

```ts
runSpine?: AgentRunSpine
```

Create helper functions near `createOrchestratorRuntime`:

```ts
function artifactKindForResponse(response: AgentResponse): 'answer' | 'clarification' | 'canvasPlan' {
  return response.type
}

function artifactTitleForResponse(response: AgentResponse): string {
  if (response.type === 'answer') return 'Answer'
  if (response.type === 'clarification') return 'Clarification'
  return 'Canvas Plan'
}
```

In `chatSend` and `agentRun`, after queue ticket creation and before returning, call:

```ts
options.runSpine?.createRun({
  runId,
  threadId: options.workflowId ?? 'default',
  workflowId: options.workflowId ?? 'default',
  messageId,
  jobId: ticket.jobId,
  agentId: input.agentId ?? DEFAULT_CHAT_AGENT_ID,
  trigger: input.trigger ?? 'canvasChat',
  policyProfileId: 'local-default'
})
options.runSpine?.appendEvent(runId, 'intent.analyzed', intentAnalysis as unknown as Record<string, unknown>)
```

In `createJobHandler`, after resolving the agent and before calling `runOrchestrator`, call:

```ts
options.runSpine?.updateRun({ runId, status: 'running', jobId: job.id })
options.runSpine?.appendEvent(runId, 'run.started', { status: 'running', jobId: job.id })
options.runSpine?.appendEvent(runId, 'context.built', {
  tokenEstimate: contextResult.summary.tokenEstimate,
  omittedSources: contextResult.summary.omittedSources,
  warnings: contextResult.summary.warnings
})
```

Use the actual property names from `buildAgentContext` result. If they differ, preserve the same payload shape by deriving:

```ts
{
  tokenEstimate: contextResult.rendered.length,
  omittedSources: [],
  warnings: []
}
```

- [ ] **Step 6.4: Append stream events in `consumeRunStream`**

Extend `consumeRunStream` options:

```ts
runSpine?: AgentRunSpine
```

Append these calls beside existing live IPC fanout:

```ts
options.runSpine?.appendEvent(next.value.runId, 'progress', { message: next.value.message, progress: next.value.progress })
options.runSpine?.appendEvent(next.value.runId, 'tool.started', { callId: next.value.callId, toolId: next.value.toolId, inputSummary: next.value.inputSummary })
options.runSpine?.appendEvent(next.value.runId, 'tool.completed', { callId: next.value.callId, toolId: next.value.toolId, invocationId: next.value.invocationId, status: next.value.status, summary: next.value.summary })
options.runSpine?.appendEvent(next.value.runId, 'permission.requested', { callId: next.value.callId, toolId: next.value.toolId, reason: next.value.reason, requiredPermissions: next.value.requiredPermissions })
```

At terminal response handling, save artifacts:

```ts
options.runSpine?.appendEvent(next.value.runId, 'response.ready', { messageId: next.value.messageId, response })
options.runSpine?.saveArtifact({
  id: `artifact-${next.value.runId}-${response.type}`,
  runId: next.value.runId,
  kind: artifactKindForResponse(response),
  title: artifactTitleForResponse(response),
  summary: response.summary,
  payload: response,
  createdAt: Date.now()
})
```

For CanvasPlan:

```ts
options.runSpine?.appendEvent(next.value.runId, 'plan.ready', { messageId: next.value.messageId, planId: next.value.planId })
options.runSpine?.saveArtifact({
  id: `artifact-${next.value.runId}-canvasPlan`,
  runId: next.value.runId,
  kind: 'canvasPlan',
  title: 'Canvas Plan',
  summary: next.value.plan.summary,
  payload: next.value.plan,
  createdAt: Date.now()
})
```

After `setRun({ status: 'completed' })`, call:

```ts
options.runSpine?.updateRun({ runId: next.value.runId, status: 'completed', usage: usageSummary ? { summary: usageSummary } : {} })
options.runSpine?.appendEvent(next.value.runId, 'run.completed', { status: 'completed' })
```

- [ ] **Step 6.5: Append failure events**

In both catch blocks in `createJobHandler`, after `setRun(runFailureTrace(...))`, compute the failure trace and call:

```ts
const failedRun = runFailureTrace(runId, messageId, runsById.get(runId), error)
setRun(failedRun)
options.runSpine?.updateRun({
  runId,
  status: failedRun.status,
  ...(failedRun.pausedState ? { pausedState: failedRun.pausedState as unknown as Record<string, unknown> } : {}),
  ...(failedRun.errorClass ? { errorClass: failedRun.errorClass } : {}),
  lastCheckpoint: failedRun.status === 'approval_required' ? 'permission.requested' : 'run.failed'
})
if (failedRun.status === 'approval_required' && failedRun.pendingApproval) {
  options.runSpine?.appendEvent(runId, 'permission.requested', {
    callId: failedRun.pendingApproval.callId,
    toolId: failedRun.pendingApproval.toolId,
    reason: failedRun.pendingApproval.reason,
    requiredPermissions: failedRun.pendingApproval.requiredPermissions
  })
} else {
  options.runSpine?.appendEvent(runId, 'run.failed', {
    errorClass: failedRun.errorClass ?? 'agent_run_failed',
    message: error instanceof Error ? error.message : 'Agent run failed.',
    retryable: false,
    checkpoint: 'run.failed'
  })
}
throw error
```

Ensure the original catch does not call `runFailureTrace` twice.

- [ ] **Step 6.6: Run orchestrator tests to verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts tests/agent-run-projector.test.ts
```

Expected: PASS.

- [ ] **Step 6.7: Commit orchestrator spine wiring**

Run:

```bash
git add desktop/src/main/agent/orchestrator.ts tests/orchestrator-runtime.test.ts
git commit -m "feat: append orchestrator run spine events"
```

---

### Task 7: Persistent Approval Grants

**Files:**
- Create: `desktop/src/main/agent/permission-service.ts`
- Modify: `desktop/src/main/tools/runtime.ts`
- Modify: `desktop/src/main/agent/orchestrator.ts`
- Create: `tests/agent-permission-grants.test.ts`
- Modify: `tests/tool-runtime.test.ts`
- Modify: `tests/orchestrator-runtime.test.ts`

- [ ] **Step 7.1: Write failing permission grant tests**

Create `tests/agent-permission-grants.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { ToolPermissionResult } from '../shared/tools'
import { createAgentPermissionService } from '../desktop/src/main/agent/permission-service'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'

const askCanvasWrite: ToolPermissionResult = {
  decision: 'ask',
  decisionReason: 'Creating nodes requires confirmation.',
  requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }]
}

const askDestructive: ToolPermissionResult = {
  decision: 'ask',
  decisionReason: 'Deleting nodes requires confirmation.',
  requiredPermissions: [
    { kind: 'canvas.write', reason: 'Mutates canvas graph.' },
    { kind: 'destructive', reason: 'Deletes graph data.' }
  ]
}

function withService<T>(run: (service: ReturnType<typeof createAgentPermissionService>) => T): T {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-permission-service-'))
  const dbPath = join(tempDir, 'permission.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    return run(createAgentPermissionService({
      grants: createAgentPermissionGrantRepository(db),
      workflowId: 'default',
      clock: () => 1_783_900_000_000,
      idFactory: () => 'grant-1'
    }))
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('Agent permission grants', () => {
  it('reuses run grants only for matching run, tool, and permission kinds', () => {
    withService((service) => {
      service.rememberApproval({
        runId: 'run-1',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite,
        approvedByLabel: 'user-local',
        scope: 'run'
      })

      expect(service.hasReusableGrant({
        runId: 'run-1',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite
      })).toBe(true)
      expect(service.hasReusableGrant({
        runId: 'run-2',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite
      })).toBe(false)
      expect(service.hasReusableGrant({
        runId: 'run-1',
        toolId: 'canvas.deleteNode',
        permission: askCanvasWrite
      })).toBe(false)
    })
  })

  it('reuses session grants across runs in the same workflow', () => {
    withService((service) => {
      service.rememberApproval({
        runId: 'run-1',
        toolId: 'web.search',
        permission: { decision: 'ask', decisionReason: 'Network search requires confirmation.', requiredPermissions: [{ kind: 'network', reason: 'Uses network.' }] },
        approvedByLabel: 'user-local',
        scope: 'session'
      })

      expect(service.hasReusableGrant({
        runId: 'run-2',
        toolId: 'web.search',
        permission: { decision: 'ask', decisionReason: 'Network search requires confirmation.', requiredPermissions: [{ kind: 'network', reason: 'Uses network.' }] }
      })).toBe(true)
    })
  })

  it('does not let non-destructive grants bypass destructive prompts', () => {
    withService((service) => {
      service.rememberApproval({
        runId: 'run-1',
        toolId: 'canvas.deleteNode',
        permission: askCanvasWrite,
        approvedByLabel: 'user-local',
        scope: 'session'
      })

      expect(service.hasReusableGrant({
        runId: 'run-2',
        toolId: 'canvas.deleteNode',
        permission: askDestructive
      })).toBe(false)
    })
  })
})
```

- [ ] **Step 7.2: Run permission tests to verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-permission-grants.test.ts
```

Expected: FAIL because `permission-service.ts` is missing.

- [ ] **Step 7.3: Implement permission service**

Create `desktop/src/main/agent/permission-service.ts`:

```ts
/**
 * Local permission grant matching for Agent tool approvals.
 * @see docs/api-contracts/agents.md
 */

import type { PermissionGrantScope } from '../../../../shared/agent-run-events'
import type { ToolPermissionKind, ToolPermissionResult } from '../../../../shared/tools'
import type { AgentPermissionGrantRepository } from '../db/repositories/agent-permission-grant.repo'

export interface RememberApprovalInput {
  runId: string
  toolId: string
  permission: ToolPermissionResult
  approvedByLabel: string
  scope: PermissionGrantScope
}

export interface ReusableGrantInput {
  runId: string
  toolId: string
  permission: ToolPermissionResult
}

export interface AgentPermissionService {
  rememberApproval(input: RememberApprovalInput): void
  hasReusableGrant(input: ReusableGrantInput): boolean
}

export interface AgentPermissionServiceOptions {
  grants: AgentPermissionGrantRepository
  workflowId: string
  idFactory?: () => string
  clock?: () => number
}

function permissionKinds(permission: ToolPermissionResult): ToolPermissionKind[] {
  return [...new Set(permission.requiredPermissions.map((entry) => entry.kind))].sort()
}

export function createAgentPermissionService(options: AgentPermissionServiceOptions): AgentPermissionService {
  const clock = options.clock ?? Date.now
  const idFactory = options.idFactory ?? (() => `grant-${crypto.randomUUID()}`)

  return {
    rememberApproval(input) {
      options.grants.save({
        id: idFactory(),
        runId: input.scope === 'session' ? undefined : input.runId,
        workflowId: options.workflowId,
        toolId: input.toolId,
        permissionKinds: permissionKinds(input.permission),
        scope: input.scope,
        approvedByLabel: input.approvedByLabel,
        createdAt: clock()
      })
    },
    hasReusableGrant(input) {
      if (input.permission.decision !== 'ask') {
        return false
      }

      return options.grants.findActive({
        runId: input.runId,
        workflowId: options.workflowId,
        toolId: input.toolId,
        permissionKinds: permissionKinds(input.permission),
        now: clock()
      }) !== null
    }
  }
}
```

- [ ] **Step 7.4: Move ToolRuntime reusable grants behind injected store**

Modify `desktop/src/main/tools/runtime.ts`:

```ts
export interface ToolPermissionGrantStore {
  remember(input: ToolInvocationInput, permission: ToolPermissionResult): void
  has(input: ToolInvocationInput, permission: ToolPermissionResult): boolean
}
```

Extend `ToolInvocationInput.approvedInvocation`:

```ts
approvedInvocation?: {
  toolId: string
  input: unknown
  approvedBy: ToolActor
  scope?: 'once' | 'run' | 'session'
}
```

Extend `ToolRuntimeOptions`:

```ts
permissionGrantStore?: ToolPermissionGrantStore
```

Replace the local `permissionGrants` `Set` with a default store:

```ts
function createMemoryPermissionGrantStore(): ToolPermissionGrantStore {
  const grants = new Set<string>()
  return {
    remember(input, permission) {
      grants.add(permissionGrantKey(input, permission))
    },
    has(input, permission) {
      return grants.has(permissionGrantKey(input, permission))
    }
  }
}
```

Inside `createToolRuntime`, define:

```ts
const permissionGrantStore = options.permissionGrantStore ?? createMemoryPermissionGrantStore()
```

Replace `permissionGrants.has(grantKey)` with `permissionGrantStore.has(input, permission)`.

Replace `permissionGrants.add(grantKey)` with `permissionGrantStore.remember(input, permission)`.

- [ ] **Step 7.5: Wire approval persistence in orchestrator**

In `desktop/src/main/agent/orchestrator.ts`, when `approveTool` enqueues approval resume, append a permission resolution event and save a grant:

```ts
const approvalScope = input.scope ?? 'run'
options.runSpine?.appendEvent(run.runId, 'permission.resolved', {
  callId: input.callId,
  approvedByLabel: input.approvedBy,
  scope: approvalScope
})
options.runSpine?.savePermissionGrant({
  id: `grant-${run.runId}-${input.callId}-${approvalScope}`,
  runId: approvalScope === 'session' ? undefined : run.runId,
  workflowId: options.workflowId ?? 'default',
  toolId: approval.toolId,
  permissionKinds: [...new Set(approval.requiredPermissions.map((permission) => permission.kind))].sort(),
  scope: approvalScope,
  approvedByLabel: input.approvedBy,
  createdAt: clock()
})
```

In approval resume payload, include:

```ts
scope: approvalScope
```

Extend `ApprovalResumePayload` and `approvalPayload(...)` to carry the optional scope.

In `runApprovalOrchestrator`, pass the scope into ToolRuntime through `resumeAgentContextLoopWithApproval` by extending `AgentToolApprovalRequest` or by adding `approvalScope` to `OrchestratorApprovalPlannerInput`. The concrete path must result in:

```ts
approvedInvocation: {
  toolId: call.toolId,
  input: call.input,
  approvedBy: input.approvedBy,
  scope: input.approvalScope
}
```

- [ ] **Step 7.6: Run permission and approval tests to verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-permission-grants.test.ts tests/tool-runtime.test.ts tests/agent-context-loop.test.ts tests/orchestrator-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 7.7: Commit permission grants**

Run:

```bash
git add desktop/src/main/agent/permission-service.ts desktop/src/main/tools/runtime.ts desktop/src/main/agent/context-loop.ts desktop/src/main/agent/orchestrator.ts tests/agent-permission-grants.test.ts tests/tool-runtime.test.ts tests/agent-context-loop.test.ts tests/orchestrator-runtime.test.ts
git commit -m "feat: persist local agent approval grants"
```

---

### Task 8: Runtime Wiring And `agent.getRun` Projection

**Files:**
- Modify: `desktop/src/main/runtime.ts`
- Modify: `desktop/src/main/ipc/agent.handler.ts`
- Modify: `tests/main-runtime-wiring.test.ts`
- Modify: `tests/orchestrator-runtime.test.ts`

- [ ] **Step 8.1: Add failing runtime wiring test**

Append to `tests/main-runtime-wiring.test.ts`:

```ts
it('returns projected run spine state through agent.getRun after chat completes', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-main-runtime-run-spine-'))
  const dbPath = join(tempDir, 'runtime-run-spine.sqlite')
  const assetRoot = join(tempDir, 'assets')
  const { ipcMain, handlers } = createFakeIpcMain()
  const window = createWindow()
  let runtime: MainProcessRuntime | null = null

  try {
    runtime = createMainProcessRuntime({
      ipcMain,
      dbPath,
      assetRoot,
      getWindows: () => [window],
      currentUserId: 'user-1',
      clock: (() => {
        let now = 1_783_300_200_000
        return () => now++
      })(),
      idFactory: (() => {
        let index = 0
        return () => `job-run-spine-${++index}`
      })(),
      messageIdFactory: (prefix) => `${prefix}-run-spine`,
      planIdFactory: () => 'plan-run-spine'
    })

    const ticket = await handlers.get('canvas.chatSend')?.({}, { message: '你好', agentId: 'general-purpose' }) as { runId: string }
    await runtime.waitForIdleForTests()

    const run = await handlers.get('agent.getRun')?.({}, { runId: ticket.runId }) as {
      runId: string
      projection?: { chatTurn: { blocks: Array<{ kind: string }> } }
      snapshot?: { events: Array<{ type: string }> }
    }

    expect(run.runId).toBe(ticket.runId)
    expect(run.snapshot?.events.map((event) => event.type)).toContain('run.completed')
    expect(run.projection?.chatTurn.blocks.some((block) => block.kind === 'text')).toBe(true)
  } finally {
    runtime?.close()
    await removeTempDirWithRetry(tempDir)
  }
})
```

- [ ] **Step 8.2: Run runtime test to verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts
```

Expected: FAIL because runtime does not instantiate run spine repositories and `agent.getRun` does not return projection.

- [ ] **Step 8.3: Instantiate repositories and run spine in runtime**

Modify `desktop/src/main/runtime.ts` imports:

```ts
import { createAgentArtifactRepository } from './db/repositories/agent-artifact.repo'
import { createAgentPermissionGrantRepository } from './db/repositories/agent-permission-grant.repo'
import { createAgentRunEventRepository } from './db/repositories/agent-run-event.repo'
import { createChildAgentTaskRepository } from './db/repositories/child-agent-task.repo'
import { createAgentRunSpine } from './agent/run-spine'
import { createAgentPermissionService } from './agent/permission-service'
```

After `const agentRuns = createAgentRunRepository(db)`, add:

```ts
const agentRunEvents = createAgentRunEventRepository(db)
const agentArtifacts = createAgentArtifactRepository(db)
const agentPermissionGrants = createAgentPermissionGrantRepository(db)
const childAgentTasks = createChildAgentTaskRepository(db)
const runSpine = createAgentRunSpine({
  runs: agentRuns,
  events: agentRunEvents,
  artifacts: agentArtifacts,
  grants: agentPermissionGrants,
  childTasks: childAgentTasks,
  clock
})
```

Before `createToolRuntime`, add:

```ts
const permissionService = createAgentPermissionService({
  grants: agentPermissionGrants,
  workflowId: 'default',
  clock
})
```

Pass `permissionGrantStore` into `createToolRuntime`:

```ts
permissionGrantStore: {
  remember(input, permission) {
    if (input.actor.type !== 'agent') {
      return
    }
    permissionService.rememberApproval({
      runId: input.traceId,
      toolId: input.toolId,
      permission,
      approvedByLabel: input.approvedInvocation?.approvedBy.id ?? 'user-local',
      scope: input.approvedInvocation?.scope ?? 'run'
    })
  },
  has(input, permission) {
    if (input.actor.type !== 'agent') {
      return false
    }
    return permissionService.hasReusableGrant({
      runId: input.traceId,
      toolId: input.toolId,
      permission
    })
  }
}
```

Pass `runSpine` into `createOrchestratorRuntime`.

- [ ] **Step 8.4: Return projection from `agent.getRun`**

In `desktop/src/main/agent/orchestrator.ts`, change `getRun` return construction:

```ts
const snapshot = options.runSpine?.getSnapshot(runId) ?? undefined
const projection = snapshot ? projectAgentRunSnapshot(snapshot) : undefined
return {
  runId: run.runId,
  status: run.status,
  trace: runTrace(run),
  ...(snapshot ? { snapshot } : {}),
  ...(projection ? { projection } : {})
}
```

Apply the same snapshot/projection enrichment to the persisted fallback path.

Import:

```ts
import { projectAgentRunSnapshot } from '../../../../shared/agent-run-projector'
```

Update `OrchestratorRuntime.getRun` return type to `AgentRunViewResponse | null`.

`desktop/src/main/ipc/agent.handler.ts` can keep delegating `runtime.getRun`; update the `Pick<OrchestratorRuntime, ...>` type if TypeScript requires it.

- [ ] **Step 8.5: Run runtime wiring tests to verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts tests/orchestrator-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 8.6: Commit runtime wiring**

Run:

```bash
git add desktop/src/main/runtime.ts desktop/src/main/ipc/agent.handler.ts desktop/src/main/agent/orchestrator.ts tests/main-runtime-wiring.test.ts tests/orchestrator-runtime.test.ts
git commit -m "feat: expose projected agent run snapshots"
```

---

### Task 9: Verification And Integration Report

**Files:**
- Create: `docs/progress/2026-07-10-local-agent-run-spine.md`
- Modify: files touched by formatting or type fixes from verification.

- [ ] **Step 9.1: Run targeted regression group**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-contracts.test.ts tests/agent-run-spine-db.test.ts tests/agent-run-projector.test.ts tests/agent-permission-grants.test.ts tests/orchestrator-runtime.test.ts tests/tool-runtime.test.ts tests/agent-context-loop.test.ts tests/main-runtime-wiring.test.ts tests/chat-history.test.ts tests/chat-blocks.test.ts
```

Expected: PASS.

- [ ] **Step 9.2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 9.3: Run lint on touched files**

Run:

```bash
bun node_modules/eslint/bin/eslint.js shared/agent-run-events.ts shared/agent-run-projector.ts desktop/src/main/agent/run-spine.ts desktop/src/main/agent/permission-service.ts desktop/src/main/agent/orchestrator.ts desktop/src/main/tools/runtime.ts desktop/src/main/runtime.ts desktop/src/main/ipc/agent.handler.ts tests/agent-run-contracts.test.ts tests/agent-run-spine-db.test.ts tests/agent-run-projector.test.ts tests/agent-permission-grants.test.ts tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts --max-warnings=0
```

Expected: PASS.

- [ ] **Step 9.4: Check whitespace and migration order**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 9.5: Write progress report**

Create `docs/progress/2026-07-10-local-agent-run-spine.md`:

```md
# Local Agent Run Spine Verification

Date: 2026-07-10

Implemented:

- Shared Agent Run Spine contracts and local-only guardrails.
- SQLite run events, artifacts, permission grants, and child task summaries.
- Pure run projector for chat turns, artifacts, task tree rows, and inspector state.
- Orchestrator event append and terminal artifact persistence.
- Persistent once/run/session approval grants for local Agent tools.
- `agent.getRun` snapshot/projection enrichment while keeping legacy fields.

Verification:

- `bun scripts/run-vitest.mjs run tests/agent-run-contracts.test.ts tests/agent-run-spine-db.test.ts tests/agent-run-projector.test.ts tests/agent-permission-grants.test.ts tests/orchestrator-runtime.test.ts tests/tool-runtime.test.ts tests/agent-context-loop.test.ts tests/main-runtime-wiring.test.ts tests/chat-history.test.ts tests/chat-blocks.test.ts`
- `bun run typecheck`
- `bun node_modules/eslint/bin/eslint.js shared/agent-run-events.ts shared/agent-run-projector.ts desktop/src/main/agent/run-spine.ts desktop/src/main/agent/permission-service.ts desktop/src/main/agent/orchestrator.ts desktop/src/main/tools/runtime.ts desktop/src/main/runtime.ts desktop/src/main/ipc/agent.handler.ts tests/agent-run-contracts.test.ts tests/agent-run-spine-db.test.ts tests/agent-run-projector.test.ts tests/agent-permission-grants.test.ts tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts --max-warnings=0`
- `git diff --check`

Remaining platform milestones:

- Shared Agent Workbench shell and inspector UI.
- Built-in specialist role registry and visible task tree execution.
- ContextPack source accountability, memory suggestions, and cited search artifacts.
```

- [ ] **Step 9.6: Commit verification report**

Run:

```bash
git add docs/progress/2026-07-10-local-agent-run-spine.md
git commit -m "docs: record local agent run spine verification"
```

## Self-Review

- Spec coverage for this milestone: R1 maps to Tasks 2, 3, 5, 6, and 8; R2 and INV-1 map to Task 4 and Task 8; R5 has storage/projection scaffolding in Tasks 1, 2, 3, and 4 without changing child execution; R6 and INV-2/INV-3 map to Task 7 and orchestrator approval coverage; R8 maps to projector inspector fields in Task 4; R9 maps to Tasks 1-9. R3, R4, and R7 remain protected by existing behavior and are not expanded in this first run-spine milestone.
- Placeholder scan: no task uses placeholder labels, deferred-work markers, copy-forward shortcuts, or generic error-handling instructions.
- Type consistency: `AgentRunSnapshot`, `AgentRunProjection`, `LocalPermissionGrant`, `PermissionGrantScope`, `AgentRunSpine`, and `projectAgentRunSnapshot` are introduced before later tasks reference them.
- Local-only scope: the plan does not introduce organization roles, multi-user workspaces, cloud sync, team memory, or centralized policy servers.
