/**
 * One-shot renderer reconciliation for durable jobs that may have finished while the canvas was closed.
 * @see docs/api-contracts/jobs.md
 */

import type { JobError, JobRecord, JobResult, JobType } from '../../../../../../shared/jobs'
import type { CanvasNodeData, NodeType } from '../../../../../../shared/nodes'
import type { CanvasPosition } from '../store/canvas.store'

export interface ReconciledCanvasNode {
  id: string
  type: NodeType
  position: CanvasPosition
  data: CanvasNodeData
}

/** Reopen-time generation task status derived from persisted jobs. */
export interface GenerationTaskStatus {
  /** Target canvas node ID. */
  nodeId: string
  /** Target canvas node type. */
  nodeType: NodeType
  /** Latest persisted job ID for the node. */
  jobId: string
  /** Persisted job type. */
  jobType: JobType
  /** Persisted job status. */
  status: JobRecord['status']
  /** Active while pending/processing, terminal after completed/failed/canceled. */
  phase: 'active' | 'terminal'
  /** Last known progress. */
  progress: number
  /** Recoverable failure message when available. */
  errorMessage?: string
}

const RUNNABLE_CANVAS_JOB_TYPES = new Set<JobType>([
  'canvas.generateImage',
  'canvas.generateVideo',
  'canvas.polishText',
  'canvas.generateAudio',
  'canvas.composeVideo',
  'canvas.upscaleVideo',
  'canvas.muxAudioVideo',
])

const RECOVERABLE_NODE_TYPES = new Set<NodeType>([
  'text',
  'image',
  'video',
  'character',
  'scene',
  'audio',
  'imageConfigV2',
  'videoConfigV2',
  'videoCompose',
  'superResolution',
  'muxAudioVideo',
])

function isRunnableCanvasJob(job: JobRecord): boolean {
  return RUNNABLE_CANVAS_JOB_TYPES.has(job.type)
}

function isRecoverableNodeType(type: NodeType): boolean {
  return RECOVERABLE_NODE_TYPES.has(type)
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

function paragraphHtml(text: string): string {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  return `<p>${escaped}</p>`
}

function isTextPolishJob(jobType: JobType): boolean {
  return jobType === 'canvas.polishText'
}

export function terminalResultToNodePatch(result: JobResult): Partial<CanvasNodeData> | null {
  if (result.kind === 'text') {
    return {
      content: result.text,
      html: paragraphHtml(result.text),
      polishStatus: 'done',
    } as Partial<CanvasNodeData>
  }

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
 * Converts a failed terminal job event into the correct node-data patch.
 * @param jobType - Persisted job type.
 * @param error - Safe persisted job error.
 * @returns Node-data patch for failed jobs.
 */
export function terminalFailureToNodePatch(jobType: JobType, error?: JobError): Partial<CanvasNodeData> {
  if (isTextPolishJob(jobType)) {
    return {
      polishStatus: 'error',
      ...(error?.message ? { error: error.message } : {}),
    } as Partial<CanvasNodeData>
  }

  return {
    status: 'error',
    ...(error?.message ? { error: error.message } : {}),
  } as Partial<CanvasNodeData>
}

function activeJobToNodePatch(jobType: JobType, status: JobRecord['status']): Partial<CanvasNodeData> {
  if (isTextPolishJob(jobType)) {
    return { polishStatus: status === 'processing' ? 'running' : 'pending' } as Partial<CanvasNodeData>
  }

  return {
    status: 'pending',
    assetId: null,
  } as Partial<CanvasNodeData>
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
          ...terminalFailureToNodePatch(job.type, job.error),
        },
      }
    }

    if (job.status === 'pending' || job.status === 'processing') {
      return {
        ...node,
        data: {
          ...node.data,
          ...activeJobToNodePatch(job.type, job.status),
        },
      }
    }

    return node
  })
}

/**
 * Builds the generation task list shown after one-shot reopen reconciliation.
 * @param nodes - Loaded canvas nodes.
 * @param jobs - Persisted recent jobs, usually from `job.list`.
 * @returns Latest recoverable non-MJ generation task status per node.
 */
export function buildGenerationTaskStatusList<TNode extends ReconciledCanvasNode>(
  nodes: TNode[],
  jobs: JobRecord[],
): GenerationTaskStatus[] {
  const latestByTarget = selectLatestJobByTarget(jobs)

  return nodes.flatMap((node): GenerationTaskStatus[] => {
    if (!isRecoverableNodeType(node.type)) {
      return []
    }

    const job = latestByTarget.get(node.id)
    if (!job) {
      return []
    }

    return [
      {
        nodeId: node.id,
        nodeType: node.type,
        jobId: job.id,
        jobType: job.type,
        status: job.status,
        phase: job.status === 'pending' || job.status === 'processing' ? 'active' : 'terminal',
        progress: job.progress,
        ...(job.error?.message ? { errorMessage: job.error.message } : {}),
      },
    ]
  })
}
