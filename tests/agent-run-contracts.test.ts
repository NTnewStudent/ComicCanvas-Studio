import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AGENT_ARTIFACT_KINDS,
  AGENT_RUN_EVENT_TYPES,
  type AgentRunEventAppend,
  type AgentRunEventPayload,
  type AgentRunEventPayloadMap,
  type AgentRunEventRecord,
  type LocalPermissionGrant,
} from '../shared/agent-run-events'
import type { AgentNonCanvasResponse } from '../shared/agents'
import type { AgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false
type Expect<Value extends true> = Value

const compileTimeAssertions: [
  Expect<Equal<keyof AgentRunEventPayloadMap, (typeof AGENT_RUN_EVENT_TYPES)[number]>>,
  Expect<Equal<AgentRunEventPayloadMap['response.ready']['response'], AgentNonCanvasResponse>>,
  Expect<Equal<AgentRunEventPayloadMap['run.started']['status'], 'running'>>,
  Expect<Equal<AgentRunEventPayloadMap['run.completed']['status'], 'completed'>>
] = [true, true, true, true]

const typedResponseReadyEvent: AgentRunEventRecord<'response.ready'> = {
  id: 'event-response',
  runId: 'run-response',
  sequence: 1,
  type: 'response.ready',
  payload: {
    messageId: 'message-response',
    response: {
      type: 'answer',
      summary: 'Visible answer',
      text: 'Visible answer',
      dropped: []
    }
  },
  createdAt: 1
}

const typedCanvasResponse = {
  type: 'canvasPlan',
  plan: {
    kind: 'plan',
    summary: 'Draft',
    nodes: [],
    edges: [],
    runSteps: [],
    question: null,
    dropped: []
  }
} as const

const invalidResponseReadyEvent: AgentRunEventRecord<'response.ready'> = {
  id: 'event-invalid-response',
  runId: 'run-invalid-response',
  sequence: 1,
  type: 'response.ready',
  payload: {
    messageId: 'message-invalid-response',
    // @ts-expect-error response.ready persists only non-canvas responses.
    response: typedCanvasResponse
  },
  createdAt: 1
}

const dynamicEventPayload: AgentRunEventPayload = {
  message: 'Visible progress',
  progress: 25
}
const normalUnionEvent: AgentRunEventRecord = {
  id: 'event-dynamic',
  runId: 'run-dynamic',
  sequence: 1,
  type: 'progress',
  payload: dynamicEventPayload,
  createdAt: 1
}

function assertAppendBoundaryPairing(
  appendSpineEvent: AgentRunEventAppend,
  events: AgentRunEventRepository
): void {
  appendSpineEvent('run-paired', 'progress', {
    message: 'Visible progress',
    progress: 50
  })
  // @ts-expect-error progress events cannot carry model.delta payloads.
  appendSpineEvent('run-paired', 'progress', { delta: 'wrong payload' })

  events.append({
    id: 'event-paired',
    runId: 'run-paired',
    type: 'run.completed',
    payload: { status: 'completed' },
    createdAt: 1
  })
  // @ts-expect-error run.completed cannot carry run.started status.
  events.append({
    id: 'event-invalid-pair',
    runId: 'run-paired',
    type: 'run.completed',
    payload: { status: 'running' },
    createdAt: 1
  })
}

function assertDefaultRecordNarrowing(event: AgentRunEventRecord): void {
  if (event.type === 'progress') {
    const progress: number = event.payload.progress
    // @ts-expect-error progress payloads do not expose model deltas.
    void event.payload.delta
    void progress
  }
}

void typedResponseReadyEvent
void invalidResponseReadyEvent
void normalUnionEvent
void assertAppendBoundaryPairing
void assertDefaultRecordNarrowing

describe('Agent Run Spine shared contracts', () => {
  it('defines the first milestone event vocabulary in stable order', () => {
    expect(compileTimeAssertions).toEqual([true, true, true, true])
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
      'run.failed',
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
      'runExport',
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
        policyProfileId: 'local-default',
      },
      createdAt: 1,
    }
    const sampleGrant: LocalPermissionGrant = {
      id: 'grant-1',
      toolId: 'canvas.createNode',
      permissionKinds: ['canvas.write'],
      workflowId: 'default',
      scope: 'run',
      runId: 'run-1',
      approvedByLabel: 'user-local',
      createdAt: 2,
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
