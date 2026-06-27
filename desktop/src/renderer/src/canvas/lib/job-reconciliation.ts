/**
 * One-shot renderer reconciliation for durable jobs that may have finished while the canvas was closed.
 * @see docs/api-contracts/jobs.md
 */

import type { JobRecord, JobResult, JobType } from '../../../../../../shared/jobs'
import type { CanvasNodeData, NodeType } from '../../../../../../shared/nodes'
import type { CanvasPosition } from '../store/canvas.store'

export interface ReconciledCanvasNode {
  id: string
  type: NodeType
  position: CanvasPosition
  data: CanvasNodeData
}

const RUNNABLE_CANVAS_JOB_TYPES = new Set<JobType>([
  'canvas.generateImage',
  'canvas.generateVideo',
  'canvas.generateAudio',
  'canvas.composeVideo',
  'canvas.upscaleVideo',
  'canvas.muxAudioVideo',
])

function isRunnableCanvasJob(job: JobRecord): boolean {
  return RUNNABLE_CANVAS_JOB_TYPES.has(job.type)
}

function selectLatestJobByTarget(jobs: JobRecord[]): Map<string, JobRecord> {
  const latest = new Map<string, JobRecord>()

  for (const job of jobs) {
    if (!job.targetId || !isRunnableCanvasJob(job)) {
      continue
    }

    const current = latest.get(job.targetId)
    if (!current || job.updatedAt > current.updatedAt || (job.updatedAt === current.updatedAt && job.createdAt > current.createdAt)) {
      latest.set(job.targetId, job)
    }
  }

  return latest
}

function readReportData(result: JobResult): Record<string, unknown> {
  return result.kind === 'report' && result.data ? result.data : {}
}

export function terminalResultToNodePatch(result: JobResult): Partial<CanvasNodeData> | null {
  if (result.kind === 'asset') {
    return { status: 'done', assetId: result.assetId } as Partial<CanvasNodeData>
  }

  if (result.kind !== 'report') {
    return null
  }

  const data = readReportData(result)
  const patch: Record<string, unknown> = { status: 'done' }

  if (typeof data.assetId === 'string') patch.assetId = data.assetId
  if (typeof data.url === 'string') patch.url = data.url
  if (Array.isArray(data.urls) && data.urls.every((url) => typeof url === 'string')) patch.urls = data.urls
  if (typeof data.selectedIndex === 'number') patch.selectedIndex = data.selectedIndex

  return patch as Partial<CanvasNodeData>
}

/**
 * Reconciles loaded canvas nodes with persisted durable job state exactly once.
 * @param nodes - Nodes from the loaded workflow graph.
 * @param jobs - Persisted recent jobs, usually from `job.list`.
 * @returns A new node array with terminal or active run state restored.
 */
export function reconcileCanvasNodesWithJobs<TNode extends ReconciledCanvasNode>(
  nodes: TNode[],
  jobs: JobRecord[],
): TNode[] {
  const latestByTarget = selectLatestJobByTarget(jobs)

  return nodes.map((node) => {
    const job = latestByTarget.get(node.id)
    if (!job) {
      return node
    }

    if (job.status === 'completed') {
      if (!job.result) {
        return node
      }
      const patch = terminalResultToNodePatch(job.result)

      if (!patch) {
        return node
      }
      return {
        ...node,
        data: {
          ...node.data,
          ...patch,
        },
      }
    }

    if (job.status === 'failed') {
      return {
        ...node,
        data: {
          ...node.data,
          status: 'error',
        },
      }
    }

    if (job.status === 'pending' || job.status === 'processing') {
      return {
        ...node,
        data: {
          ...node.data,
          status: 'pending',
          assetId: null,
        },
      }
    }

    return node
  })
}
