import { describe, expect, it } from 'vitest'

import type {
  AgentArtifactRecord,
  AgentRunEventPayloadMap,
  AgentRunEventRecord,
  AgentRunEventType,
  AgentRunProjection,
  AgentRunSnapshot,
  ChildAgentTaskRecord,
  LocalPermissionGrant
} from '../shared/agent-run-events'
import { projectAgentArtifact, projectAgentRunSnapshot } from '../shared/agent-run-projector'
import {
  applyAgentEvent,
  createAssistantTurn,
  type AgentChatEvent,
  type ChatTurn
} from '../shared/chat-blocks'

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

describe('Task 25 draft graph artifact projection', () => {
  it('projects only safe graph fields with lineage, warnings, and dropped metadata', () => {
    const view = projectAgentArtifact({
      id: 'artifact-draft', runId: 'run-child', kind: 'draftGraph', title: 'Draft', summary: 'Two nodes', createdAt: 10,
      payload: {
        graph: {
          nodes: [{ id: 'text-1', type: 'text', position: { x: 10, y: 20 }, data: { label: 'Prompt', content: 'secret detail' } }],
          edges: [{ id: 'edge-1', source: 'text-1', target: 'image-1', type: 'default', data: { hidden: true } }],
          viewport: { x: 1, y: 2, zoom: 1 }
        },
        lineage: { parentRunId: 'run-parent', childRunId: 'run-child', traceId: 'trace/child' },
        warnings: ['Dropped unsafe node data'], dropped: ['node.data.content']
      }
    })

    expect(view).toEqual(expect.objectContaining({
      viewType: 'draftGraph',
      nodes: [{ id: 'text-1', type: 'text', label: 'Prompt', position: { x: 10, y: 20 } }],
      edges: [{ id: 'edge-1', source: 'text-1', target: 'image-1', edgeType: 'default' }],
      lineage: { parentRunId: 'run-parent', childRunId: 'run-child', traceId: 'trace/child' },
      warnings: ['Dropped unsafe node data'], dropped: ['node.data.content']
    }))
    expect(JSON.stringify(view)).not.toContain('secret detail')
    expect(JSON.stringify(view)).not.toContain('hidden')
  })

  it('falls back for malformed draft graph payloads', () => {
    const view = projectAgentArtifact({
      id: 'artifact-bad', runId: 'run-child', kind: 'draftGraph', title: 'Bad', summary: 'Bad', createdAt: 10,
      payload: { graph: { nodes: [], edges: 'bad' }, lineage: {} }
    })
    expect(view.viewType).toBe('fallback')
  })
})

function eventRecord<Type extends AgentRunEventType>(
  sequence: number,
  type: Type,
  payload: AgentRunEventPayloadMap[Type]
): AgentRunEventRecord<Type> {
  return {
    id: `event-${sequence}`,
    runId: 'run-1',
    sequence,
    type,
    payload,
    createdAt: 10 + sequence
  }
}

function projectLive(events: AgentChatEvent[]): ChatTurn {
  return events.reduce(
    (turn, event) => applyAgentEvent(turn, event),
    createAssistantTurn({
      id: 'run-1-assistant',
      runId: 'run-1',
      messageId: 'message-1',
      createdAt: 10
    })
  )
}

function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values]
  let state = seed >>> 0

  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    const swapIndex = state % (index + 1)
    const current = result[index]!
    result[index] = result[swapIndex]!
    result[swapIndex] = current
  }

  return result
}

describe('Agent Run Projector', () => {
  const equivalenceScenarios: Array<{
    name: string
    status: AgentRunSnapshot['run']['status']
    liveEvents: AgentChatEvent[]
    durableEvents: AgentRunEventRecord[]
  }> = [
    {
      name: 'progress and model delta',
      status: 'running',
      liveEvents: [
        { type: 'progress', message: 'Reading context' },
        { type: 'delta', delta: 'Partial answer' }
      ],
      durableEvents: [
        eventRecord(1, 'progress', { message: 'Reading context', progress: 20 }),
        eventRecord(2, 'model.delta', { delta: 'Partial answer' })
      ]
    },
    ...(['completed', 'failed', 'denied'] as const).map((status) => ({
      name: `tool ${status}`,
      status: 'running' as const,
      liveEvents: [
        {
          type: 'toolStarted' as const,
          callId: `call-${status}`,
          toolId: 'canvas.queryGraph',
          inputSummary: 'Read graph'
        },
        {
          type: 'toolCompleted' as const,
          callId: `call-${status}`,
          toolId: 'canvas.queryGraph',
          status,
          summary: `Tool ${status}`
        }
      ],
      durableEvents: [
        eventRecord(1, 'tool.started', {
          callId: `call-${status}`,
          toolId: 'canvas.queryGraph',
          inputSummary: 'Read graph'
        }),
        eventRecord(2, 'tool.completed', {
          callId: `call-${status}`,
          toolId: 'canvas.queryGraph',
          status,
          summary: `Tool ${status}`
        })
      ]
    })),
    {
      name: 'permission requested and approved',
      status: 'running',
      liveEvents: [
        { type: 'progress', message: 'Waiting for approval' },
        {
          type: 'permissionRequired',
          callId: 'call-permission',
          toolId: 'web.search',
          reason: 'Network access',
          requiredPermissions: [{ kind: 'network', reason: 'Search the web' }]
        },
        {
          type: 'permissionResolved',
          callId: 'call-permission',
          decision: 'approved',
          scope: 'run'
        }
      ],
      durableEvents: [
        eventRecord(1, 'progress', { message: 'Waiting for approval', progress: 50 }),
        eventRecord(2, 'permission.requested', {
          callId: 'call-permission',
          toolId: 'web.search',
          reason: 'Network access',
          requiredPermissions: [{ kind: 'network', reason: 'Search the web' }]
        }),
        eventRecord(3, 'permission.resolved', {
          callId: 'call-permission',
          decision: 'approved',
          scope: 'run'
        })
      ]
    },
    {
      name: 'answer response',
      status: 'completed',
      liveEvents: [
        { type: 'delta', delta: 'Draft' },
        {
          type: 'responseReady',
          response: {
            type: 'answer',
            summary: 'Final answer',
            text: 'Final answer',
            dropped: []
          }
        }
      ],
      durableEvents: [
        eventRecord(1, 'model.delta', { delta: 'Draft' }),
        eventRecord(2, 'response.ready', {
          messageId: 'message-1',
          response: {
            type: 'answer',
            summary: 'Final answer',
            text: 'Final answer',
            dropped: []
          }
        }),
        eventRecord(3, 'run.completed', { status: 'completed' })
      ]
    },
    {
      name: 'clarification response',
      status: 'completed',
      liveEvents: [
        {
          type: 'responseReady',
          response: {
            type: 'clarification',
            summary: 'Need orientation',
            question: 'Landscape or portrait?',
            missing: ['orientation'],
            dropped: []
          }
        }
      ],
      durableEvents: [
        eventRecord(1, 'response.ready', {
          messageId: 'message-1',
          response: {
            type: 'clarification',
            summary: 'Need orientation',
            question: 'Landscape or portrait?',
            missing: ['orientation'],
            dropped: []
          }
        }),
        eventRecord(2, 'run.completed', { status: 'completed' })
      ]
    },
    {
      name: 'plan ready',
      status: 'completed',
      liveEvents: [{ type: 'planReady', planId: 'plan-1' }],
      durableEvents: [
        eventRecord(1, 'plan.ready', { messageId: 'message-1', planId: 'plan-1' }),
        eventRecord(2, 'run.completed', { status: 'completed' })
      ]
    },
    {
      name: 'approval required',
      status: 'approval_required',
      liveEvents: [
        { type: 'progress', message: 'Waiting for approval' },
        {
          type: 'permissionRequired',
          callId: 'call-approval',
          toolId: 'canvas.createNode',
          reason: 'Canvas write',
          requiredPermissions: [{ kind: 'canvas.write', reason: 'Create a node' }]
        }
      ],
      durableEvents: [
        eventRecord(1, 'progress', { message: 'Waiting for approval', progress: 50 }),
        eventRecord(2, 'permission.requested', {
          callId: 'call-approval',
          toolId: 'canvas.createNode',
          reason: 'Canvas write',
          requiredPermissions: [{ kind: 'canvas.write', reason: 'Create a node' }]
        })
      ]
    },
    {
      name: 'failed terminal',
      status: 'failed',
      liveEvents: [
        { type: 'delta', delta: 'Discarded draft' },
        {
          type: 'runFailed',
          errorClass: 'gateway_unavailable',
          message: 'Gateway unavailable.',
          retryable: true
        }
      ],
      durableEvents: [
        eventRecord(1, 'model.delta', { delta: 'Discarded draft' }),
        eventRecord(2, 'run.failed', {
          errorClass: 'gateway_unavailable',
          message: 'Gateway unavailable.',
          retryable: true
        })
      ]
    }
  ]

  it.each(equivalenceScenarios)(
    'keeps live applyAgentEvent and replay equivalent for $name',
    ({ status, liveEvents, durableEvents }) => {
      const replay = projectAgentRunSnapshot({
        ...snapshot,
        run: { ...snapshot.run, status },
        events: durableEvents,
        artifacts: [],
        permissionGrants: [],
        childTasks: []
      })

      expect(replay.chatTurn).toEqual(projectLive(liveEvents))
    }
  )

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

  it('is deterministic when persisted events are supplied out of order', () => {
    const shuffled: AgentRunSnapshot = {
      ...snapshot,
      events: [...snapshot.events].reverse()
    }

    expect(projectAgentRunSnapshot(shuffled)).toEqual(projectAgentRunSnapshot(snapshot))
    expect(projectAgentRunSnapshot(shuffled).inspector.latestEventType).toBe('run.completed')
  })

  it('matches an independently reconstructed projection at every durable prefix', () => {
    const childRunning: ChildAgentTaskRecord = {
      id: 'child-1',
      parentRunId: 'run-1',
      roleId: 'canvas-planner',
      inputSummary: 'Inspect the canvas',
      effectiveTools: ['canvas.queryGraph'],
      status: 'running',
      artifactIds: [],
      createdAt: 13,
      updatedAt: 13
    }
    const artifact: AgentArtifactRecord = {
      id: 'artifact-1',
      runId: 'run-1',
      kind: 'answer',
      title: 'Canvas summary',
      summary: 'Found three nodes',
      payload: {
        type: 'answer',
        summary: 'Found three nodes',
        text: 'Canvas has three nodes.',
        dropped: []
      },
      createdAt: 17
    }
    const grant: LocalPermissionGrant = {
      id: 'grant-1',
      toolId: 'canvas.queryGraph',
      permissionKinds: ['canvas.read'],
      workflowId: 'default',
      scope: 'run',
      runId: 'run-1',
      approvedByLabel: 'chat-user',
      createdAt: 15
    }
    const completedChild: ChildAgentTaskRecord = {
      ...childRunning,
      status: 'completed',
      outputSummary: 'Found three nodes',
      artifactIds: ['artifact-1'],
      updatedAt: 18
    }
    const finalEvents: AgentRunEventRecord[] = [
      eventRecord(1, 'run.created', {
        threadId: 'thread-1',
        workflowId: 'default',
        agentId: 'general-purpose',
        trigger: 'canvasChat',
        messageId: 'message-1',
        policyProfileId: 'local-default'
      }),
      eventRecord(2, 'progress', { message: 'Inspecting canvas', progress: 20 }),
      eventRecord(3, 'tool.started', {
        callId: 'call-1',
        toolId: 'canvas.queryGraph',
        inputSummary: 'Read graph'
      }),
      eventRecord(4, 'permission.requested', {
        callId: 'call-1',
        toolId: 'canvas.queryGraph',
        reason: 'Read canvas',
        requiredPermissions: [{ kind: 'canvas.read', reason: 'Inspect the graph' }]
      }),
      eventRecord(5, 'permission.resolved', {
        callId: 'call-1',
        decision: 'approved',
        scope: 'run'
      }),
      eventRecord(6, 'tool.completed', {
        callId: 'call-1',
        toolId: 'canvas.queryGraph',
        status: 'completed',
        summary: '3 nodes'
      }),
      eventRecord(7, 'artifact.created', {
        artifactId: 'artifact-1',
        kind: 'answer',
        title: 'Canvas summary',
        summary: 'Found three nodes'
      }),
      eventRecord(8, 'response.ready', {
        messageId: 'message-1',
        response: {
          type: 'answer',
          summary: 'Found three nodes',
          text: 'Canvas has three nodes.',
          dropped: []
        }
      }),
      eventRecord(9, 'run.completed', { status: 'completed' })
    ]
    const initialSnapshot: AgentRunSnapshot = {
      ...snapshot,
      run: { ...snapshot.run, status: 'running', updatedAt: 10 },
      events: [],
      artifacts: [],
      permissionGrants: [],
      childTasks: []
    }
    let growingSnapshot = initialSnapshot
    type ChildTaskState = 'none' | 'running' | 'completed'
    interface CapturedPrefix {
      name: string
      eventCount: number
      hasArtifact: boolean
      hasGrant: boolean
      childTaskState: ChildTaskState
      runStatus: AgentRunSnapshot['run']['status']
      updatedAt: number
      projection: AgentRunProjection
    }
    const capturedPrefixes: CapturedPrefix[] = []
    const capture = (name: string, childTaskState: ChildTaskState): void => {
      capturedPrefixes.push({
        name,
        eventCount: growingSnapshot.events.length,
        hasArtifact: growingSnapshot.artifacts.length > 0,
        hasGrant: growingSnapshot.permissionGrants.length > 0,
        childTaskState,
        runStatus: growingSnapshot.run.status,
        updatedAt: growingSnapshot.run.updatedAt,
        projection: projectAgentRunSnapshot(growingSnapshot)
      })
    }
    const appendEvent = (event: AgentRunEventRecord, childTaskState: ChildTaskState): void => {
      growingSnapshot = {
        ...growingSnapshot,
        events: [...growingSnapshot.events, event],
        run: {
          ...growingSnapshot.run,
          status: event.type === 'run.completed' ? 'completed' : growingSnapshot.run.status,
          updatedAt: event.createdAt
        }
      }
      capture(`event:${event.type}`, childTaskState)
    }

    capture('initial', 'none')
    for (const event of finalEvents.slice(0, 3)) {
      appendEvent(event, 'none')
    }
    growingSnapshot = { ...growingSnapshot, childTasks: [childRunning] }
    capture('child-task:running', 'running')
    for (const event of finalEvents.slice(3, 7)) {
      appendEvent(event, 'running')
    }
    growingSnapshot = { ...growingSnapshot, permissionGrants: [grant] }
    capture('permission-grant:created', 'running')
    growingSnapshot = { ...growingSnapshot, artifacts: [artifact] }
    capture('artifact:created', 'running')
    growingSnapshot = { ...growingSnapshot, childTasks: [completedChild] }
    capture('child-task:completed', 'completed')
    for (const event of finalEvents.slice(7)) {
      appendEvent(event, 'completed')
    }

    const reconstructPrefix = (prefix: CapturedPrefix): AgentRunSnapshot => {
      const childTasks = prefix.childTaskState === 'none'
        ? []
        : [structuredClone(prefix.childTaskState === 'running' ? childRunning : completedChild)]

      return {
        ...initialSnapshot,
        run: {
          ...initialSnapshot.run,
          status: prefix.runStatus,
          updatedAt: prefix.updatedAt
        },
        events: structuredClone(finalEvents.slice(0, prefix.eventCount)),
        artifacts: prefix.hasArtifact ? [structuredClone(artifact)] : [],
        permissionGrants: prefix.hasGrant ? [structuredClone(grant)] : [],
        childTasks
      }
    }

    for (const prefix of capturedPrefixes) {
      const replay = projectAgentRunSnapshot(reconstructPrefix(prefix))

      expect(prefix.projection.chatTurn).toEqual(replay.chatTurn)
      expect(prefix.projection.taskTree).toEqual(replay.taskTree)
      expect(prefix.projection.inspector).toEqual(replay.inspector)
      expect(prefix.projection.artifacts).toEqual(replay.artifacts)
      expect(prefix.projection.inspector.latestEventType).toBe(
        finalEvents[prefix.eventCount - 1]?.type
      )
    }

    const runningChildPrefix = capturedPrefixes.find(
      (prefix) => prefix.name === 'child-task:running'
    )!
    const grantPrefix = capturedPrefixes.find(
      (prefix) => prefix.name === 'permission-grant:created'
    )!
    const beforeGrantPrefix = capturedPrefixes[capturedPrefixes.indexOf(grantPrefix) - 1]!
    const artifactPrefix = capturedPrefixes.find(
      (prefix) => prefix.name === 'artifact:created'
    )!
    const completedChildPrefix = capturedPrefixes.find(
      (prefix) => prefix.name === 'child-task:completed'
    )!

    expect(runningChildPrefix.projection.taskTree).toEqual([
      expect.objectContaining({ id: 'child-1', status: 'running', artifactIds: [] })
    ])
    expect(grantPrefix.projection).toEqual(beforeGrantPrefix.projection)
    expect(artifactPrefix.projection.artifacts).toEqual([
      expect.objectContaining({ id: 'artifact-1', viewType: 'answer' })
    ])
    expect(artifactPrefix.projection.inspector.artifacts).toEqual([
      expect.objectContaining({ id: 'artifact-1', kind: 'answer' })
    ])
    expect(completedChildPrefix.projection.taskTree).toEqual([
      expect.objectContaining({
        id: 'child-1',
        status: 'completed',
        summary: 'Found three nodes',
        artifactIds: ['artifact-1']
      })
    ])
  })

  it('is deterministic and pure across fixed-seed permutations of replay collections', () => {
    const artifacts: AgentArtifactRecord[] = [
      {
        id: 'artifact-b',
        runId: 'run-1',
        kind: 'answer',
        title: 'Later ID',
        summary: 'Second at the same time',
        payload: { type: 'answer', text: 'B', dropped: [] },
        createdAt: 22
      },
      {
        id: 'artifact-a',
        runId: 'run-1',
        kind: 'answer',
        title: 'Earlier ID',
        summary: 'First at the same time',
        payload: { type: 'answer', text: 'A', dropped: [] },
        createdAt: 22
      },
      {
        id: 'artifact-c',
        runId: 'run-1',
        kind: 'answer',
        title: 'Last',
        summary: 'Later creation time',
        payload: { type: 'answer', text: 'C', dropped: [] },
        createdAt: 23
      }
    ]
    const childTasks: ChildAgentTaskRecord[] = [
      {
        id: 'child-b',
        parentRunId: 'run-1',
        roleId: 'qa-verifier',
        inputSummary: 'Second at the same time',
        effectiveTools: [],
        status: 'completed',
        artifactIds: [],
        createdAt: 18,
        updatedAt: 20
      },
      {
        id: 'child-a',
        parentRunId: 'run-1',
        roleId: 'canvas-planner',
        inputSummary: 'First at the same time',
        effectiveTools: [],
        status: 'completed',
        artifactIds: [],
        createdAt: 18,
        updatedAt: 19
      },
      {
        id: 'child-c',
        parentRunId: 'run-1',
        roleId: 'tooling',
        inputSummary: 'Later creation time',
        effectiveTools: [],
        status: 'failed',
        artifactIds: [],
        errorClass: 'child_failed',
        createdAt: 19,
        updatedAt: 21
      }
    ]
    const permissionGrants: LocalPermissionGrant[] = [
      {
        id: 'grant-b',
        toolId: 'web.search',
        permissionKinds: ['network'],
        workflowId: 'default',
        scope: 'session',
        approvedByLabel: 'chat-user',
        createdAt: 17
      },
      {
        id: 'grant-a',
        toolId: 'canvas.queryGraph',
        permissionKinds: ['canvas.read'],
        workflowId: 'default',
        scope: 'run',
        runId: 'run-1',
        approvedByLabel: 'chat-user',
        createdAt: 17
      },
      {
        id: 'grant-c',
        toolId: 'canvas.createNode',
        permissionKinds: ['canvas.write'],
        workflowId: 'default',
        scope: 'once',
        runId: 'run-1',
        approvedByLabel: 'chat-user',
        createdAt: 18,
        revokedAt: 19
      }
    ]
    const replaySnapshot: AgentRunSnapshot = {
      ...snapshot,
      artifacts,
      permissionGrants,
      childTasks
    }
    const baseline = projectAgentRunSnapshot(replaySnapshot)
    const withoutGrantRows = projectAgentRunSnapshot({
      ...replaySnapshot,
      permissionGrants: []
    })

    expect(baseline.artifacts.map((artifact) => artifact.id)).toEqual([
      'artifact-a',
      'artifact-b',
      'artifact-c'
    ])
    expect(baseline.taskTree.map((task) => task.id)).toEqual([
      'child-a',
      'child-b',
      'child-c'
    ])
    expect(baseline).toEqual(withoutGrantRows)

    for (const seed of [1, 7, 42, 2_026_071_1]) {
      const permuted: AgentRunSnapshot = {
        ...replaySnapshot,
        events: shuffled(replaySnapshot.events, seed),
        artifacts: shuffled(replaySnapshot.artifacts, seed ^ 0xa5a5a5a5),
        permissionGrants: shuffled(replaySnapshot.permissionGrants, seed ^ 0x3c3c3c3c),
        childTasks: shuffled(replaySnapshot.childTasks, seed ^ 0x5a5a5a5a)
      }
      const before = structuredClone(permuted)

      expect(projectAgentRunSnapshot(permuted)).toEqual(baseline)
      expect(projectAgentRunSnapshot(permuted)).toEqual(baseline)
      expect(permuted).toEqual(before)
    }
  })

  it('projects unresolved permission state into chat and inspector views', () => {
    const awaitingApproval = projectAgentRunSnapshot({
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

    expect(awaitingApproval.chatTurn.blocks).toContainEqual({
      kind: 'permission',
      callId: 'call-write',
      toolId: 'canvas.createNode',
      reason: 'Creating nodes requires confirmation.',
      requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }],
      resolved: false
    })
    expect(awaitingApproval.inspector.permissions).toEqual([
      { callId: 'call-write', toolId: 'canvas.createNode', reason: 'Creating nodes requires confirmation.', resolved: false }
    ])
  })

  it('projects denied permission decisions into chat and inspector views', () => {
    const denied = projectAgentRunSnapshot({
      ...snapshot,
      run: { ...snapshot.run, status: 'aborted', errorClass: 'agent_tool_denied' },
      events: [
        ...snapshot.events.slice(0, 3),
        {
          id: 'event-permission-requested',
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
        },
        {
          id: 'event-permission-denied',
          runId: 'run-1',
          sequence: 5,
          type: 'permission.resolved',
          payload: {
            callId: 'call-write',
            deniedByLabel: 'user-local',
            decision: 'denied'
          },
          createdAt: 21
        },
        {
          id: 'event-denied',
          runId: 'run-1',
          sequence: 6,
          type: 'run.failed',
          payload: {
            errorClass: 'agent_tool_denied',
            message: 'Tool call was denied by the user.',
            retryable: false
          },
          createdAt: 22
        }
      ]
    })

    expect(denied.chatTurn.blocks).toContainEqual(
      expect.objectContaining({
        kind: 'permission',
        callId: 'call-write',
        resolved: true,
        decision: 'denied'
      })
    )
    expect(denied.inspector.permissions).toEqual([
      expect.objectContaining({
        callId: 'call-write',
        resolved: true,
        decision: 'denied'
      })
    ])
  })

  it('projects failure metadata and child task summaries into the inspector', () => {
    const failed = projectAgentRunSnapshot({
      ...snapshot,
      run: { ...snapshot.run, status: 'failed' },
      events: [
        ...snapshot.events.slice(0, 2),
        {
          id: 'event-failed',
          runId: 'run-1',
          sequence: 3,
          type: 'run.failed',
          payload: { errorClass: 'gateway_unavailable', message: 'Gateway unavailable.', retryable: true },
          createdAt: 20
        }
      ],
      childTasks: [
        {
          id: 'child-1',
          parentRunId: 'run-1',
          roleId: 'qa-verifier',
          inputSummary: 'Verify output',
          effectiveTools: [],
          status: 'failed',
          errorClass: 'verification_failed',
          artifactIds: [],
          createdAt: 15,
          updatedAt: 19
        }
      ]
    })

    expect(failed.chatTurn.status).toBe('failed')
    expect(failed.inspector.error).toEqual({
      errorClass: 'gateway_unavailable',
      message: 'Gateway unavailable.',
      retryable: true
    })
    expect(failed.taskTree).toEqual([
      expect.objectContaining({
        id: 'child-1',
        summary: 'Verify output',
        errorClass: 'verification_failed'
      })
    ])
  })

  it('projects supported artifact payloads into typed read-only view models and degrades malformed JSON', () => {
    const projection = projectAgentRunSnapshot({
      ...snapshot,
      artifacts: [
        {
          id: 'artifact-answer',
          runId: 'run-1',
          kind: 'answer',
          title: '回答',
          summary: '普通回答',
          payload: {
            type: 'answer',
            summary: '普通回答',
            text: '这是可读的最终回答。',
            dropped: ['隐藏调试字段']
          },
          createdAt: 20
        },
        {
          id: 'artifact-clarification',
          runId: 'run-1',
          kind: 'clarification',
          title: '澄清',
          summary: '需要补充信息',
          payload: {
            type: 'clarification',
            summary: '需要补充信息',
            question: '希望画面采用横屏还是竖屏？',
            missing: ['orientation'],
            dropped: []
          },
          createdAt: 21
        },
        {
          id: 'artifact-plan',
          runId: 'run-1',
          kind: 'canvasPlan',
          title: 'CanvasPlan',
          summary: '生成分镜工作流',
          payload: {
            kind: 'plan',
            summary: '生成分镜工作流',
            nodes: [
              { ref: 'text-1', type: 'text', title: '分镜提示词', data: {} },
              { ref: 'image-1', type: 'image', title: '关键帧', data: {} }
            ],
            edges: [
              { source: 'text-1', target: 'image-1', edgeType: 'promptOrder' }
            ],
            runSteps: [
              { ref: 'image-1', action: 'imageRun' }
            ],
            question: null,
            dropped: ['移除不支持的脚本字段']
          },
          createdAt: 22
        },
        {
          id: 'artifact-patch',
          runId: 'run-1',
          kind: 'canvasPatchDraft',
          title: '画布变更草稿',
          summary: '新增关键帧并连接提示词',
          payload: {
            summary: '新增关键帧并连接提示词',
            nodeChanges: [
              { action: 'add', ref: 'image-1', type: 'image', title: '关键帧' }
            ],
            edgeChanges: [
              { action: 'add', source: 'text-1', target: 'image-1', edgeType: 'promptOrder' }
            ],
            warnings: ['应用前仍需父级确认']
          },
          createdAt: 23
        },
        {
          id: 'artifact-search',
          runId: 'run-1',
          kind: 'searchSummary',
          title: '检索摘要',
          summary: '找到一个可引用来源',
          payload: {
            query: 'ComicCanvas local agent',
            summary: '找到一个可引用来源',
            sources: [
              {
                title: 'OpenAI 官方文档',
                url: 'https://platform.openai.com/docs',
                citation: '[1]',
                snippet: 'Agent 工具调用与结构化输出说明。'
              }
            ],
            citations: ['[1]']
          },
          createdAt: 24
        },
        {
          id: 'artifact-memory',
          runId: 'run-1',
          kind: 'memorySuggestion',
          title: '记忆建议',
          summary: '建议记住角色画风',
          payload: {
            scope: 'workflow',
            content: '主角始终使用黑白线稿风格。',
            rationale: '后续分镜需要保持视觉一致。'
          },
          createdAt: 25
        },
        {
          id: 'artifact-diagnostics',
          runId: 'run-1',
          kind: 'diagnosticReport',
          title: '诊断报告',
          summary: '发现一个网关告警',
          payload: {
            severity: 'warning',
            diagnostics: [
              {
                code: 'gateway_latency',
                severity: 'warning',
                message: '模型网关响应偏慢。',
                path: 'gateway.gpt-5',
                details: { latencyMs: 3200 }
              }
            ]
          },
          createdAt: 26
        },
        {
          id: 'artifact-malformed',
          runId: 'run-1',
          kind: 'answer',
          title: '损坏回答',
          summary: 'payload 字段类型错误',
          payload: { type: 'answer', text: 42 },
          createdAt: 27
        }
      ]
    })

    expect(projection.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-answer',
        viewType: 'answer',
        text: '这是可读的最终回答。',
        dropped: ['隐藏调试字段']
      }),
      expect.objectContaining({
        id: 'artifact-clarification',
        viewType: 'clarification',
        question: '希望画面采用横屏还是竖屏？',
        missing: ['orientation']
      }),
      expect.objectContaining({
        id: 'artifact-plan',
        viewType: 'canvasPlan',
        nodes: [
          expect.objectContaining({ ref: 'text-1', type: 'text', title: '分镜提示词' }),
          expect.objectContaining({ ref: 'image-1', type: 'image', title: '关键帧' })
        ],
        edges: [
          expect.objectContaining({ source: 'text-1', target: 'image-1', edgeType: 'promptOrder' })
        ],
        runSteps: [
          expect.objectContaining({ ref: 'image-1', action: 'imageRun' })
        ]
      }),
      expect.objectContaining({
        id: 'artifact-patch',
        viewType: 'canvasPatchDraft',
        nodeChanges: [
          expect.objectContaining({ action: 'add', ref: 'image-1', type: 'image' })
        ],
        edgeChanges: [
          expect.objectContaining({ action: 'add', source: 'text-1', target: 'image-1' })
        ]
      }),
      expect.objectContaining({
        id: 'artifact-search',
        viewType: 'searchSummary',
        sources: [
          expect.objectContaining({
            title: 'OpenAI 官方文档',
            citation: '[1]',
            url: 'https://platform.openai.com/docs'
          })
        ]
      }),
      expect.objectContaining({
        id: 'artifact-memory',
        viewType: 'memorySuggestion',
        scope: 'workflow',
        confirmationState: 'pending',
        content: '主角始终使用黑白线稿风格。'
      }),
      expect.objectContaining({
        id: 'artifact-diagnostics',
        viewType: 'diagnostics',
        severity: 'warning',
        diagnostics: [
          expect.objectContaining({
            code: 'gateway_latency',
            severity: 'warning'
          })
        ]
      }),
      expect.objectContaining({
        id: 'artifact-malformed',
        viewType: 'fallback'
      })
    ])

    const diagnosticArtifact = projection.artifacts[6]
    expect(diagnosticArtifact?.viewType).toBe('diagnostics')
    if (diagnosticArtifact?.viewType === 'diagnostics') {
      expect(diagnosticArtifact.diagnostics[0]?.detailsPreview).toContain('"latencyMs": 3200')
    }

    const malformedArtifact = projection.artifacts[7]
    expect(malformedArtifact?.viewType).toBe('fallback')
    if (malformedArtifact?.viewType === 'fallback') {
      expect(malformedArtifact.reason).toContain('answer')
      expect(malformedArtifact.payloadPreview).toContain('"text": 42')
    }
  })

  it('projects real web.search results as sources without dropping citations', () => {
    const projection = projectAgentRunSnapshot({
      ...snapshot,
      artifacts: [
        {
          id: 'artifact-search-results',
          runId: 'run-1',
          kind: 'searchSummary',
          title: '检索摘要',
          summary: '真实工具结果',
          payload: {
            query: 'ComicCanvas local agent',
            searchedAt: '2026-07-11T00:00:00.000Z',
            results: [
              {
                title: 'ComicCanvas 文档',
                url: 'https://example.com/comiccanvas',
                snippet: '本地 Agent 平台说明。'
              }
            ],
            citations: ['[tool-1]'],
            truncated: false
          },
          createdAt: 30
        }
      ]
    })

    const artifact = projection.artifacts[0]
    expect(artifact?.viewType).toBe('searchSummary')
    if (artifact?.viewType === 'searchSummary') {
      expect(artifact.sources).toEqual([
        {
          title: 'ComicCanvas 文档',
          url: 'https://example.com/comiccanvas',
          snippet: '本地 Agent 平台说明。'
        }
      ])
      expect(artifact.citations).toEqual(['[tool-1]'])
    }
  })

  it('degrades malformed non-answer payloads into the generic fallback view', () => {
    const projection = projectAgentRunSnapshot({
      ...snapshot,
      artifacts: [
        {
          id: 'artifact-search-malformed',
          runId: 'run-1',
          kind: 'searchSummary',
          title: '损坏检索摘要',
          summary: 'results 不是数组',
          payload: {
            query: 'broken search',
            results: 'not-an-array',
            citations: ['[1]']
          },
          createdAt: 31
        }
      ]
    })

    const artifact = projection.artifacts[0]
    expect(artifact?.viewType).toBe('fallback')
    if (artifact?.viewType === 'fallback') {
      expect(artifact.reason).toContain('searchSummary')
      expect(artifact.payloadPreview).toContain('"results": "not-an-array"')
    }
  })

  it('redacts secret-like keys from malformed artifact payload previews', () => {
    const projection = projectAgentRunSnapshot({
      ...snapshot,
      artifacts: [
        {
          id: 'artifact-diagnostic-secret',
          runId: 'run-1',
          kind: 'diagnosticReport',
          title: '损坏诊断',
          summary: '诊断数据异常',
          payload: {
            severity: 'warning',
            diagnostics: 'not-an-array',
            accessToken: 'token-value',
            client_secret: 'secret-value',
            password: 'password-value',
            apiKey: 'api-key-value',
            Authorization: 'Bearer credential',
            sessionCookie: 'cookie-value',
            privateKey: 'private-key-value',
            credential: 'credential-value',
            nested: {
              safeField: 'visible-value',
              explanation: '正常说明文本应保持可见。',
              headerLine: 'Authorization: Bearer live-secret',
              queryLine: 'api_key=live-key',
              noteLine: 'password: live-pass',
              rawBearer: 'Bearer live-secret-token',
              rawAlphabetBearer: 'Bearer abcdefghijklmnopqrstuvwxyz',
              basicHeaderLine: 'Authorization: Basic dXNlcjpwYXNzd29yZA==',
              quotedBearerLine: 'Authorization: "Bearer abc.def.ghi123456"',
              authHeaderLine: 'authHeader=Basic dXNlcjpwYXNzd29yZA==',
              rawProviderKey: 'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
              sketchNote: 'sketch rendering remains enabled.',
              bearerNote: 'bearer is used here as ordinary natural language.',
              bearerProtocolNote: 'Bearer authentication requires a token.'
            }
          },
          createdAt: 32
        }
      ]
    })

    const artifact = projection.artifacts[0]
    expect(artifact?.viewType).toBe('fallback')
    if (artifact?.viewType === 'fallback') {
      expect(artifact.payloadPreview).toContain('"accessToken": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"client_secret": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"password": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"apiKey": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"Authorization": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"sessionCookie": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"privateKey": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"credential": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"safeField": "visible-value"')
      expect(artifact.payloadPreview).toContain('"explanation": "正常说明文本应保持可见。"')
      expect(artifact.payloadPreview).toContain('"headerLine": "Authorization: Bearer [redacted]"')
      expect(artifact.payloadPreview).toContain('"queryLine": "api_key=[redacted]"')
      expect(artifact.payloadPreview).toContain('"noteLine": "password: [redacted]"')
      expect(artifact.payloadPreview).toContain('"rawBearer": "Bearer [redacted]"')
      expect(artifact.payloadPreview).toContain('"rawAlphabetBearer": "Bearer [redacted]"')
      expect(artifact.payloadPreview).toContain('"basicHeaderLine": "Authorization: Basic [redacted]"')
      expect(artifact.payloadPreview).toContain('"quotedBearerLine": "Authorization: \\"Bearer [redacted]\\""')
      expect(artifact.payloadPreview).toContain('"authHeaderLine": "authHeader=Basic [redacted]"')
      expect(artifact.payloadPreview).toContain('"rawProviderKey": "[redacted]"')
      expect(artifact.payloadPreview).toContain('"sketchNote": "sketch rendering remains enabled."')
      expect(artifact.payloadPreview).toContain('"bearerNote": "bearer is used here as ordinary natural language."')
      expect(artifact.payloadPreview).toContain('"bearerProtocolNote": "Bearer authentication requires a token."')
      expect(artifact.payloadPreview).not.toContain('token-value')
      expect(artifact.payloadPreview).not.toContain('secret-value')
      expect(artifact.payloadPreview).not.toContain('password-value')
      expect(artifact.payloadPreview).not.toContain('api-key-value')
      expect(artifact.payloadPreview).not.toContain('Bearer credential')
      expect(artifact.payloadPreview).not.toContain('cookie-value')
      expect(artifact.payloadPreview).not.toContain('private-key-value')
      expect(artifact.payloadPreview).not.toContain('credential-value')
      expect(artifact.payloadPreview).not.toContain('live-secret')
      expect(artifact.payloadPreview).not.toContain('live-key')
      expect(artifact.payloadPreview).not.toContain('live-pass')
      expect(artifact.payloadPreview).not.toContain('live-secret-token')
      expect(artifact.payloadPreview).not.toContain('abcdefghijklmnopqrstuvwxyz')
      expect(artifact.payloadPreview).not.toContain('dXNlcjpwYXNzd29yZA==')
      expect(artifact.payloadPreview).not.toContain('abc.def.ghi123456')
      expect(artifact.payloadPreview).not.toContain('sk-proj-abcdefghijklmnopqrstuvwxyz123456')
    }
  })
})
