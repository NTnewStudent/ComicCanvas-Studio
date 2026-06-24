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
