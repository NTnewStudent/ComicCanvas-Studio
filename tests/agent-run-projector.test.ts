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

  it('is deterministic when persisted events are supplied out of order', () => {
    const shuffled: AgentRunSnapshot = {
      ...snapshot,
      events: [...snapshot.events].reverse()
    }

    expect(projectAgentRunSnapshot(shuffled)).toEqual(projectAgentRunSnapshot(snapshot))
    expect(projectAgentRunSnapshot(shuffled).inspector.latestEventType).toBe('run.completed')
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
})
