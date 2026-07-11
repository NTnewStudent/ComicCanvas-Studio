import { mkdtempSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { AgentDefinition } from '../shared/agents'
import { MAX_SPAWN_DEPTH } from '../shared/agents'
import type { AgentRunSpine } from '../desktop/src/main/agent/run-spine'
import { spawnSubAgent } from '../desktop/src/main/agent/spawn-sub-agent'
import { createAgentRunSpine } from '../desktop/src/main/agent/run-spine'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentArtifactRepository } from '../desktop/src/main/db/repositories/agent-artifact.repo'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'
import { createAgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'
import { createAgentRunRepository } from '../desktop/src/main/db/repositories/agent-run.repo'
import { createChildAgentTaskRepository } from '../desktop/src/main/db/repositories/child-agent-task.repo'

const canvasPlanner: AgentDefinition = {
  id: 'canvas-planner',
  source: 'builtin',
  name: 'Canvas Planner',
  description: 'Plans canvas work.',
  instructions: 'Use declarative plans only.',
  allowedTools: ['canvas.queryGraph', 'canvas.proposePlan'],
  allowedSkills: ['storyboard'],
  gatewayPolicy: { gatewayId: 'gateway-local', modelId: 'model-local', allowedChannels: ['text'] },
  contextPolicy: {
    includeCanvasGraph: true,
    includeSelectedAssets: true,
    includeRecentMessages: false,
    includeKnowledge: false,
    maxContextTokens: 6000
  },
  permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
  triggerPolicy: { allowedTriggers: ['manual'], defaultTrigger: 'manual', autoRun: false },
  maxTurns: 8,
  effort: 'high',
  enabled: true
}

const customAgent: AgentDefinition = { ...canvasPlanner, id: 'custom-planner', source: 'user' }

const registry = {
  get: vi.fn((roleId: string) => {
    if (roleId === canvasPlanner.id || roleId === 'canvas-orchestrator') return canvasPlanner
    if (roleId === customAgent.id) return customAgent
    return null
  })
}

const parentContext = {
  parentRunId: 'run-parent',
  parentTraceId: 'run-parent',
  allowedTools: ['canvas.queryGraph'],
  allowedSkills: ['storyboard'],
  depth: 0
}

const toolDescriptors = [
  {
    id: 'canvas.queryGraph', name: 'Query graph', description: '', category: 'canvas' as const,
    owner: { kind: 'builtin' as const, id: 'core' as const }, inputSchemaRef: 'in', outputSchemaRef: 'out',
    permissions: [{ kind: 'canvas.read' as const, reason: 'Read graph.' }], concurrency: 'readonly' as const, enabled: true
  },
  {
    id: 'canvas.proposePlan', name: 'Propose plan', description: '', category: 'canvas' as const,
    owner: { kind: 'builtin' as const, id: 'core' as const }, inputSchemaRef: 'in', outputSchemaRef: 'out',
    permissions: [{ kind: 'canvas.write' as const, reason: 'Write plan.' }], concurrency: 'serial-write' as const, enabled: true
  }
]

function createSpineRecorder(): {
  spine: Pick<AgentRunSpine, 'upsertChildTask' | 'appendEvent'>
  records: Parameters<AgentRunSpine['upsertChildTask']>[0][]
  events: Array<{ runId: string; type: string; payload: unknown }>
} {
  const records: Parameters<AgentRunSpine['upsertChildTask']>[0][] = []
  const events: Array<{ runId: string; type: string; payload: unknown }> = []
  return {
    records,
    events,
    spine: {
      upsertChildTask(record) {
        records.push(record)
        return record
      },
      appendEvent(runId, type, payload) {
        events.push({ runId, type, payload })
        return { id: `event-${events.length}`, runId, sequence: events.length, type, payload, createdAt: 1 }
      }
    }
  }
}

describe('Task 23 spawnSubAgent', () => {
  it('resolves a canonical built-in role and derives child instructions and policy from the registry', async () => {
    const persistence = createSpineRecorder()
    const clock = vi.fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(150)

    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Summarize token sk-123456789012345678901234 in the graph.' },
      parentContext,
      {
        registry,
        listTools: () => toolDescriptors,
        runSpine: persistence.spine,
        idFactory: () => 'child-1',
        clock,
        runChild(input) {
          expect(input).toMatchObject({
            runId: 'child-1',
            parentRunId: 'run-parent',
            role: {
              id: 'canvas-planner',
              instructions: 'Use declarative plans only.',
              maxTurns: 8,
              effort: 'high',
              permissionPolicy: canvasPlanner.permissionPolicy,
              gatewayPolicy: canvasPlanner.gatewayPolicy
            },
            task: 'Summarize token sk-123456789012345678901234 in the graph.',
            allowedTools: ['canvas.queryGraph'],
            allowedSkills: ['storyboard'],
            traceId: 'run-parent/child-1',
            parentTraceId: 'run-parent',
            depth: 1
          })
          return { output: 'Found one node.', status: 'completed', turnsUsed: 2, artifactIds: ['artifact-1'] }
        }
      }
    )

    expect(result).toMatchObject({
      roleId: 'canvas-planner',
      output: 'Found one node.',
      status: 'completed',
      turnsUsed: 2,
      effectiveTools: ['canvas.queryGraph'],
      artifactIds: ['artifact-1']
    })
    expect(persistence.records[0]?.inputSummary).toMatch(/^sha256:[a-f0-9]{64}$/u)
    expect(persistence.records[0]?.inputSummary).not.toContain('sk-123456789012345678901234')
    expect(persistence.records).toEqual([
      {
        id: 'child-1',
        parentRunId: 'run-parent',
        roleId: 'canvas-planner',
        inputSummary: persistence.records[0]?.inputSummary,
        effectiveTools: ['canvas.queryGraph'],
        status: 'running',
        artifactIds: [],
        createdAt: 100,
        updatedAt: 100
      },
      {
        id: 'child-1',
        parentRunId: 'run-parent',
        roleId: 'canvas-planner',
        inputSummary: persistence.records[0]?.inputSummary,
        effectiveTools: ['canvas.queryGraph'],
        status: 'completed',
        outputSummary: 'Found one node.',
        artifactIds: ['artifact-1'],
        createdAt: 100,
        updatedAt: 150
      }
    ])
    expect(persistence.events).toHaveLength(2)
    expect(persistence.events[0]).toMatchObject({ runId: 'run-parent', type: 'child.started' })
    expect(persistence.events[0]?.payload).toMatchObject({ childTaskId: 'child-1', roleId: 'canvas-planner' })
    expect(persistence.events[1]).toMatchObject({ runId: 'run-parent', type: 'child.completed' })
    expect(persistence.events[1]?.payload).toMatchObject({ childTaskId: 'child-1', artifactIds: ['artifact-1'] })
  })

  it.each([
    { parentTools: ['canvas.queryGraph'], expected: ['canvas.queryGraph'], label: 'removed by parent' },
    { parentTools: ['canvas.queryGraph', 'canvas.proposePlan'], expected: ['canvas.queryGraph'], label: 'permission outside child policy' },
    { parentTools: ['canvas.queryGraph', 'unknown.tool'], expected: ['canvas.queryGraph'], label: 'unknown descriptor' }
  ])('fails closed for tools $label', async ({ parentTools, expected }) => {
    const runChild = vi.fn(() => ({ output: 'ok', status: 'completed' as const, turnsUsed: 1 }))

    await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Narrow tools.' },
      { ...parentContext, allowedTools: parentTools },
      { registry, listTools: () => toolDescriptors, runChild }
    )

    expect(runChild).toHaveBeenCalledWith(expect.objectContaining({ allowedTools: expected }))
  })

  it.each([
    ['unknown role', 'missing-role'],
    ['custom role', 'custom-planner'],
    ['compatibility alias', 'canvas-orchestrator']
  ])('rejects %s IDs closed without running or persisting a child', async (_label, roleId) => {
    const persistence = createSpineRecorder()
    const runChild = vi.fn()

    const result = await spawnSubAgent(
      { roleId, task: 'Inspect the graph.' },
      parentContext,
      { registry, runSpine: persistence.spine, runChild }
    )

    expect(result).toMatchObject({
      roleId,
      status: 'failed',
      error: {
        errorClass: 'agent_role_not_spawnable',
        retryable: false
      }
    })
    expect(runChild).not.toHaveBeenCalled()
    expect(persistence.records).toEqual([])
    expect(persistence.events).toEqual([])
  })

  it('persists a failed child terminal update and event without throwing into the parent', async () => {
    const persistence = createSpineRecorder()
    const clock = vi.fn().mockReturnValueOnce(200).mockReturnValueOnce(250)

    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Inspect the graph.' },
      parentContext,
      {
        registry,
        runSpine: persistence.spine,
        idFactory: () => 'child-failed',
        clock,
        runChild() {
          throw new Error('provider secret detail')
        }
      }
    )

    expect(result).toMatchObject({
      roleId: 'canvas-planner',
      status: 'failed',
      output: '',
      error: {
        errorClass: 'agent_child_run_failed',
        message: 'Child agent run failed.',
        retryable: false
      }
    })
    expect(persistence.records.at(-1)).toMatchObject({
      id: 'child-failed',
      status: 'failed',
      errorClass: 'agent_child_run_failed',
      artifactIds: [],
      updatedAt: 250
    })
    expect(persistence.events.at(-1)).toMatchObject({ runId: 'run-parent', type: 'child.failed' })
    expect(persistence.events.at(-1)?.payload).toMatchObject({
      childTaskId: 'child-failed',
      roleId: 'canvas-planner',
      errorClass: 'agent_child_run_failed'
    })
  })

  it('preserves MAX_SPAWN_DEPTH without invoking the child runner', async () => {
    const runChild = vi.fn()
    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Go too deep.' },
      { ...parentContext, depth: MAX_SPAWN_DEPTH },
      { registry, runChild }
    )

    expect(result).toMatchObject({
      status: 'failed',
      error: { errorClass: 'agent_depth_exceeded' },
      trace: { depth: MAX_SPAWN_DEPTH + 1 }
    })
    expect(runChild).not.toHaveBeenCalled()
  })

  it('replays only a matching terminal request fingerprint and rejects task or capability conflicts without mutation', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-spawn-fingerprint-'))
    const dbPath = join(tempDir, 'run.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      let eventId = 0
      const events = createAgentRunEventRepository(db)
      const children = createChildAgentTaskRepository(db)
      const spine = createAgentRunSpine({
        runs: createAgentRunRepository(db), events, artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db), childTasks: children,
        transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-${++eventId}`, clock: () => 500
      })
      spine.createRun({
        runId: 'run-parent-fingerprint', threadId: 'thread', workflowId: 'workflow', messageId: 'message',
        agentId: 'general-assistant', trigger: 'manual', policyProfileId: 'local-default'
      })
      spine.updateRun({ runId: 'run-parent-fingerprint', status: 'running', lastCheckpoint: 'run.started' })
      const runChild = vi.fn(() => ({ output: 'done', status: 'completed' as const, turnsUsed: 1 }))
      const options = {
        registry, runSpine: spine, listTools: () => toolDescriptors,
        idFactory: () => 'run-child-fingerprint', runChild
      }
      const parent = { ...parentContext, parentRunId: 'run-parent-fingerprint', parentTraceId: 'trace-parent-fingerprint' }

      await spawnSubAgent({ roleId: 'canvas-planner', task: '  Verify   this graph.  ' }, parent, options)
      const childEvents = events.listByRunId('run-child-fingerprint').length
      const parentEvents = events.listByRunId('run-parent-fingerprint').length
      const matching = await spawnSubAgent({ roleId: 'canvas-planner', task: 'Verify this graph.' }, parent, options)
      const taskConflict = await spawnSubAgent({ roleId: 'canvas-planner', task: 'Verify another graph.' }, parent, options)
      const skillConflict = await spawnSubAgent(
        { roleId: 'canvas-planner', task: 'Verify this graph.' },
        { ...parent, allowedSkills: [] }, options
      )

      expect(matching.status).toBe('completed')
      expect(taskConflict.status).toBe('failed')
      expect(taskConflict.error?.errorClass).toBe('agent_child_run_failed')
      expect(skillConflict.status).toBe('failed')
      expect(skillConflict.error?.errorClass).toBe('agent_child_run_failed')
      expect(runChild).toHaveBeenCalledTimes(1)
      expect(events.listByRunId('run-child-fingerprint')).toHaveLength(childEvents)
      expect(events.listByRunId('run-parent-fingerprint')).toHaveLength(parentEvents)
      expect(children.listByParentRunId('run-parent-fingerprint')).toHaveLength(1)
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('claims a same-ID child atomically inside SQLite before either concurrent caller executes', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-spawn-claim-'))
    const dbPath = join(tempDir, 'spawn-claim.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      let eventId = 0
      const events = createAgentRunEventRepository(db)
      const spine = createAgentRunSpine({
        runs: createAgentRunRepository(db), events,
        artifacts: createAgentArtifactRepository(db), grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db), transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-claim-${++eventId}`, clock: () => 1000
      })
      spine.createRun({
        runId: 'run-claim-parent', threadId: 'thread-claim', workflowId: 'workflow-claim',
        messageId: 'message-claim', agentId: 'general-assistant', trigger: 'manual', policyProfileId: 'local-default'
      })
      let inTransaction = false
      const claimSpine: AgentRunSpine = {
        ...spine,
        transaction(operation) {
          inTransaction = true
          try { return spine.transaction(operation) } finally { inTransaction = false }
        },
        getSnapshot(runId) {
          if (runId === 'run-claim-child' && !inTransaction) return null
          return spine.getSnapshot(runId)
        }
      }
      let releaseFirst: (() => void) | undefined
      const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve })
      const runChild = vi.fn(async () => {
        if (runChild.mock.calls.length === 1) await firstBlocked
        return { output: 'claimed', status: 'completed' as const, turnsUsed: 1 }
      })
      const options = {
        registry, runSpine: claimSpine, listTools: () => toolDescriptors,
        idFactory: () => 'run-claim-child', runChild
      }
      const parent = { ...parentContext, parentRunId: 'run-claim-parent', parentTraceId: 'trace-claim-parent' }

      const first = spawnSubAgent({ roleId: canvasPlanner.id, task: 'Claim once.' }, parent, options)
      const second = await spawnSubAgent({ roleId: canvasPlanner.id, task: 'Claim once.' }, parent, options)
      releaseFirst?.()
      const winner = await first

      expect(winner.status).toBe('completed')
      expect(second).toMatchObject({ status: 'failed', error: { errorClass: 'agent_child_run_failed' } })
      expect(runChild).toHaveBeenCalledTimes(1)
      expect(events.listByRunId('run-claim-child').filter((event) => event.type === 'run.started')).toHaveLength(1)
      expect(events.listByRunId('run-claim-parent').filter((event) => event.type === 'child.started')).toHaveLength(1)
      expect(events.listByRunId('run-claim-child').filter((event) => event.type === 'run.failed')).toHaveLength(0)
      expect(events.listByRunId('run-claim-parent').filter((event) => event.type === 'child.failed')).toHaveLength(0)
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('does not reclaim a matching terminal child that appears inside the claim transaction', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-terminal-race-'))
    const dbPath = join(tempDir, 'terminal-race.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)
    try {
      const events = createAgentRunEventRepository(db)
      const children = createChildAgentTaskRepository(db)
      let eventId = 0
      const spine = createAgentRunSpine({
        runs: createAgentRunRepository(db), events,
        artifacts: createAgentArtifactRepository(db), grants: createAgentPermissionGrantRepository(db),
        childTasks: children, transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-race-${++eventId}`, clock: () => 3000
      })
      spine.createRun({ runId: 'run-race-parent', threadId: 'thread-race', workflowId: 'workflow-race',
        messageId: 'message-race', agentId: 'general-assistant', trigger: 'manual', policyProfileId: 'local-default' })
      let injected = false
      const racingSpine: AgentRunSpine = {
        ...spine,
        getSnapshot(runId) { return runId === 'run-race-child' && !injected ? null : spine.getSnapshot(runId) },
        transaction(operation) {
          if (!injected) {
            injected = true
            spine.createRun({ runId: 'run-race-child', threadId: 'thread-race', workflowId: 'workflow-race',
              messageId: 'message-race', agentId: canvasPlanner.id, trigger: 'manual', policyProfileId: 'local-default' })
            spine.updateRun({ runId: 'run-race-child', status: 'completed',
              trace: { parentRunId: 'run-race-parent', parentTraceId: 'trace-race-parent', depth: 1 }, lastCheckpoint: 'run.completed' })
            const fingerprint = `sha256:${createHash('sha256').update(JSON.stringify({
              task: 'Race terminal.', roleId: canvasPlanner.id,
              effectiveTools: ['canvas.queryGraph'], effectiveSkills: ['storyboard']
            })).digest('hex')}`
            spine.upsertChildTask({ id: 'run-race-child', parentRunId: 'run-race-parent', roleId: canvasPlanner.id,
              inputSummary: fingerprint, effectiveTools: ['canvas.queryGraph'], status: 'completed', outputSummary: 'cached',
              artifactIds: [], createdAt: 3000, updatedAt: 3000 })
          }
          return spine.transaction(operation)
        }
      }
      const runChild = vi.fn()
      const result = await spawnSubAgent({ roleId: canvasPlanner.id, task: 'Race terminal.' },
        { ...parentContext, parentRunId: 'run-race-parent', parentTraceId: 'trace-race-parent' },
        { registry, runSpine: racingSpine, listTools: () => toolDescriptors, idFactory: () => 'run-race-child', runChild })

      expect(result).toMatchObject({ status: 'completed', output: 'cached' })
      expect(runChild).not.toHaveBeenCalled()
      expect(events.listByRunId('run-race-child').map((event) => event.type)).toEqual(['run.created'])
      expect(events.listByRunId('run-race-parent')).toHaveLength(1)
    } finally { db.close(); rmSync(tempDir, { recursive: true, force: true }) }
  })

  it('persists child approval state without terminal failure events', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-child-approval-'))
    const dbPath = join(tempDir, 'child-approval.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      let eventId = 0
      const events = createAgentRunEventRepository(db)
      const children = createChildAgentTaskRepository(db)
      const spine = createAgentRunSpine({
        runs: createAgentRunRepository(db), events,
        artifacts: createAgentArtifactRepository(db), grants: createAgentPermissionGrantRepository(db),
        childTasks: children, transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-approval-${++eventId}`, clock: () => 2000
      })
      spine.createRun({
        runId: 'run-approval-parent', threadId: 'thread-approval', workflowId: 'workflow-approval',
        messageId: 'message-approval', agentId: 'general-assistant', trigger: 'manual', policyProfileId: 'local-default'
      })
      const pausedState = {
        agentId: canvasPlanner.id, trigger: 'manual' as const, turnCount: 1, maxTurns: 8,
        transition: 'approval_required' as const, systemPrompt: 'system', userMessage: 'Inspect.',
        allowedTools: [toolDescriptors[0]!], droppedTools: [], messages: [
          { role: 'assistant' as const, content: '', toolCalls: [{ id: 'call-child-paused', toolId: 'canvas.queryGraph', input: {} }] }
        ], tokenEstimate: 1, compactionSummary: null, omittedMessages: 0, pendingToolCalls: [], additionalContext: ''
      }
      const pendingApproval = {
        callId: 'call-child-paused', toolId: 'canvas.queryGraph', input: {}, reason: 'Approve child query.',
        requiredPermissions: [{ kind: 'canvas.read' as const, reason: 'Reads graph.' }]
      }

      const result = await spawnSubAgent(
        { roleId: canvasPlanner.id, task: 'Inspect.' },
        { ...parentContext, parentRunId: 'run-approval-parent', parentTraceId: 'trace-approval-parent' },
        {
          registry, runSpine: spine, listTools: () => toolDescriptors, idFactory: () => 'run-child-paused',
          runChild: () => ({ output: '', status: 'approval_required', turnsUsed: 1, pausedState, pendingApproval })
        }
      )

      expect(result).toMatchObject({ status: 'approval_required', pendingApproval: { callId: 'call-child-paused' } })
      expect(spine.getSnapshot('run-child-paused')?.run).toMatchObject({
        status: 'approval_required', pausedState: { transition: 'approval_required' },
        trace: { pendingApproval: { callId: 'call-child-paused' } }, lastCheckpoint: 'permission.requested'
      })
      expect(children.listByParentRunId('run-approval-parent')).toEqual([
        expect.objectContaining({ id: 'run-child-paused', status: 'approval_required' })
      ])
      expect(events.listByRunId('run-child-paused').map((event) => event.type)).toEqual([
        'run.created', 'run.started', 'permission.requested'
      ])
      expect(events.listByRunId('run-approval-parent').map((event) => event.type)).not.toContain('child.failed')
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
