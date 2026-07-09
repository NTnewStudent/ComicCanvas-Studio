import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AGENT_ARTIFACT_KINDS,
  AGENT_RUN_EVENT_TYPES,
  type AgentRunEventRecord,
  type LocalPermissionGrant,
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
