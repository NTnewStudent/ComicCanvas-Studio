/**
 * AsyncGenerator orchestrator runtime for natural-language CanvasPlan creation.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/canvas-plan.md
 */

import type { AgentRunStatus } from '../../../../shared/agents'
import type { JobResult } from '../../../../shared/jobs'
import type { CanvasPlan } from '../../../../shared/plan'
import type { PersistedJobRecord } from '../db/repositories/job.repo'
import type { ChatMessageRepository } from '../db/repositories/chat-message.repo'
import type { JobEventBus } from '../jobs/events'
import type { JobQueue } from '../jobs/queue'
import type { CanvasPlanEventBus } from './plan-events'
import { sanitizePlan } from './sanitize-plan'

export interface OrchestratorProgressDraft {
  type: 'progress'
  message: string
  progress: number
}

export interface OrchestratorPlanner {
  proposePlan(input: OrchestratorPlannerInput): AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> | Promise<CanvasPlan> | CanvasPlan
}

export interface OrchestratorPlannerInput {
  runId: string
  messageId: string
  message: string
  agentId: string
}

export type OrchestratorEvent =
  | { type: 'progress'; runId: string; message: string; progress: number }
  | { type: 'plan'; runId: string; messageId: string; planId: string; plan: CanvasPlan }

export interface OrchestratorRunResult {
  runId: string
  messageId: string
  planId: string
  plan: CanvasPlan
}

export interface OrchestratorRunOptions extends OrchestratorPlannerInput {
  planner: OrchestratorPlanner
  planIdFactory: () => string
}

export interface OrchestratorChatInput {
  message: string
  agentId?: string
  requestedBy: string
}

export interface OrchestratorChatTicket {
  jobId: string
  messageId: string
  status: 'pending'
}

export interface OrchestratorRuntimeOptions {
  queue: JobQueue
  events: JobEventBus
  planner: OrchestratorPlanner
  chatMessages?: ChatMessageRepository
  planEvents?: CanvasPlanEventBus
  idFactory?: (prefix: 'message' | 'run') => string
  planIdFactory?: () => string
  workflowId?: string
  clock?: () => number
}

export interface OrchestratorRuntime {
  chatSend(input: OrchestratorChatInput): OrchestratorChatTicket
  getPlan(messageId: string): CanvasPlan | null
  createJobHandler(): (job: PersistedJobRecord) => Promise<JobResult>
}

interface StoredRun {
  runId: string
  messageId: string
  planId?: string
  status: AgentRunStatus
}

function isAsyncIterable(value: unknown): value is AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value
}

async function* plannerEvents(options: OrchestratorRunOptions): AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> {
  const proposed = options.planner.proposePlan({
    runId: options.runId,
    messageId: options.messageId,
    message: options.message,
    agentId: options.agentId
  })

  if (isAsyncIterable(proposed)) {
    return yield* proposed
  }

  return proposed
}

/**
 * Creates the built-in planner used when no model-backed planner has been
 * configured yet. It deliberately emits the accepted ComicCanvas migration
 * vocabulary instead of a one-node demo for comic-drama requests.
 * @returns The default deterministic orchestrator planner.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createDefaultOrchestratorPlanner(): OrchestratorPlanner {
  return {
    proposePlan(input): CanvasPlan {
      const message = input.message.trim()
      const wantsComicDrama = /漫画|短剧|角色|场景|配音|音频|合成|comic|drama|storyboard|episode|voice/i.test(message)

      if (!wantsComicDrama) {
        return {
          kind: 'plan',
          summary: `Create an image node for: ${message}`,
          nodes: [
            {
              ref: 'image-1',
              type: 'image',
              title: '生成图片',
              data: {
                promptOverride: message,
                modelId: 'stub-image',
                orientation: 'landscape'
              }
            }
          ],
          edges: [],
          runSteps: [{ ref: 'image-1', action: 'imageRun' }],
          question: null,
          dropped: []
        }
      }

      return {
        kind: 'plan',
        summary: `Create a comic-drama canvas workflow for: ${message}`,
        nodes: [
          {
            ref: 'story',
            type: 'text',
            title: '故事需求',
            data: {
              content: message
            }
          },
          {
            ref: 'character',
            type: 'character',
            title: '主角',
            data: {
              description: '从用户需求中提炼主角外观、身份、情绪和服装。'
            }
          },
          {
            ref: 'scene',
            type: 'scene',
            title: '场景',
            data: {
              description: '从用户需求中提炼环境、时间、氛围和关键道具。',
              category: 'exterior'
            }
          },
          {
            ref: 'key-image',
            type: 'mjImage',
            title: '关键画面',
            data: {
              prompt: message,
              modelId: 'stub-image',
              ratio: '16:9',
              status: 'idle',
              assetId: null,
              selectedIndex: 0
            }
          },
          {
            ref: 'voice',
            type: 'audio',
            title: '配音/环境声',
            data: {
              assetId: null,
              durationSeconds: 8,
              status: 'idle'
            }
          },
          {
            ref: 'compose',
            type: 'videoCompose',
            title: '视频合成',
            data: {
              inputOrder: [],
              transitionName: 'crossfade',
              modelId: 'local-compose',
              assetId: null,
              status: 'idle'
            }
          },
          {
            ref: 'mux',
            type: 'muxAudioVideo',
            title: '音视频合成',
            data: {
              modelId: 'local-mux',
              assetId: null,
              status: 'idle'
            }
          }
        ],
        edges: [
          { source: 'story', target: 'character', edgeType: 'promptOrder' },
          { source: 'story', target: 'scene', edgeType: 'promptOrder' },
          { source: 'story', target: 'key-image', edgeType: 'promptOrder' },
          { source: 'character', target: 'key-image', edgeType: 'default' },
          { source: 'scene', target: 'key-image', edgeType: 'default' },
          { source: 'key-image', target: 'compose', edgeType: 'default' },
          { source: 'voice', target: 'mux', edgeType: 'default' },
          { source: 'compose', target: 'mux', edgeType: 'default' }
        ],
        runSteps: [
          { ref: 'key-image', action: 'mjImageRun' },
          { ref: 'voice', action: 'audioRun' },
          { ref: 'compose', action: 'videoComposeRun' },
          { ref: 'mux', action: 'muxAudioVideoRun' }
        ],
        question: null,
        dropped: []
      }
    }
  }
}

/**
 * Runs one orchestrator turn as an AsyncGenerator state machine.
 * @param options - Run IDs, user message, planner, and plan ID dependency.
 * @returns Final run result containing the produced CanvasPlan.
 * @throws Error when the planner fails or returns an invalid plan.
 * @see docs/api-contracts/agents.md
 */
export async function* runOrchestrator(options: OrchestratorRunOptions): AsyncGenerator<OrchestratorEvent, OrchestratorRunResult> {
  let state: 'start' | 'planning' | 'completed' = 'start'
  let plan: CanvasPlan | undefined
  let planId = ''

  while (true) {
    if (state === 'start') {
      yield { type: 'progress', runId: options.runId, message: 'Starting orchestration', progress: 5 }
      state = 'planning'
      continue
    }

    if (state === 'planning') {
      const stream = plannerEvents(options)
      let next = await stream.next()

      while (!next.done) {
        yield { type: 'progress', runId: options.runId, message: next.value.message, progress: next.value.progress }
        next = await stream.next()
      }

      plan = sanitizePlan(next.value)
      planId = options.planIdFactory()
      yield { type: 'plan', runId: options.runId, messageId: options.messageId, planId, plan }
      state = 'completed'
      continue
    }

    if (!plan) {
      throw new Error('agent_run_failed')
    }

    return {
      runId: options.runId,
      messageId: options.messageId,
      planId,
      plan
    }
  }
}

/**
 * Creates the orchestrator runtime used by chat IPC and agent job workers.
 * @param options - Queue, event bus, planner, and deterministic ID dependencies.
 * @returns Runtime facade for chat submission, plan lookup, and job handling.
 * @throws Error never intentionally during construction; job handler failures propagate to JobWorker.
 * @see docs/api-contracts/agents.md
 */
export function createOrchestratorRuntime(options: OrchestratorRuntimeOptions): OrchestratorRuntime {
  const idFactory = options.idFactory ?? ((prefix: 'message' | 'run') => `${prefix}-${crypto.randomUUID()}`)
  const planIdFactory = options.planIdFactory ?? (() => `plan-${crypto.randomUUID()}`)
  const clock = options.clock ?? Date.now
  const plansByMessage = new Map<string, CanvasPlan>()
  const runsById = new Map<string, StoredRun>()

  return {
    chatSend(input) {
      const messageId = idFactory('message')
      const runId = idFactory('run')
      const ticket = options.queue.enqueue({
        type: 'agent.run',
        targetId: messageId,
        payload: {
          runId,
          messageId,
          message: input.message,
          agentId: input.agentId ?? 'orchestrator'
        },
        requestedBy: { type: 'user', id: input.requestedBy }
      })

      runsById.set(runId, { runId, messageId, status: 'pending' })
      options.chatMessages?.create({
        id: messageId,
        ...(options.workflowId ? { workflowId: options.workflowId } : {}),
        agentRunId: runId,
        role: 'user',
        content: input.message,
        createdAt: clock()
      })

      return { jobId: ticket.jobId, messageId, status: 'pending' }
    },
    getPlan(messageId) {
      const storedPlan = plansByMessage.get(messageId)

      if (storedPlan) {
        return storedPlan
      }

      const planJson = options.chatMessages?.getById(messageId)?.planJson

      if (!planJson) {
        return null
      }

      try {
        return sanitizePlan(JSON.parse(planJson) as unknown)
      } catch {
        // Corrupt stored plan JSON must not leak parser errors through chatGetPlan.
        return null
      }
    },
    createJobHandler() {
      return async (job) => {
        const runId = typeof job.payload.runId === 'string' ? job.payload.runId : idFactory('run')
        const messageId = typeof job.payload.messageId === 'string' ? job.payload.messageId : job.id
        const message = typeof job.payload.message === 'string' ? job.payload.message : ''
        const agentId = typeof job.payload.agentId === 'string' ? job.payload.agentId : 'orchestrator'

        runsById.set(runId, { runId, messageId, status: 'running' })

        const stream = runOrchestrator({
          runId,
          messageId,
          message,
          agentId,
          planner: options.planner,
          planIdFactory
        })
        let next = await stream.next()

        while (!next.done) {
          if (next.value.type === 'progress') {
            options.events.emitProgress({
              channel: 'job.progress',
              jobId: job.id,
              progress: next.value.progress,
              message: next.value.message,
              emittedAt: Date.now()
            })
          }

          next = await stream.next()
        }

        plansByMessage.set(messageId, next.value.plan)
        options.chatMessages?.updatePlan(messageId, JSON.stringify(next.value.plan), 'draft')
        options.planEvents?.emitPlanReady({ messageId, planId: next.value.planId })
        runsById.set(runId, { runId, messageId, planId: next.value.planId, status: 'completed' })

        return { kind: 'agentRun', runId, planId: next.value.planId }
      }
    }
  }
}
