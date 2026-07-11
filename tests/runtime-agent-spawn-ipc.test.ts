import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'
import { createAgentRunRepository } from '../desktop/src/main/db/repositories/agent-run.repo'
import { createChildAgentTaskRepository } from '../desktop/src/main/db/repositories/child-agent-task.repo'
import { createMainProcessRuntime, type MainProcessRuntime } from '../desktop/src/main/runtime'
import { createDefaultOrchestratorPlanner } from '../desktop/src/main/agent/orchestrator'
import type { SpawnSubAgentResult } from '../shared/agents'
import type { ChildAgentRunInput, ChildAgentRunResult } from '../desktop/src/main/agent/spawn-sub-agent'
import type { AgentContextLoopState, AgentToolApprovalRequest } from '../desktop/src/main/agent/context-loop'

type Handler = (_event: unknown, request: unknown) => unknown

describe('standalone agent.spawn runtime persistence', () => {
  let runtime: MainProcessRuntime | null = null
  let tempDir = ''

  afterEach(() => {
    runtime?.close()
    runtime = null
    if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  })

  function createFixture(runChild?: (input: ChildAgentRunInput) => Promise<ChildAgentRunResult> | ChildAgentRunResult) {
    tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agent-spawn-ipc-'))
    const dbPath = join(tempDir, 'runtime.sqlite')
    const handlers = new Map<string, Handler>()
    const defaultPlanner = createDefaultOrchestratorPlanner()
    runtime = createMainProcessRuntime({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
      dbPath,
      assetRoot: join(tempDir, 'assets'),
      getWindows: () => [],
      ...(runChild ? { childAgentRunner: runChild } : {}),
      planner: {
        proposePlan: (input) => defaultPlanner.proposePlan(input),
        resumeApprovedTool: () => ({
          type: 'answer', summary: 'Approved graph inspection completed.',
          text: 'Approved graph inspection completed.', dropped: []
        })
      },
      clock: (() => {
        let now = 2000
        return () => now++
      })()
    })
    return { dbPath, handlers }
  }

  function approvalPausedChild(input: ChildAgentRunInput): ChildAgentRunResult {
    const pendingApproval: AgentToolApprovalRequest = {
      callId: 'call-child-ipc', toolId: 'canvas.queryGraph', input: {},
      reason: 'Inspecting this graph requires approval.',
      requiredPermissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }]
    }
    const pausedState: AgentContextLoopState = {
      agentId: input.role.id, trigger: 'manual', turnCount: 1, maxTurns: input.role.maxTurns,
      transition: 'approval_required', systemPrompt: 'durable only', userMessage: input.task,
      allowedTools: [{
        id: 'canvas.queryGraph', name: 'Query Canvas Graph', description: 'Reads the graph.',
        category: 'canvas', owner: { kind: 'builtin', id: 'core' },
        inputSchemaRef: 'canvas.queryGraph.input', outputSchemaRef: 'canvas.graph.output',
        permissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }], concurrency: 'readonly', enabled: true
      }],
      droppedTools: [],
      messages: [
        { role: 'system', content: 'durable only' },
        { role: 'user', content: input.task },
        { role: 'assistant', content: '', toolCalls: [{ id: pendingApproval.callId, toolId: pendingApproval.toolId, input: {} }] }
      ],
      tokenEstimate: 20, compactionSummary: null, omittedMessages: 0,
      pendingToolCalls: [], additionalContext: ''
    }
    return { output: '', status: 'approval_required', turnsUsed: 1, pausedState, pendingApproval }
  }

  it('creates and terminally completes a durable synthetic root before persisting its child', async () => {
    const { dbPath, handlers } = createFixture()
    const result = await handlers.get('agent.spawn')?.({}, { roleId: 'qa-verifier', task: 'Verify the local graph.' }) as SpawnSubAgentResult
    const db = openDatabaseAtPath(dbPath)

    try {
      const runs = createAgentRunRepository(db)
      const events = createAgentRunEventRepository(db)
      const children = createChildAgentTaskRepository(db)
      const parentRunId = result.trace.parentRunId

      expect(result.status).toBe('completed')
      expect(runs.getById(parentRunId)).toMatchObject({
        agentId: 'general-assistant',
        status: 'completed',
        trigger: 'manual',
        workflowId: 'default',
        policyProfileId: 'local-default',
        lastCheckpoint: 'run.completed'
      })
      expect(events.listByRunId(parentRunId).map((event) => event.type)).toEqual([
        'run.created', 'run.started', 'child.started', 'child.completed', 'run.completed'
      ])
      expect(children.listByParentRunId(parentRunId)).toEqual([
        expect.objectContaining({ id: result.trace.runId, status: 'completed' })
      ])
    } finally {
      db.close()
    }
  })

  it('rejects a non-canonical role before creating a synthetic root', async () => {
    const { dbPath, handlers } = createFixture()
    const result = await handlers.get('agent.spawn')?.({}, { roleId: 'not-a-role', task: 'Do not spawn.' })
    const db = openDatabaseAtPath(dbPath)

    try {
      const rows = db.prepare('SELECT * FROM agent_runs ORDER BY created_at').all() as Array<{ id: string }>

      expect(result).toEqual({
        errorClass: 'agent_invalid_request', message: 'Invalid agent.spawn request.', retryable: false
      })
      expect(rows).toEqual([])
    } finally {
      db.close()
    }
  })

  it('keeps an approval-paused child as the target without failing the synthetic root', async () => {
    const { dbPath, handlers } = createFixture((input) => ({
      output: '', status: 'approval_required', turnsUsed: 1,
      pausedState: {
        agentId: input.role.id, trigger: 'manual', turnCount: 1, maxTurns: 4,
        transition: 'approval_required', systemPrompt: 'durable only', userMessage: input.task,
        allowedTools: [], droppedTools: [], messages: [], tokenEstimate: 0,
        compactionSummary: null, omittedMessages: 0, pendingToolCalls: [], additionalContext: ''
      },
      pendingApproval: {
        callId: 'call-child-ipc', toolId: 'canvas.queryGraph', input: { nodeId: 'node-9' },
        reason: 'Inspecting this node requires approval.',
        requiredPermissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }]
      }
    }))
    const result = await handlers.get('agent.spawn')?.({}, { roleId: 'qa-verifier', task: 'Inspect node 9.' }) as SpawnSubAgentResult
    const db = openDatabaseAtPath(dbPath)

    try {
      const runs = createAgentRunRepository(db)
      const events = createAgentRunEventRepository(db)
      const parentRunId = result.trace.parentRunId
      const childRunId = result.trace.runId

      expect(result).toMatchObject({
        status: 'approval_required', trace: { runId: childRunId },
        pendingApproval: { callId: 'call-child-ipc' }
      })
      expect(runs.getById(parentRunId)).toMatchObject({
        status: 'approval_required', lastCheckpoint: 'permission.requested',
        trace: { childRunId, pendingApproval: { callId: 'call-child-ipc', toolId: 'canvas.queryGraph' } }
      })
      expect(events.listByRunId(parentRunId).map((event) => event.type)).toEqual([
        'run.created', 'run.started', 'child.started', 'permission.requested'
      ])
      expect(events.listByRunId(parentRunId).some((event) => event.type === 'run.failed')).toBe(false)
      expect(runs.getById(childRunId)).toMatchObject({ status: 'approval_required', lastCheckpoint: 'permission.requested' })
    } finally {
      db.close()
    }
  })

  it('approves a paused child through the synthetic root and mirrors each terminal fact once', async () => {
    const { dbPath, handlers } = createFixture(approvalPausedChild)
    const spawned = await handlers.get('agent.spawn')?.({}, { roleId: 'qa-verifier', task: 'Inspect the graph.' }) as SpawnSubAgentResult
    const approved = await handlers.get('agent.approveTool')?.({}, {
      runId: spawned.trace.parentRunId, callId: 'call-child-ipc', approvedBy: 'user-local', scope: 'session'
    }) as { status?: string }
    expect(approved.status).toBe('pending')
    await runtime?.drainJobsForTests()
    await runtime?.waitForIdleForTests()

    const repeated = await handlers.get('agent.approveTool')?.({}, {
      runId: spawned.trace.parentRunId, callId: 'call-child-ipc', approvedBy: 'user-local', scope: 'session'
    })
    const db = openDatabaseAtPath(dbPath)
    try {
      const runs = createAgentRunRepository(db)
      const events = createAgentRunEventRepository(db)
      const children = createChildAgentTaskRepository(db)
      const rootEvents = events.listByRunId(spawned.trace.parentRunId).map((event) => event.type)

      expect(runs.getById(spawned.trace.parentRunId)).toMatchObject({ status: 'completed' })
      expect(runs.getById(spawned.trace.parentRunId)?.pausedState).toBeUndefined()
      expect(runs.getById(spawned.trace.runId)).toMatchObject({ status: 'completed' })
      expect(runs.getById(spawned.trace.runId)?.pausedState).toBeUndefined()
      expect(children.listByParentRunId(spawned.trace.parentRunId)).toEqual([
        expect.objectContaining({ id: spawned.trace.runId, status: 'completed' })
      ])
      expect(rootEvents.filter((type) => type === 'permission.resolved')).toHaveLength(1)
      expect(rootEvents.filter((type) => type === 'child.completed')).toHaveLength(1)
      expect(rootEvents.filter((type) => type === 'run.completed')).toHaveLength(1)
      expect(repeated).toEqual(expect.objectContaining({ errorClass: 'agent_approval_unavailable', retryable: false }))
    } finally {
      db.close()
    }
  })

  it('denies a paused child through the synthetic root without duplicate terminal events', async () => {
    const { dbPath, handlers } = createFixture(approvalPausedChild)
    const spawned = await handlers.get('agent.spawn')?.({}, { roleId: 'qa-verifier', task: 'Inspect the graph.' }) as SpawnSubAgentResult
    const request = { runId: spawned.trace.parentRunId, callId: 'call-child-ipc', deniedBy: 'user-local' }
    const denied = await handlers.get('agent.denyTool')?.({}, request)
    const repeated = await handlers.get('agent.denyTool')?.({}, request)
    const db = openDatabaseAtPath(dbPath)
    try {
      const runs = createAgentRunRepository(db)
      const events = createAgentRunEventRepository(db)
      const children = createChildAgentTaskRepository(db)
      const rootEvents = events.listByRunId(spawned.trace.parentRunId).map((event) => event.type)

      expect(denied).toMatchObject({ runId: spawned.trace.runId, status: 'aborted', errorClass: 'agent_tool_denied' })
      expect(repeated).toMatchObject({ runId: spawned.trace.runId, status: 'aborted', errorClass: 'agent_tool_denied' })
      expect(runs.getById(spawned.trace.parentRunId)).toMatchObject({ status: 'aborted' })
      expect(runs.getById(spawned.trace.parentRunId)?.pausedState).toBeUndefined()
      expect(runs.getById(spawned.trace.runId)).toMatchObject({ status: 'aborted' })
      expect(runs.getById(spawned.trace.runId)?.pausedState).toBeUndefined()
      expect(children.listByParentRunId(spawned.trace.parentRunId)).toEqual([
        expect.objectContaining({ id: spawned.trace.runId, status: 'aborted' })
      ])
      expect(rootEvents.filter((type) => type === 'permission.resolved')).toHaveLength(1)
      expect(rootEvents.filter((type) => type === 'child.failed')).toHaveLength(1)
      expect(rootEvents.filter((type) => type === 'run.failed')).toHaveLength(1)
    } finally {
      db.close()
    }
  })

  it('repairs a denied child and synthetic root after reconciliation persistence fails', async () => {
    const { dbPath, handlers } = createFixture(approvalPausedChild)
    const spawned = await handlers.get('agent.spawn')?.({}, { roleId: 'qa-verifier', task: 'Inspect the graph.' }) as SpawnSubAgentResult
    const db = openDatabaseAtPath(dbPath)
    const rootRunId = spawned.trace.parentRunId
    const request = { runId: rootRunId, callId: 'call-child-ipc', deniedBy: 'user-local' }

    db.exec(`CREATE TRIGGER fail_root_reconciliation BEFORE INSERT ON agent_run_events
      WHEN NEW.run_id = '${rootRunId}' AND NEW.type = 'permission.resolved'
      BEGIN SELECT RAISE(ABORT, 'injected root reconciliation failure'); END`)
    expect(() => handlers.get('agent.denyTool')?.({}, request)).toThrow('injected root reconciliation failure')
    db.exec('DROP TRIGGER fail_root_reconciliation')

    expect(await handlers.get('agent.denyTool')?.({}, request)).toMatchObject({
      runId: spawned.trace.runId, status: 'aborted', errorClass: 'agent_tool_denied'
    })

    const runs = createAgentRunRepository(db)
    const events = createAgentRunEventRepository(db)
    const children = createChildAgentTaskRepository(db)
    const rootEvents = events.listByRunId(rootRunId).map((event) => event.type)
    expect(runs.getById(rootRunId)).toMatchObject({ status: 'aborted', lastCheckpoint: 'run.failed' })
    expect(children.listByParentRunId(rootRunId)).toEqual([
      expect.objectContaining({ id: spawned.trace.runId, status: 'aborted' })
    ])
    expect(rootEvents.filter((type) => type === 'permission.resolved')).toHaveLength(1)
    expect(rootEvents.filter((type) => type === 'child.failed')).toHaveLength(1)
    expect(rootEvents.filter((type) => type === 'run.failed')).toHaveLength(1)
    db.close()
  })

  it('repairs an approved child and synthetic root after queued reconciliation persistence fails', async () => {
    const { dbPath, handlers } = createFixture(approvalPausedChild)
    const spawned = await handlers.get('agent.spawn')?.({}, { roleId: 'qa-verifier', task: 'Inspect the graph.' }) as SpawnSubAgentResult
    const db = openDatabaseAtPath(dbPath)
    const rootRunId = spawned.trace.parentRunId
    const request = { runId: rootRunId, callId: 'call-child-ipc', approvedBy: 'user-local', scope: 'session' as const }

    db.exec(`CREATE TRIGGER fail_root_reconciliation BEFORE INSERT ON agent_run_events
      WHEN NEW.run_id = '${rootRunId}' AND NEW.type = 'permission.resolved'
      BEGIN SELECT RAISE(ABORT, 'injected root reconciliation failure'); END`)
    expect(() => handlers.get('agent.approveTool')?.({}, request)).toThrow('injected root reconciliation failure')
    db.exec('DROP TRIGGER fail_root_reconciliation')

    expect(await handlers.get('agent.approveTool')?.({}, request)).toMatchObject({
      runId: spawned.trace.runId, status: 'pending'
    })
    await runtime?.drainJobsForTests()
    await runtime?.waitForIdleForTests()

    const runs = createAgentRunRepository(db)
    const events = createAgentRunEventRepository(db)
    const children = createChildAgentTaskRepository(db)
    const rootEvents = events.listByRunId(rootRunId).map((event) => event.type)
    expect(runs.getById(rootRunId)).toMatchObject({ status: 'completed', lastCheckpoint: 'run.completed' })
    expect(children.listByParentRunId(rootRunId)).toEqual([
      expect.objectContaining({ id: spawned.trace.runId, status: 'completed' })
    ])
    expect(rootEvents.filter((type) => type === 'permission.resolved')).toHaveLength(1)
    expect(rootEvents.filter((type) => type === 'child.completed')).toHaveLength(1)
    expect(rootEvents.filter((type) => type === 'run.completed')).toHaveLength(1)
    db.close()
  })
})
