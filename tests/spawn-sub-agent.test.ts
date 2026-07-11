import { mkdtempSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { AgentDefinition } from '../shared/agents'
import { MAX_SPAWN_DEPTH } from '../shared/agents'
import type { AgentRunSpine } from '../desktop/src/main/agent/run-spine'
import type { ChildAgentRunResult } from '../desktop/src/main/agent/spawn-sub-agent'
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
  it('normalizes untrusted child canvas artifacts into new safe allowlisted payloads', async () => {
    const persistence = createSpineRecorder()
    const saved: Array<{ title: string; summary: string; payload: unknown }> = []
    const originalPlan = {
      kind: 'plan', summary: 'Plan <script>alert(1)</script> token=sk-123456789012345678901234', question: null,
      nodes: [{ ref: 'node-1', type: 'text', title: 'Title require("fs")', data: {
        prompt: 'Use /Users/private/secret.png', image: 'data:image/png;base64,AAAA', apiToken: 'top-secret', safe: 'keep'
      }, extraNodeSecret: 'leak' }],
      edges: [], runSteps: [], dropped: [], extraPayloadSecret: 'leak'
    }
    const originalGraph = {
      graph: {
        nodes: [
          { id: 'text<script>x</script>-1', type: 'text', title: '/Users/private/title', position: { x: 0, y: 0 },
            data: { label: 'Prompt eval(bad)', safe: 'keep', binary: 'data:image/png;base64,AAAA' }, extra: 'leak' },
          { id: 'image-1', type: 'image', position: { x: 20, y: 20 }, data: { label: 'Image' } }
        ],
        edges: [
          { id: 'edge<script>x</script>-1', source: 'text<script>x</script>-1', target: 'image-1', type: 'default', data: { hidden: 'leak' } }
        ],
        viewport: { x: 0, y: 0, zoom: 1, secret: 'leak' }, extraGraphSecret: 'leak'
      },
      lineage: { parentRunId: 'run-parent<script>x</script>', childRunId: 'child-normalize', traceId: 'trace/root eval(bad)', extra: 'leak' },
      warnings: ['warn /Users/private/file', 'warn <script>x</script>'], dropped: ['drop token=sk-123456789012345678901234'],
      extraPayloadSecret: 'leak'
    }

    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Normalize.' }, parentContext,
      {
        registry, idFactory: () => 'child-normalize',
        runSpine: { ...persistence.spine, saveArtifact(record) { saved.push(record); return record } },
        runChild: () => ({ output: 'done', status: 'completed', turnsUsed: 1, artifactDrafts: [
          { kind: 'canvasPlan', title: 'Plan /Users/private <script>x</script>', summary: 'Summary sk-123456789012345678901234', payload: originalPlan },
          { kind: 'draftGraph', title: 'Graph eval(bad)', summary: 'Graph /Users/private', payload: originalGraph }
        ] } as unknown as ChildAgentRunResult)
      }
    )

    expect(result.status).toBe('completed')
    expect(saved).toHaveLength(2)
    expect(saved[0]?.payload).not.toBe(originalPlan)
    expect(saved[1]?.payload).not.toBe(originalGraph)
    expect(saved[0]?.payload).toMatchObject({ nodes: [{ data: { safe: 'keep' } }] })
    expect(saved[1]?.payload).toMatchObject({
      graph: { nodes: expect.arrayContaining([expect.objectContaining({ id: 'text-1', type: 'text' })]), viewport: { x: 0, y: 0, zoom: 1 } },
      lineage: { parentRunId: 'run-parent', childRunId: 'child-normalize', traceId: 'run-parent/child-normalize' }
    })
    expect(JSON.stringify(saved)).not.toMatch(/Users|base64|sk-123|<script|eval\(|require\(|extraPayloadSecret|extraGraphSecret|extraNodeSecret|hidden|"shell"/u)
    expect((saved[1]?.payload as { graph: { nodes: unknown[]; edges: unknown[] } }).graph.nodes).toHaveLength(2)
    expect((saved[1]?.payload as { graph: { nodes: unknown[]; edges: unknown[] } }).graph.edges).toHaveLength(1)
  })

  it.each(['failed', 'approval_required'] as const)('drops spoofed artifact IDs for %s children', async (status) => {
    const persistence = createSpineRecorder()
    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Do not trust IDs.' }, parentContext,
      {
        registry, runSpine: persistence.spine, idFactory: () => `child-spoof-${status}`,
        runChild: () => ({ output: status, status, turnsUsed: 1, artifactIds: ['artifact-unrelated'],
          ...(status === 'approval_required' ? {
            pausedState: {
              agentId: 'canvas-planner', trigger: 'manual', turnCount: 1, maxTurns: 8,
              transition: 'approval_required', systemPrompt: '', userMessage: '', allowedTools: [], droppedTools: [],
              messages: [], tokenEstimate: 0, compactionSummary: null, omittedMessages: 0, pendingToolCalls: [], additionalContext: ''
            },
            pendingApproval: { callId: 'call', toolId: 'tool', input: {}, reason: 'reason', requiredPermissions: [] }
          } : {}) } as ChildAgentRunResult)
      }
    )

    expect(result.artifactIds).toEqual([])
    expect(persistence.records.at(-1)?.artifactIds).toEqual([])
  })

  it('drops spoofed completed artifact IDs when persistence cannot prove child ownership', async () => {
    const persistence = createSpineRecorder()
    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Verify IDs.' }, parentContext,
      { registry, runSpine: persistence.spine, idFactory: () => 'child-spoof-completed',
        runChild: () => ({ output: 'done', status: 'completed', turnsUsed: 1, artifactIds: ['artifact-unrelated'] }) }
    )

    expect(result.artifactIds).toEqual([])
    expect(persistence.events.at(-1)).toMatchObject({ type: 'child.completed', payload: { artifactIds: [] } })
  })

  it('saves deterministic child artifact drafts before linking the terminal task and event', async () => {
    const persistence = createSpineRecorder()
    const order: string[] = []
    const saved: Array<{ id: string; runId: string; kind: string }> = []
    const originalUpsert = persistence.spine.upsertChildTask
    const runSpine = {
      ...persistence.spine,
      saveArtifact(record: { id: string; runId: string; kind: 'canvasPlan'; title: string; summary: string; payload: unknown; createdAt: number }) {
        order.push(`artifact:${record.id}`)
        saved.push(record)
        return record
      },
      upsertChildTask(record: Parameters<AgentRunSpine['upsertChildTask']>[0]) {
        if (record.status === 'completed') order.push(`task:${record.artifactIds.join(',')}`)
        return originalUpsert(record)
      }
    }

    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Plan.' }, parentContext,
      {
        registry, runSpine, listTools: () => toolDescriptors, idFactory: () => 'child-artifacts', clock: () => 50,
        runChild: () => ({ output: 'planned', status: 'completed', turnsUsed: 1, artifactDrafts: [{
          kind: 'canvasPlan', title: 'Child CanvasPlan', summary: 'planned', payload: {
            kind: 'plan', summary: 'planned', question: null, nodes: [], edges: [], runSteps: [], dropped: []
          }
        }] })
      }
    )

    expect(saved).toEqual([expect.objectContaining({
      id: 'child-artifacts:artifact:canvasPlan', runId: 'child-artifacts', kind: 'canvasPlan'
    })])
    expect(result.artifactIds).toEqual(['child-artifacts:artifact:canvasPlan'])
    expect(order).toEqual(['artifact:child-artifacts:artifact:canvasPlan', 'task:child-artifacts:artifact:canvasPlan'])
    expect(persistence.events.at(-1)).toMatchObject({
      type: 'child.completed', payload: { artifactIds: ['child-artifacts:artifact:canvasPlan'] }
    })
  })

  it.each(['failed', 'approval_required'] as const)('does not publish draft artifacts for a %s child run', async (status) => {
    const persistence = createSpineRecorder()
    const saveArtifact = vi.fn()
    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Draft without publishing.' }, parentContext,
      {
        registry, runSpine: { ...persistence.spine, saveArtifact }, idFactory: () => `child-${status}`,
        runChild: () => ({
          output: status, status, turnsUsed: 1,
          ...(status === 'approval_required' ? {
            pausedState: { runId: `child-${status}`, turn: 1, messages: [], toolResults: [] },
            pendingApproval: {
              callId: 'call-approval', toolId: 'canvas.proposePlan', reason: 'Approve.',
              requiredPermissions: [{ kind: 'canvas.write', reason: 'Write.' }]
            }
          } : {}),
          artifactDrafts: [{
            kind: 'canvasPlan', title: 'Premature plan', summary: 'must not persist',
            payload: { kind: 'plan', summary: 'draft', question: null, nodes: [], edges: [], runSteps: [], dropped: [] }
          }]
        } as unknown as ChildAgentRunResult)
      }
    )

    expect(result.artifactIds).toEqual([])
    expect(saveArtifact).not.toHaveBeenCalled()
    expect(persistence.events.some((event) => event.type === 'artifact.created')).toBe(false)
  })

  it.each([
    { kind: 'unknown', title: 'Unknown', summary: 'Unknown', payload: {} },
    { kind: 'canvasPlan', title: 'Plan', summary: 'Plan', payload: { kind: 'plan', nodes: 'invalid' } },
    { kind: 'draftGraph', title: 'Graph', summary: 'Graph', payload: { graph: { nodes: [], edges: 'invalid' } } }
  ])('fails closed without persistence for malformed $kind artifact drafts', async (artifactDraft) => {
    const persistence = createSpineRecorder()
    const saveArtifact = vi.fn()
    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Return malformed draft.' }, parentContext,
      {
        registry, runSpine: { ...persistence.spine, saveArtifact }, idFactory: () => `child-malformed-${artifactDraft.kind}`,
        runChild: () => ({
          output: 'bad draft', status: 'completed', turnsUsed: 1, artifactDrafts: [artifactDraft]
        } as unknown as ChildAgentRunResult)
      }
    )

    expect(result).toMatchObject({ status: 'failed', error: { errorClass: 'agent_child_run_failed' } })
    expect(saveArtifact).not.toHaveBeenCalled()
    expect(persistence.records.some((record) => record.status === 'completed')).toBe(false)
  })

  it.each([
    {
      kind: 'canvasPlan',
      payload: {
        kind: 'plan', summary: 'Unsafe action.', question: null,
        nodes: [{ ref: 'text-1', type: 'text', title: 'Prompt', data: { content: 'safe' } }],
        edges: [], runSteps: [{ ref: 'text-1', action: 'shell' }], dropped: []
      }
    },
    {
      kind: 'draftGraph',
      payload: {
        graph: {
          nodes: [{ id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'safe' } }],
          edges: [], viewport: { x: 0, y: 0, zoom: Number.POSITIVE_INFINITY }
        },
        lineage: { parentRunId: 'spoofed-parent', childRunId: 'spoofed-child', traceId: 'spoofed-trace' }, warnings: []
      }
    }
  ])('rejects structurally invalid $kind child artifacts instead of repairing and publishing them', async (draft) => {
    const persistence = createSpineRecorder()
    const saveArtifact = vi.fn()
    const result = await spawnSubAgent(
      { roleId: 'canvas-planner', task: 'Return invalid proposal.' }, parentContext,
      {
        registry, runSpine: { ...persistence.spine, saveArtifact }, idFactory: () => `child-invalid-${draft.kind}`,
        runChild: () => ({
          output: 'invalid proposal', status: 'completed', turnsUsed: 1,
          artifactDrafts: [{ ...draft, title: 'Invalid proposal', summary: 'Must fail closed.' }]
        } as unknown as ChildAgentRunResult)
      }
    )

    expect(result).toMatchObject({ status: 'failed', error: { errorClass: 'agent_child_run_failed' } })
    expect(saveArtifact).not.toHaveBeenCalled()
    expect(persistence.records.some((record) => record.status === 'completed')).toBe(false)
  })

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
      artifactIds: []
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
        artifactIds: [],
        createdAt: 100,
        updatedAt: 150
      }
    ])
    expect(persistence.events).toHaveLength(2)
    expect(persistence.events[0]).toMatchObject({ runId: 'run-parent', type: 'child.started' })
    expect(persistence.events[0]?.payload).toMatchObject({ childTaskId: 'child-1', roleId: 'canvas-planner' })
    expect(persistence.events[1]).toMatchObject({ runId: 'run-parent', type: 'child.completed' })
    expect(persistence.events[1]?.payload).toMatchObject({ childTaskId: 'child-1', artifactIds: [] })
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
