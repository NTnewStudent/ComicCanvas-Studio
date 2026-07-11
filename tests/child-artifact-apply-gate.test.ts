import { describe, expect, it, vi } from 'vitest'

import type { AgentRunSnapshot } from '../shared/agent-run-events'
import { createChildArtifactApplyGate } from '../desktop/src/main/agent/child-artifact-apply-gate'

const graph = {
  nodes: [{ id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'safe' } }],
  edges: [], viewport: { x: 0, y: 0, zoom: 1 }
}

function snapshot(input: Partial<AgentRunSnapshot>): AgentRunSnapshot {
  return {
    run: {
      id: 'run', threadId: 'thread', workflowId: 'workflow-1', agentId: 'general-assistant', status: 'completed',
      trigger: 'manual', messageId: 'message', policyProfileId: 'local-default', trace: {}, createdAt: 1, updatedAt: 1
    },
    events: [], artifacts: [], permissionGrants: [], childTasks: [], ...input
  }
}

describe('child artifact apply gate', () => {
  it('applies only a completed child draft graph owned by the requested parent run', () => {
    const addVersion = vi.fn()
    const parent = snapshot({
      run: { ...snapshot({}).run, id: 'run-parent' },
      childTasks: [{
        id: 'run-child', parentRunId: 'run-parent', roleId: 'canvas-operator', inputSummary: 'sha256:task',
        effectiveTools: ['canvas.createNode'], status: 'completed', artifactIds: ['run-child:artifact:draftGraph'], createdAt: 1, updatedAt: 2
      }]
    })
    const child = snapshot({
      run: { ...snapshot({}).run, id: 'run-child', agentId: 'canvas-operator', status: 'completed', trace: { parentRunId: 'run-parent' } },
      artifacts: [{
        id: 'run-child:artifact:draftGraph', runId: 'run-child', kind: 'draftGraph', title: 'Draft', summary: 'One node.', createdAt: 2,
        payload: { graph, lineage: { parentRunId: 'run-parent', childRunId: 'run-child', traceId: 'trace/run-child' }, warnings: [] }
      }]
    })
    const gate = createChildArtifactApplyGate({
      runSpine: { getSnapshot: (runId) => runId === 'run-parent' ? parent : runId === 'run-child' ? child : null },
      workflows: { addVersion }, idFactory: () => 'graph-version-child', clock: () => 3
    })

    const result = gate.apply({ parentRunId: 'run-parent', artifactId: 'run-child:artifact:draftGraph', appliedBy: 'user-local' })

    expect(result).toEqual({ graphVersion: 'graph-version-child', appliedNodeIds: ['text-1'], appliedEdgeIds: [], dropped: [], traceId: 'trace/run-child' })
    expect(addVersion).toHaveBeenCalledWith(expect.objectContaining({ id: 'graph-version-child', workflowId: 'workflow-1', graph, createdBy: 'user-local' }))
  })

  it('rejects a non-child artifact without writing a graph version', () => {
    const addVersion = vi.fn()
    const parent = snapshot({ run: { ...snapshot({}).run, id: 'run-parent' } })
    const gate = createChildArtifactApplyGate({
      runSpine: { getSnapshot: () => parent }, workflows: { addVersion }, idFactory: () => 'unused', clock: () => 3
    })

    expect(gate.apply({ parentRunId: 'run-parent', artifactId: 'forged', appliedBy: 'user-local' }))
      .toMatchObject({ errorClass: 'agent_child_artifact_unavailable', retryable: false })
    expect(addVersion).not.toHaveBeenCalled()
  })

  it('rejects a child draft whose persisted lineage does not match its parent task', () => {
    const addVersion = vi.fn()
    const parent = snapshot({
      run: { ...snapshot({}).run, id: 'run-parent' },
      childTasks: [{
        id: 'run-child', parentRunId: 'run-parent', roleId: 'canvas-operator', inputSummary: 'sha256:task',
        effectiveTools: [], status: 'completed', artifactIds: ['run-child:artifact:draftGraph'], createdAt: 1, updatedAt: 2
      }]
    })
    const child = snapshot({
      run: { ...snapshot({}).run, id: 'run-child', agentId: 'canvas-operator', status: 'completed', trace: { parentRunId: 'run-parent' } },
      artifacts: [{
        id: 'run-child:artifact:draftGraph', runId: 'run-child', kind: 'draftGraph', title: 'Draft', summary: 'One node.', createdAt: 2,
        payload: { graph, lineage: { parentRunId: 'forged-parent', childRunId: 'run-child', traceId: 'forged' }, warnings: [] }
      }]
    })
    const gate = createChildArtifactApplyGate({
      runSpine: { getSnapshot: (runId) => runId === 'run-parent' ? parent : runId === 'run-child' ? child : null },
      workflows: { addVersion }, idFactory: () => 'unused', clock: () => 3
    })

    expect(gate.apply({ parentRunId: 'run-parent', artifactId: 'run-child:artifact:draftGraph', appliedBy: 'user-local' }))
      .toMatchObject({ errorClass: 'agent_child_artifact_unavailable', retryable: false })
    expect(addVersion).not.toHaveBeenCalled()
  })
})
