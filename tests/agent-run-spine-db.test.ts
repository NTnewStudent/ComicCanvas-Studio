import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentArtifactRepository } from '../desktop/src/main/db/repositories/agent-artifact.repo'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'
import { createAgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'
import { createAgentRunRepository } from '../desktop/src/main/db/repositories/agent-run.repo'
import { createChildAgentTaskRepository } from '../desktop/src/main/db/repositories/child-agent-task.repo'

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
})
