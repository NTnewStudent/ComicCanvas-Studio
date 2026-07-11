/** Parent-controlled application boundary for completed child canvas proposals. */

import type { AgentRunSnapshot } from '../../../../shared/agent-run-events'
import type { WorkflowRepository } from '../db/repositories/workflow.repo'
import { sanitizeStrictChildDraftGraphArtifactPayload } from './sub-agent-isolation'

export interface ChildArtifactApplyGate {
  apply(input: { parentRunId: string; artifactId: string; appliedBy: string }): ChildArtifactApplyResult
}

export type ChildArtifactApplyResult = {
  graphVersion: string
  appliedNodeIds: string[]
  appliedEdgeIds: string[]
  dropped: string[]
  traceId: string
} | {
  errorClass: 'agent_child_artifact_unavailable'
  message: string
  retryable: false
}

export interface ChildArtifactApplyGateOptions {
  runSpine: Pick<{ getSnapshot(runId: string): AgentRunSnapshot | null }, 'getSnapshot'>
  workflows: Pick<WorkflowRepository, 'addVersion'>
  idFactory: () => string
  clock: () => number
}

function unavailable(message: string): Extract<ChildArtifactApplyResult, { errorClass: string }> {
  return { errorClass: 'agent_child_artifact_unavailable', message, retryable: false }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Creates the parent-only merge gate for persisted child draft graph artifacts. */
export function createChildArtifactApplyGate(options: ChildArtifactApplyGateOptions): ChildArtifactApplyGate {
  return {
    apply(input) {
      const parent = options.runSpine.getSnapshot(input.parentRunId)
      if (!parent) return unavailable('Parent agent run is unavailable.')
      const childTask = parent.childTasks.find((task) => task.artifactIds.includes(input.artifactId))
      if (!childTask || childTask.parentRunId !== input.parentRunId || childTask.status !== 'completed') {
        return unavailable('Child artifact is not available for parent application.')
      }

      const child = options.runSpine.getSnapshot(childTask.id)
      if (!child || child.run.status !== 'completed') return unavailable('Child agent run is not completed.')
      const artifact = child.artifacts.find((item) => item.id === input.artifactId)
      if (!artifact || artifact.runId !== childTask.id || artifact.kind !== 'draftGraph') {
        return unavailable('Child draft graph artifact is unavailable.')
      }

      if (!isRecord(artifact.payload) || !isRecord(artifact.payload.lineage)
        || artifact.payload.lineage.parentRunId !== input.parentRunId
        || artifact.payload.lineage.childRunId !== childTask.id
        || typeof artifact.payload.lineage.traceId !== 'string') {
        return unavailable('Child draft graph artifact lineage is invalid.')
      }
      const lineage = {
        parentRunId: input.parentRunId,
        childRunId: childTask.id,
        traceId: artifact.payload.lineage.traceId
      }
      const payload = sanitizeStrictChildDraftGraphArtifactPayload(artifact.payload, lineage)
      if (!payload || payload.lineage.parentRunId !== input.parentRunId || payload.lineage.childRunId !== childTask.id) {
        return unavailable('Child draft graph artifact failed validation.')
      }

      const graphVersion = options.idFactory()
      options.workflows.addVersion({
        id: graphVersion,
        workflowId: parent.run.workflowId,
        graph: payload.graph,
        createdAt: options.clock(),
        createdBy: input.appliedBy
      })
      return {
        graphVersion,
        appliedNodeIds: payload.graph.nodes.map((node) => node.id),
        appliedEdgeIds: payload.graph.edges.map((edge) => edge.id),
        dropped: payload.warnings,
        traceId: payload.lineage.traceId
      }
    }
  }
}
