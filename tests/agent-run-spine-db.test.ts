import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { spawnSubAgent, type ChildAgentRunInput } from '../desktop/src/main/agent/spawn-sub-agent'
import { createAgentRunSpine } from '../desktop/src/main/agent/run-spine'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentArtifactRepository } from '../desktop/src/main/db/repositories/agent-artifact.repo'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'
import { createAgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'
import { createAgentRunRepository } from '../desktop/src/main/db/repositories/agent-run.repo'
import { createChildAgentTaskRepository } from '../desktop/src/main/db/repositories/child-agent-task.repo'
import { AGENT_RUN_EVENT_TYPES } from '../shared/agent-run-events'
import type { AgentDefinition, SpawnSubAgentResult } from '../shared/agents'

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

async function withTempDbAsync<T>(run: (db: ReturnType<typeof openDatabaseAtPath>) => Promise<T>): Promise<T> {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-run-spine-db-'))
  const dbPath = join(tempDir, 'run-spine.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    return await run(db)
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
        'child_agent_tasks',
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
        'last_checkpoint',
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
        'idx_child_agent_tasks_parent',
      ]))
    })
  })

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

      runs.upsert({
        id: 'run-1',
        agentId: 'general-purpose',
        status: 'running',
        trace: { messageId: 'message-1', startedAt: 13 },
        createdAt: 99,
        updatedAt: 13
      })
      expect(runs.getById('run-1')).toMatchObject({
        threadId: 'thread-1',
        workflowId: 'default',
        messageId: 'message-1',
        trigger: 'canvasChat',
        policyProfileId: 'local-default',
        usage: { inputTokens: 0 },
        createdAt: 10,
        updatedAt: 13
      })
    })
  })

  it('decodes missing or malformed event payloads to a safe payload for the event type', () => {
    withTempDb((db) => {
      const events = createAgentRunEventRepository(db)

      events.append({
        id: 'event-null-payload',
        runId: 'run-invalid-payload',
        type: 'progress',
        payload: { message: 'Before corruption', progress: 10 },
        createdAt: 1
      })
      events.append({
        id: 'event-malformed-payload',
        runId: 'run-invalid-payload',
        type: 'progress',
        payload: { message: 'Before corruption', progress: 20 },
        createdAt: 2
      })
      db.prepare('UPDATE agent_run_events SET payload_json = ? WHERE id = ?')
        .run('null', 'event-null-payload')
      db.prepare('UPDATE agent_run_events SET payload_json = ? WHERE id = ?')
        .run('{malformed', 'event-malformed-payload')

      expect(events.listByRunId('run-invalid-payload').map((event) => event.payload)).toEqual([
        { message: 'Event payload unavailable.', progress: 0 },
        { message: 'Event payload unavailable.', progress: 0 }
      ])
    })
  })

  it('runtime-validates every event payload shape during replay', () => {
    withTempDb((db) => {
      const events = createAgentRunEventRepository(db)
      const invalidPayloads = ['{}', '"wrong primitive"', '{"status":"completed"}']
      const expectedFallbacks = [
        {
          threadId: 'unavailable',
          workflowId: 'unavailable',
          agentId: 'unavailable',
          trigger: 'manual',
          messageId: 'unavailable',
          policyProfileId: 'unavailable'
        },
        { status: 'running' },
        {
          kind: 'clarify',
          summary: 'Event payload unavailable.',
          requirements: [],
          missing: [],
          localCapabilities: [],
          recommendedAgentId: 'general-purpose',
          executionMode: 'clarify',
          complexity: 'low'
        },
        {
          contextPackId: 'unavailable',
          tokenEstimate: 0,
          messagesIncluded: 0,
          sourceCount: 0,
          redactionCount: 0
        },
        { message: 'Event payload unavailable.', progress: 0 },
        { delta: 'Event payload unavailable.' },
        {
          callId: 'unavailable',
          toolId: 'unavailable',
          inputSummary: 'Event payload unavailable.'
        },
        {
          callId: 'unavailable',
          toolId: 'unavailable',
          status: 'failed',
          summary: 'Event payload unavailable.'
        },
        {
          childTaskId: 'unavailable',
          roleId: 'unavailable',
          inputSummary: 'Event payload unavailable.',
          effectiveTools: []
        },
        {
          childTaskId: 'unavailable',
          roleId: 'unavailable',
          outputSummary: 'Event payload unavailable.',
          artifactIds: []
        },
        {
          childTaskId: 'unavailable',
          roleId: 'unavailable',
          errorClass: 'event_payload_unavailable',
          artifactIds: []
        },
        {
          callId: 'unavailable',
          toolId: 'unavailable',
          reason: 'Event payload unavailable.',
          requiredPermissions: []
        },
        {
          callId: 'unavailable',
          decision: 'denied',
          deniedByLabel: 'Event payload unavailable.'
        },
        {
          artifactId: 'unavailable',
          kind: 'diagnosticReport',
          title: 'Unavailable artifact',
          summary: 'Event payload unavailable.'
        },
        { messageId: 'unavailable', planId: 'unavailable' },
        {
          messageId: 'unavailable',
          response: {
            type: 'answer',
            summary: 'Event payload unavailable.',
            text: 'Event payload unavailable.',
            dropped: []
          }
        },
        { status: 'completed' },
        {
          errorClass: 'event_payload_unavailable',
          message: 'Event payload unavailable.',
          retryable: false
        }
      ]
      const insert = db.prepare(`
        INSERT INTO agent_run_events (id, run_id, sequence, type, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      AGENT_RUN_EVENT_TYPES.forEach((type, index) => {
        insert.run(
          `event-invalid-shape-${index}`,
          'run-invalid-shapes',
          index + 1,
          type,
          invalidPayloads[index % invalidPayloads.length],
          index + 1
        )
      })

      const replayed = events.listByRunId('run-invalid-shapes')

      expect(replayed.map((event) => event.type)).toEqual(AGENT_RUN_EVENT_TYPES)
      expect(replayed.map((event) => event.payload)).toEqual(expectedFallbacks)
    })
  })

  it('replays validated event payloads without prohibited extra fields', () => {
    withTempDb((db) => {
      const events = createAgentRunEventRepository(db)

      db.prepare(`
        INSERT INTO agent_run_events (id, run_id, sequence, type, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'event-extra-field',
        'run-extra-field',
        1,
        'progress',
        JSON.stringify({
          message: 'Still valid',
          progress: 50,
          prohibitedExtra: 'must not replay'
        }),
        1
      )

      expect(events.listByRunId('run-extra-field')).toEqual([
        expect.objectContaining({
          type: 'progress',
          payload: {
            message: 'Still valid',
            progress: 50
          }
        })
      ])
    })
  })

  it('skips persisted rows with unknown event types during replay', () => {
    withTempDb((db) => {
      const events = createAgentRunEventRepository(db)

      events.append({
        id: 'event-before-unknown',
        runId: 'run-unknown-event-type',
        type: 'run.started',
        payload: { status: 'running' },
        createdAt: 1
      })
      db.prepare(`
        INSERT INTO agent_run_events (id, run_id, sequence, type, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'event-unknown',
        'run-unknown-event-type',
        2,
        'provider.experimental',
        '{}',
        2
      )
      events.append({
        id: 'event-after-unknown',
        runId: 'run-unknown-event-type',
        type: 'run.completed',
        payload: { status: 'completed' },
        createdAt: 3
      })

      expect(events.listByRunId('run-unknown-event-type').map((event) => ({
        sequence: event.sequence,
        type: event.type
      }))).toEqual([
        { sequence: 1, type: 'run.started' },
        { sequence: 3, type: 'run.completed' }
      ])
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
      expect(grants.findActive({
        runId: 'run-other',
        workflowId: 'default',
        toolId: 'canvas.createNode',
        permissionKinds: ['canvas.write'],
        now: 30
      })).toBeNull()
      expect(children.listByParentRunId('run-1')).toEqual([
        expect.objectContaining({ id: 'child-1', roleId: 'canvas-planner', artifactIds: ['artifact-1'] })
      ])
    })
  })

  it('creates aggregate snapshots with events, artifacts, grants, and child tasks', () => {
    withTempDb((db) => {
      let idSequence = 0
      const spine = createAgentRunSpine({
        runs: createAgentRunRepository(db),
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-${++idSequence}`,
        clock: () => 100
      })

      spine.createRun({
        runId: 'run-service',
        threadId: 'thread-1',
        workflowId: 'default',
        messageId: 'message-service',
        jobId: 'job-1',
        agentId: 'general-purpose',
        trigger: 'canvasChat',
        policyProfileId: 'local-default'
      })
      spine.appendEvent('run-service', 'progress', { message: 'Thinking', progress: 10 })
      spine.saveArtifact({
        id: 'artifact-answer',
        runId: 'run-service',
        kind: 'answer',
        title: 'Answer',
        summary: 'Greeting',
        payload: { type: 'answer', summary: 'Greeting', text: '你好', dropped: [] },
        createdAt: 101
      })
      spine.savePermissionGrant({
        id: 'grant-service',
        runId: 'run-service',
        workflowId: 'default',
        toolId: 'canvas.createNode',
        permissionKinds: ['canvas.write'],
        scope: 'run',
        approvedByLabel: 'user-local',
        createdAt: 102
      })
      spine.upsertChildTask({
        id: 'child-service',
        parentRunId: 'run-service',
        roleId: 'qa-verifier',
        inputSummary: 'Verify plan',
        effectiveTools: [],
        status: 'completed',
        outputSummary: 'Looks valid',
        artifactIds: ['artifact-answer'],
        createdAt: 103,
        updatedAt: 104
      })

      const aggregate = spine.getSnapshot('run-service')

      expect(aggregate?.run).toMatchObject({
        id: 'run-service',
        status: 'pending',
        threadId: 'thread-1'
      })
      expect(aggregate?.events.map((event) => event.type)).toEqual([
        'run.created',
        'progress',
        'artifact.created'
      ])
      expect(aggregate?.artifacts).toHaveLength(1)
      expect(aggregate?.permissionGrants).toHaveLength(1)
      expect(aggregate?.childTasks).toHaveLength(1)
    })
  })

  it('redacts every durable event payload before persistence and snapshot replay', () => {
    withTempDb((db) => {
      let idSequence = 0
      const spine = createAgentRunSpine({
        runs: createAgentRunRepository(db),
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-redaction-${++idSequence}`,
        clock: () => 150
      })

      spine.createRun({
        runId: 'run-redaction',
        threadId: 'thread sk-proj-fakecredentialvalue1234567890',
        workflowId: '/Users/example/private/workflow.json',
        messageId: '<!-- hidden -->internal message id<!-- /hidden -->',
        agentId: 'general-purpose',
        trigger: 'manual',
        policyProfileId: 'local-default'
      })
      spine.appendEvent('run-redaction', 'response.ready', {
        messageId: 'message-redaction',
        response: {
          type: 'answer',
          summary: 'Bearer fake-auth-token-value',
          text: 'Read /Users/example/private/story.txt. <!-- hidden -->private prompt<!-- /hidden -->',
          dropped: []
        }
      })
      spine.saveArtifact({
        id: 'artifact-redaction',
        runId: 'run-redaction',
        kind: 'answer',
        title: 'Bearer fake-artifact-token-value',
        summary: 'From /Users/example/private/artifact.txt <!-- hidden -->artifact prompt<!-- /hidden -->',
        payload: { text: 'Artifact payload is outside the event metadata assertion.' },
        createdAt: 151
      })

      const persistedPayloads = db.prepare(`
        SELECT payload_json
        FROM agent_run_events
        WHERE run_id = ?
        ORDER BY sequence ASC
      `).all('run-redaction') as Array<{ payload_json: string }>
      const snapshotPayloads = spine.getSnapshot('run-redaction')?.events.map((event) => event.payload)
      const serialized = JSON.stringify({
        persistedPayloads,
        snapshotPayloads
      })

      expect(serialized).not.toContain('fakecredentialvalue1234567890')
      expect(serialized).not.toContain('fake-auth-token-value')
      expect(serialized).not.toContain('fake-artifact-token-value')
      expect(serialized).not.toContain('/Users/example/private')
      expect(serialized).not.toContain('internal message id')
      expect(serialized).not.toContain('private prompt')
      expect(serialized).not.toContain('artifact prompt')
      expect(serialized).toContain('[REDACTED_SECRET]')
      expect(serialized).toContain('[REDACTED_PATH]')
      expect(serialized).toContain('[REDACTED_HIDDEN_PROMPT]')

      const artifactEvent = spine.getSnapshot('run-redaction')?.events.find(
        (event) => event.type === 'artifact.created'
      )
      expect(artifactEvent?.payload).toMatchObject({
        title: '[REDACTED_SECRET]',
        summary: 'From [REDACTED_PATH] [REDACTED_HIDDEN_PROMPT]'
      })
    })
  })

  it('updates status, paused state, usage, and checkpoint metadata', () => {
    withTempDb((db) => {
      const spine = createAgentRunSpine({
        runs: createAgentRunRepository(db),
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        transaction: (operation) => db.transaction(operation)(),
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
        usage: { inputTokens: 12, outputTokens: 3 },
        errorClass: 'agent_tool_approval_required',
        lastCheckpoint: 'permission.requested'
      })

      expect(spine.getSnapshot('run-status')?.run).toMatchObject({
        status: 'approval_required',
        pausedState: { transition: 'approval_required', pendingToolCalls: [] },
        usage: { inputTokens: 12, outputTokens: 3 },
        errorClass: 'agent_tool_approval_required',
        lastCheckpoint: 'permission.requested'
      })
      spine.updateRun({
        runId: 'run-status',
        status: 'running',
        pausedState: null,
        errorClass: null,
        lastCheckpoint: null
      })
      expect(spine.getSnapshot('run-status')?.run).not.toHaveProperty('pausedState')
      expect(spine.getSnapshot('run-status')?.run).not.toHaveProperty('errorClass')
      expect(spine.getSnapshot('run-status')?.run).not.toHaveProperty('lastCheckpoint')
      expect(() => spine.appendEvent('run-missing', 'progress', {
        message: 'Should not persist',
        progress: 1
      })).toThrow('Agent run not found: run-missing')
    })
  })

  it('rolls back a denied approval when the terminal event ledger cannot be completed', () => {
    withTempDb((db) => {
      const eventIds = [
        'event-created',
        'event-permission-requested',
        'event-terminal-duplicate',
        'event-terminal-duplicate'
      ]
      const spine = createAgentRunSpine({
        runs: createAgentRunRepository(db),
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        idFactory: (prefix) => {
          const id = eventIds.shift()
          if (!id) {
            throw new Error(`Missing deterministic ${prefix} ID`)
          }
          return id
        },
        transaction: (operation) => db.transaction(operation)(),
        clock: () => 300
      })

      spine.createRun({
        runId: 'run-denial-rollback',
        threadId: 'thread-1',
        workflowId: 'default',
        messageId: 'message-denial-rollback',
        agentId: 'general-purpose',
        trigger: 'canvasChat',
        policyProfileId: 'local-default'
      })
      spine.updateRun({
        runId: 'run-denial-rollback',
        status: 'approval_required',
        pausedState: { transition: 'approval_required', pendingToolCalls: [{ id: 'call-1' }] },
        trace: { pendingApproval: { callId: 'call-1', toolId: 'canvas.deleteNode' } },
        errorClass: 'agent_tool_approval_required',
        lastCheckpoint: 'permission.requested'
      })
      spine.appendEvent('run-denial-rollback', 'permission.requested', {
        callId: 'call-1',
        toolId: 'canvas.deleteNode',
        reason: 'Deleting a node requires confirmation.',
        requiredPermissions: []
      })

      expect(() => spine.denyTool({
        runId: 'run-denial-rollback',
        callId: 'call-1',
        deniedByLabel: 'user-local',
        completedAt: 301
      })).toThrow(/UNIQUE constraint failed: agent_run_events\.id/)

      const snapshot = spine.getSnapshot('run-denial-rollback')
      expect(snapshot?.run).toMatchObject({
        status: 'approval_required',
        pausedState: { transition: 'approval_required' },
        errorClass: 'agent_tool_approval_required',
        lastCheckpoint: 'permission.requested'
      })
      expect(snapshot?.events.map((event) => event.type)).toEqual([
        'run.created',
        'permission.requested'
      ])
    })
  })

  it('persists nested child runs through depth two and rejects depth three without orphan rows', async () => {
    await withTempDbAsync(async (db) => {
      let eventSequence = 0
      let runSequence = 0
      const runs = createAgentRunRepository(db)
      const children = createChildAgentTaskRepository(db)
      const spine = createAgentRunSpine({
        runs,
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: children,
        transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-nested-${++eventSequence}`,
        clock: () => 500 + eventSequence
      })
      const role: AgentDefinition = {
        id: 'general-assistant',
        source: 'builtin',
        name: 'General Assistant',
        description: 'Delegates nested verification work.',
        instructions: 'Delegate safely.',
        allowedTools: ['agent.spawnChild'],
        allowedSkills: [],
        gatewayPolicy: { allowedChannels: ['text'] },
        contextPolicy: {
          includeCanvasGraph: false,
          includeSelectedAssets: false,
          includeRecentMessages: true,
          includeKnowledge: false,
          maxContextTokens: 4000
        },
        permissionPolicy: { allowedPermissionKinds: ['diagnostics'], requireAskForDestructive: true },
        triggerPolicy: { allowedTriggers: ['manual'], defaultTrigger: 'manual', autoRun: false },
        maxTurns: 4,
        effort: 'medium',
        enabled: true
      }
      const registry = { get: (roleId: string) => roleId === role.id ? role : null }
      const nestedResults: SpawnSubAgentResult[] = []

      spine.createRun({
        runId: 'run-root-nested',
        threadId: 'thread-nested',
        workflowId: 'workflow-nested',
        messageId: 'message-nested',
        agentId: 'general-assistant',
        trigger: 'canvasChat',
        policyProfileId: 'policy-nested',
        gatewayId: 'gateway-nested',
        modelId: 'model-nested'
      })
      spine.updateRun({ runId: 'run-root-nested', status: 'running', lastCheckpoint: 'run.started' })

      const runChild = async (child: ChildAgentRunInput) => {
        const nested = await spawnSubAgent(
          { roleId: 'general-assistant', task: `Nested from depth ${child.depth}.` },
          {
            parentRunId: child.runId,
            parentTraceId: child.traceId,
            allowedTools: child.allowedTools,
            allowedSkills: child.allowedSkills,
            depth: child.depth
          },
          {
            registry,
            runSpine: spine,
            idFactory: () => `run-child-depth-${++runSequence}`,
            runChild
          }
        )
        nestedResults.push(nested)
        return { output: `Completed depth ${child.depth}.`, status: 'completed' as const, turnsUsed: 1 }
      }

      const rootResult = await spawnSubAgent(
        { roleId: 'general-assistant', task: 'Start nested work.' },
        {
          parentRunId: 'run-root-nested',
          parentTraceId: 'trace-root-nested',
          allowedTools: ['agent.spawnChild'],
          allowedSkills: [],
          depth: 0
        },
        {
          registry,
          runSpine: spine,
          idFactory: () => `run-child-depth-${++runSequence}`,
          runChild
        }
      )

      expect(rootResult.status).toBe('completed')
      expect(nestedResults.map((result) => result.status)).toEqual(['failed', 'completed'])
      expect(nestedResults[0]?.error?.errorClass).toBe('agent_depth_exceeded')
      expect(runs.getById('run-child-depth-1')).toMatchObject({
        threadId: 'thread-nested',
        workflowId: 'workflow-nested',
        messageId: 'message-nested',
        policyProfileId: 'policy-nested',
        gatewayId: 'gateway-nested',
        modelId: 'model-nested',
        agentId: 'general-assistant',
        status: 'completed',
        lastCheckpoint: 'run.completed'
      })
      expect(runs.getById('run-child-depth-2')).toMatchObject({
        agentId: 'general-assistant',
        status: 'completed',
        lastCheckpoint: 'run.completed'
      })
      expect(runs.getById('run-child-depth-3')).toBeNull()
      expect(children.listByParentRunId('run-root-nested')).toEqual([
        expect.objectContaining({ id: 'run-child-depth-1', status: 'completed' })
      ])
      expect(children.listByParentRunId('run-child-depth-1')).toEqual([
        expect.objectContaining({ id: 'run-child-depth-2', status: 'completed' })
      ])
      expect(children.listByParentRunId('run-child-depth-2')).toEqual([])
      expect(spine.getSnapshot('run-child-depth-1')?.events.map((event) => event.type)).toEqual([
        'run.created',
        'run.started',
        'child.started',
        'child.completed',
        'run.completed'
      ])
    })
  })

  it('replays terminal child retries without rerunning or appending lifecycle events', async () => {
    await withTempDbAsync(async (db) => {
      let eventSequence = 0
      const runs = createAgentRunRepository(db)
      const events = createAgentRunEventRepository(db)
      const spine = createAgentRunSpine({
        runs,
        events,
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-retry-${++eventSequence}`,
        clock: (() => {
          let now = 900
          return () => now++
        })()
      })
      const role: AgentDefinition = {
        id: 'qa-verifier',
        source: 'builtin',
        name: 'QA Verifier',
        description: 'Verifies persisted results.',
        instructions: 'Verify once.',
        allowedTools: [],
        allowedSkills: [],
        gatewayPolicy: { allowedChannels: ['text'] },
        contextPolicy: {
          includeCanvasGraph: false,
          includeSelectedAssets: false,
          includeRecentMessages: true,
          includeKnowledge: false,
          maxContextTokens: 2000
        },
        permissionPolicy: { allowedPermissionKinds: ['diagnostics'], requireAskForDestructive: true },
        triggerPolicy: { allowedTriggers: ['manual'], defaultTrigger: 'manual', autoRun: false },
        maxTurns: 2,
        effort: 'low',
        enabled: true
      }
      const registry = { get: (roleId: string) => roleId === role.id ? role : null }
      const runChild = vi.fn(() => ({
        output: 'Durable verification result.',
        status: 'completed' as const,
        turnsUsed: 1,
        artifactIds: ['artifact-retry']
      }))

      spine.createRun({
        runId: 'run-retry-parent',
        threadId: 'thread-retry',
        workflowId: 'workflow-retry',
        messageId: 'message-retry',
        agentId: 'general-assistant',
        trigger: 'manual',
        policyProfileId: 'local-default'
      })
      spine.updateRun({ runId: 'run-retry-parent', status: 'running', lastCheckpoint: 'run.started' })
      const parent = {
        parentRunId: 'run-retry-parent',
        parentTraceId: 'trace-retry-parent',
        allowedTools: [] as string[],
        allowedSkills: [] as string[],
        depth: 0
      }
      const options = { registry, runSpine: spine, idFactory: () => 'run-retry-child', runChild }

      const first = await spawnSubAgent({ roleId: role.id, task: 'Verify persistence.' }, parent, options)
      const childEventsAfterFirst = events.listByRunId('run-retry-child').length
      const parentEventsAfterFirst = events.listByRunId('run-retry-parent').length
      const retry = await spawnSubAgent({ roleId: role.id, task: 'Verify persistence.' }, parent, options)

      expect(first).toMatchObject({ status: 'completed', output: 'Durable verification result.' })
      expect(retry).toMatchObject({
        roleId: role.id,
        status: 'completed',
        output: 'Durable verification result.',
        artifactIds: ['artifact-retry'],
        trace: { runId: 'run-retry-child', parentRunId: 'run-retry-parent' }
      })
      expect(runChild).toHaveBeenCalledTimes(1)
      expect(events.listByRunId('run-retry-child')).toHaveLength(childEventsAfterFirst)
      expect(events.listByRunId('run-retry-parent')).toHaveLength(parentEventsAfterFirst)
    })
  })

  it('returns a stable failure for nonterminal child retries without mutating SQLite', async () => {
    await withTempDbAsync(async (db) => {
      let eventSequence = 0
      const runs = createAgentRunRepository(db)
      const events = createAgentRunEventRepository(db)
      const children = createChildAgentTaskRepository(db)
      const spine = createAgentRunSpine({
        runs,
        events,
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: children,
        transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-conflict-${++eventSequence}`,
        clock: () => 1000
      })
      const role: AgentDefinition = {
        id: 'qa-verifier', source: 'builtin', name: 'QA Verifier', description: 'Verifies.', instructions: 'Verify.',
        allowedTools: [], allowedSkills: [], gatewayPolicy: { allowedChannels: ['text'] },
        contextPolicy: { includeCanvasGraph: false, includeSelectedAssets: false, includeRecentMessages: true, includeKnowledge: false, maxContextTokens: 2000 },
        permissionPolicy: { allowedPermissionKinds: ['diagnostics'], requireAskForDestructive: true },
        triggerPolicy: { allowedTriggers: ['manual'], defaultTrigger: 'manual', autoRun: false },
        maxTurns: 2, effort: 'low', enabled: true
      }
      spine.createRun({ runId: 'run-conflict-parent', threadId: 'thread-conflict', workflowId: 'workflow-conflict', messageId: 'message-conflict', agentId: 'general-assistant', trigger: 'manual', policyProfileId: 'local-default' })
      spine.createRun({ runId: 'run-conflict-child', threadId: 'thread-conflict', workflowId: 'workflow-conflict', messageId: 'message-conflict', agentId: role.id, trigger: 'manual', policyProfileId: 'local-default' })
      spine.updateRun({ runId: 'run-conflict-child', status: 'running', trace: { parentRunId: 'run-conflict-parent', parentTraceId: 'trace-conflict-parent', depth: 1 }, lastCheckpoint: 'run.started' })
      spine.appendEvent('run-conflict-child', 'run.started', { status: 'running' })
      children.upsert({ id: 'run-conflict-child', parentRunId: 'run-conflict-parent', roleId: role.id, inputSummary: 'Verify persistence.', effectiveTools: [], status: 'running', artifactIds: [], createdAt: 1000, updatedAt: 1000 })
      const runChild = vi.fn()
      const childEventsBefore = events.listByRunId('run-conflict-child').length
      const parentEventsBefore = events.listByRunId('run-conflict-parent').length

      const result = await spawnSubAgent(
        { roleId: role.id, task: 'Verify persistence.' },
        { parentRunId: 'run-conflict-parent', parentTraceId: 'trace-conflict-parent', allowedTools: [], allowedSkills: [], depth: 0 },
        { registry: { get: () => role }, runSpine: spine, idFactory: () => 'run-conflict-child', runChild }
      )

      expect(result).toMatchObject({ status: 'failed', error: { errorClass: 'agent_child_run_failed' } })
      expect(runChild).not.toHaveBeenCalled()
      expect(runs.getById('run-conflict-child')).toMatchObject({ status: 'running' })
      expect(events.listByRunId('run-conflict-child')).toHaveLength(childEventsBefore)
      expect(events.listByRunId('run-conflict-parent')).toHaveLength(parentEventsBefore)
    })
  })
})
