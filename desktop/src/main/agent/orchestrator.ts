/**
 * AsyncGenerator orchestrator runtime for natural-language CanvasPlan creation.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/canvas-plan.md
 */

import type { AgentDefinition, AgentRunRequest, AgentRunStatus, AgentRunTicket, AgentToolApprovalInput, AgentTriggerKind } from '../../../../shared/agents'
import type { JobResult } from '../../../../shared/jobs'
import type { CanvasPlan } from '../../../../shared/plan'
import type { ToolDescriptor } from '../../../../shared/tools'
import type { AgentRunRepository } from '../db/repositories/agent-run.repo'
import type { PersistedJobRecord } from '../db/repositories/job.repo'
import type { ChatMessageRepository } from '../db/repositories/chat-message.repo'
import type { JobEventBus } from '../jobs/events'
import type { JobQueue } from '../jobs/queue'
import { AgentLoopTerminalError, createAgentContextLoop, type AgentContextLoopState, type AgentToolApprovalRequest } from './context-loop'
import type { AgentRegistry } from './registry'
import type { CanvasPlanEventBus } from './plan-events'
import { sanitizePlan } from './sanitize-plan'

export interface OrchestratorProgressDraft {
  type: 'progress'
  message: string
  progress: number
}

export interface OrchestratorPlanner {
  proposePlan(input: OrchestratorPlannerInput): AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> | Promise<CanvasPlan> | CanvasPlan
  resumeApprovedTool?(input: OrchestratorApprovalPlannerInput): AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> | Promise<CanvasPlan> | CanvasPlan
}

export interface OrchestratorPlannerInput {
  runId: string
  messageId: string
  message: string
  agentId: string
  agent?: AgentDefinition
  trigger?: AgentTriggerKind
  loop?: AgentContextLoopState
}

export interface OrchestratorApprovalPlannerInput extends OrchestratorPlannerInput {
  agent: AgentDefinition
  trigger: AgentTriggerKind
  loop: AgentContextLoopState
  approval: AgentToolApprovalRequest
  approvedBy: string
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
  trigger?: AgentTriggerKind
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
  registry?: AgentRegistry
  listTools?: () => ToolDescriptor[]
  agentRuns?: AgentRunRepository
  chatMessages?: ChatMessageRepository
  planEvents?: CanvasPlanEventBus
  idFactory?: (prefix: 'message' | 'run') => string
  planIdFactory?: () => string
  workflowId?: string
  clock?: () => number
}

export interface OrchestratorRuntime {
  chatSend(input: OrchestratorChatInput): OrchestratorChatTicket
  agentRun(input: AgentRunRequest): AgentRunTicket
  approveTool(input: AgentToolApprovalInput): AgentRunTicket | { errorClass: string; message: string; retryable: false }
  getRun(runId: string): { runId: string; status: AgentRunStatus; trace?: Record<string, unknown> } | null
  getPlan(messageId: string): CanvasPlan | null
  createJobHandler(): (job: PersistedJobRecord) => Promise<JobResult>
}

interface ApprovalResumePayload {
  kind: 'approval'
  runId: string
  messageId: string
  message: string
  agentId: string
  trigger: AgentTriggerKind
  approval: AgentToolApprovalRequest
  approvedBy: string
}

interface StoredRun {
  runId: string
  messageId: string
  planId?: string
  status: AgentRunStatus
  agentId?: string
  jobId?: string
  trigger?: AgentTriggerKind
  errorClass?: string
  droppedTools?: string[]
  compactionSummary?: string | null
  omittedMessages?: number
  pendingApproval?: AgentToolApprovalRequest
  pausedState?: AgentContextLoopState
  effectiveAgent?: AgentDefinition
}

function fallbackOrchestratorAgent(agentId: string): AgentDefinition {
  return {
    id: agentId,
    source: 'builtin',
    name: agentId === 'orchestrator' ? 'Orchestrator' : agentId,
    description: 'Fallback Agent definition for isolated orchestrator tests.',
    instructions: 'Analyze the user request and produce safe ComicCanvas plans.',
    allowedTools: '*',
    allowedSkills: '*',
    gatewayPolicy: { allowedChannels: ['text', 'image', 'video'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 8000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'provider.spend'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
    maxTurns: 8,
    effort: 'high',
    enabled: true
  }
}

function isAsyncIterable(value: unknown): value is AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value
}

function runFailureTrace(runId: string, messageId: string, previous: StoredRun | undefined, error: unknown): StoredRun {
  if (error instanceof AgentLoopTerminalError) {
    const status: AgentRunStatus = error.pendingApproval
      ? 'approval_required'
      : error.errorClass === 'agent_max_turns_exceeded' ? 'max_turns_exceeded' : 'failed'

    return {
      ...(previous ?? { runId, messageId }),
      runId,
      messageId,
      status,
      errorClass: error.errorClass,
      droppedTools: error.droppedTools,
      compactionSummary: error.compactionSummary,
      omittedMessages: error.omittedMessages,
      ...(error.pendingApproval ? { pendingApproval: error.pendingApproval } : {}),
      ...(error.pausedState ? { pausedState: error.pausedState } : {})
    }
  }

  return {
    ...(previous ?? { runId, messageId }),
    runId,
    messageId,
    status: 'failed',
    errorClass: error instanceof Error ? error.message : 'agent_run_failed'
  }
}

function applyContextPolicyOverride(agent: AgentDefinition, payload: Record<string, unknown>): AgentDefinition {
  const override = payload.contextPolicyOverride

  if (typeof override !== 'object' || override === null || Array.isArray(override)) {
    return agent
  }

  return {
    ...agent,
    contextPolicy: {
      ...agent.contextPolicy,
      ...(override as Partial<AgentDefinition['contextPolicy']>)
    }
  }
}

function approvalError(errorClass: string, message: string): { errorClass: string; message: string; retryable: false } {
  return { errorClass, message, retryable: false }
}

function runTrace(run: StoredRun): Record<string, unknown> {
  return {
    messageId: run.messageId,
    ...(run.planId ? { planId: run.planId } : {}),
    ...(run.agentId ? { agentId: run.agentId } : {}),
    ...(run.jobId ? { jobId: run.jobId } : {}),
    ...(run.trigger ? { trigger: run.trigger } : {}),
    ...(run.errorClass ? { errorClass: run.errorClass } : {}),
    ...(run.droppedTools ? { droppedTools: run.droppedTools } : {}),
    ...(run.compactionSummary !== undefined ? { compactionSummary: run.compactionSummary } : {}),
    ...(run.omittedMessages !== undefined ? { omittedMessages: run.omittedMessages } : {}),
    ...(run.pendingApproval ? { pendingApproval: run.pendingApproval } : {})
  }
}

function matchingApproval(run: StoredRun, input: AgentToolApprovalInput): AgentToolApprovalRequest | null {
  if (run.status !== 'approval_required' || !run.pendingApproval || !run.pausedState) {
    return null
  }

  if (run.pendingApproval.callId !== input.callId) {
    return null
  }

  return run.pendingApproval
}

function approvalPayload(value: Record<string, unknown>): ApprovalResumePayload | null {
  if (value.resumeKind !== 'approval') {
    return null
  }

  if (
    typeof value.runId !== 'string'
    || typeof value.messageId !== 'string'
    || typeof value.message !== 'string'
    || typeof value.agentId !== 'string'
    || typeof value.trigger !== 'string'
    || typeof value.approvedBy !== 'string'
    || typeof value.approval !== 'object'
    || value.approval === null
  ) {
    return null
  }

  const approval = value.approval as AgentToolApprovalRequest

  return {
    kind: 'approval',
    runId: value.runId,
    messageId: value.messageId,
    message: value.message,
    agentId: value.agentId,
    trigger: value.trigger as AgentTriggerKind,
    approval,
    approvedBy: value.approvedBy
  }
}

async function* plannerEvents(options: OrchestratorRunOptions): AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> {
  const input: OrchestratorPlannerInput = {
    runId: options.runId,
    messageId: options.messageId,
    message: options.message,
    agentId: options.agentId
  }

  if (options.agent) {
    input.agent = options.agent
  }

  if (options.trigger) {
    input.trigger = options.trigger
  }

  if (options.loop) {
    input.loop = options.loop
  }

  const proposed = options.planner.proposePlan(input)

  if (isAsyncIterable(proposed)) {
    return yield* proposed
  }

  return proposed
}

async function* approvalPlannerEvents(options: OrchestratorRunOptions & {
  agent: AgentDefinition
  trigger: AgentTriggerKind
  loop: AgentContextLoopState
  approval: AgentToolApprovalRequest
  approvedBy: string
}): AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> {
  if (!options.planner.resumeApprovedTool) {
    throw new Error('agent_approval_resume_unavailable')
  }

  const proposed = options.planner.resumeApprovedTool({
    runId: options.runId,
    messageId: options.messageId,
    message: options.message,
    agentId: options.agentId,
    agent: options.agent,
    trigger: options.trigger,
    loop: options.loop,
    approval: options.approval,
    approvedBy: options.approvedBy
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
          summary: `Create an image generation workflow for: ${message}`,
          nodes: [
            {
              ref: 'prompt-1',
              type: 'text',
              title: '提示词',
              data: {
                content: message
              }
            },
            {
              ref: 'image-1',
              type: 'imageConfigV2',
              title: '生成图片',
              data: {
                promptOverride: message,
                modelId: 'stub-image',
                orientation: 'landscape'
              }
            }
          ],
          edges: [{ source: 'prompt-1', target: 'image-1', edgeType: 'promptOrder' }],
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
            type: 'imageConfigV2',
            title: '关键画面生成',
            data: {
              promptOverride: message,
              modelId: 'stub-image',
              orientation: 'landscape',
              status: 'idle'
            }
          },
          {
            ref: 'video-gen',
            type: 'videoConfigV2',
            title: '短视频生成',
            data: {
              promptOverride: message,
              modelId: 'stub-video',
              orientation: 'landscape',
              durationSeconds: 5,
              firstFrameAssetId: null,
              lastFrameAssetId: null,
              assetId: null,
              status: 'idle'
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
          { source: 'key-image', target: 'video-gen', edgeType: 'imageRole', imageRole: 'first_frame' },
          { source: 'video-gen', target: 'compose', edgeType: 'default' },
          { source: 'voice', target: 'mux', edgeType: 'default' },
          { source: 'compose', target: 'mux', edgeType: 'default' }
        ],
        runSteps: [
          { ref: 'key-image', action: 'imageRun' },
          { ref: 'video-gen', action: 'videoRun' }
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

export async function* runApprovalOrchestrator(options: OrchestratorRunOptions & {
  agent: AgentDefinition
  trigger: AgentTriggerKind
  loop: AgentContextLoopState
  approval: AgentToolApprovalRequest
  approvedBy: string
}): AsyncGenerator<OrchestratorEvent, OrchestratorRunResult> {
  yield { type: 'progress', runId: options.runId, message: 'Resuming approved tool call', progress: 5 }
  const stream = approvalPlannerEvents(options)
  let next = await stream.next()

  while (!next.done) {
    yield { type: 'progress', runId: options.runId, message: next.value.message, progress: next.value.progress }
    next = await stream.next()
  }

  const plan = sanitizePlan(next.value)
  const planId = options.planIdFactory()
  yield { type: 'plan', runId: options.runId, messageId: options.messageId, planId, plan }

  return {
    runId: options.runId,
    messageId: options.messageId,
    planId,
    plan
  }
}

async function consumeRunStream(
  stream: AsyncGenerator<OrchestratorEvent, OrchestratorRunResult>,
  options: {
    jobId: string
    events: JobEventBus
    plansByMessage: Map<string, CanvasPlan>
    chatMessages?: ChatMessageRepository
    planEvents?: CanvasPlanEventBus
    runsById: Map<string, StoredRun>
    setRun: (run: StoredRun) => void
    agentId: string
    trigger: AgentTriggerKind
  }
): Promise<OrchestratorRunResult> {
  let next = await stream.next()

  while (!next.done) {
    if (next.value.type === 'progress') {
      options.events.emitProgress({
        channel: 'job.progress',
        jobId: options.jobId,
        progress: next.value.progress,
        message: next.value.message,
        emittedAt: Date.now()
      })
    }

    next = await stream.next()
  }

  options.plansByMessage.set(next.value.messageId, next.value.plan)
  options.chatMessages?.updatePlan(next.value.messageId, JSON.stringify(next.value.plan), 'draft')
  options.planEvents?.emitPlanReady({ messageId: next.value.messageId, planId: next.value.planId })
  options.setRun({
    ...(options.runsById.get(next.value.runId) ?? { runId: next.value.runId, messageId: next.value.messageId }),
    runId: next.value.runId,
    messageId: next.value.messageId,
    planId: next.value.planId,
    status: 'completed',
    agentId: options.agentId,
    trigger: options.trigger
  })

  return next.value
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

  function setRun(run: StoredRun): void {
    runsById.set(run.runId, run)

    if (!options.agentRuns) {
      return
    }

    const existing = options.agentRuns.getById(run.runId)
    const record = {
      id: run.runId,
      agentId: run.agentId ?? existing?.agentId ?? 'orchestrator',
      status: run.status,
      trace: runTrace(run),
      createdAt: existing?.createdAt ?? clock(),
      updatedAt: clock(),
      ...(run.jobId ? { jobId: run.jobId } : {}),
      ...(run.errorClass ? { errorClass: run.errorClass } : {})
    }

    options.agentRuns.upsert(record)
  }

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
          agentId: input.agentId ?? 'orchestrator',
          trigger: input.trigger ?? 'canvasChat'
        },
        requestedBy: { type: 'user', id: input.requestedBy }
      })

      setRun({ runId, messageId, status: 'pending', agentId: input.agentId ?? 'orchestrator', jobId: ticket.jobId, trigger: input.trigger ?? 'canvasChat' })
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
    agentRun(input) {
      const messageId = idFactory('message')
      const runId = idFactory('run')
      const agent = options.registry ? options.registry.get(input.agentId) : fallbackOrchestratorAgent(input.agentId)
      const trigger = agent?.triggerPolicy.defaultTrigger ?? 'manual'
      const ticket = options.queue.enqueue({
        type: 'agent.run',
        targetId: messageId,
        payload: {
          runId,
          messageId,
          message: input.message,
          agentId: input.agentId,
          trigger,
          ...(input.contextPolicyOverride ? { contextPolicyOverride: input.contextPolicyOverride } : {})
        },
        requestedBy: { type: 'user', id: 'agent.run' }
      })

      setRun({ runId, messageId, status: 'pending', agentId: input.agentId, jobId: ticket.jobId, trigger })
      options.chatMessages?.create({
        id: messageId,
        ...(options.workflowId ? { workflowId: options.workflowId } : {}),
        agentRunId: runId,
        role: 'user',
        content: input.message,
        createdAt: clock()
      })

      return { runId, jobId: ticket.jobId, status: 'pending' }
    },
    approveTool(input) {
      const run = runsById.get(input.runId)

      if (!run) {
        return approvalError('agent_not_found', 'Agent run was not found.')
      }

      const approval = matchingApproval(run, input)

      if (!approval || !run.pausedState || !run.agentId || !run.trigger) {
        return approvalError('agent_approval_unavailable', 'Agent run is not waiting for this approval.')
      }

      const ticket = options.queue.enqueue({
        type: 'agent.run',
        targetId: run.messageId,
        payload: {
          resumeKind: 'approval',
          runId: run.runId,
          messageId: run.messageId,
          message: run.pausedState.userMessage,
          agentId: run.agentId,
          trigger: run.trigger,
          approval,
          approvedBy: input.approvedBy
        },
        requestedBy: { type: 'user', id: input.approvedBy }
      })

      const nextRun: StoredRun = {
        ...run,
        status: 'pending',
        jobId: ticket.jobId
      }
      delete nextRun.errorClass
      setRun(nextRun)

      return { runId: run.runId, jobId: ticket.jobId, status: 'pending' }
    },
    getRun(runId) {
      const run = runsById.get(runId)

      if (!run) {
        const persisted = options.agentRuns?.getById(runId)

        if (!persisted) {
          return null
        }

        return { runId: persisted.id, status: persisted.status, trace: persisted.trace }
      }

      return { runId: run.runId, status: run.status, trace: runTrace(run) }
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
        const approval = approvalPayload(job.payload)

        if (approval) {
          const run = runsById.get(approval.runId)
          const resolvedAgent = options.registry ? options.registry.get(approval.agentId) : fallbackOrchestratorAgent(approval.agentId)

          if (!run || !run.pausedState || !resolvedAgent) {
            throw new Error('agent_approval_unavailable')
          }

          const agent = run.effectiveAgent ?? resolvedAgent
          setRun({ ...run, status: 'running', jobId: job.id, effectiveAgent: agent })

          try {
            const stream = runApprovalOrchestrator({
              runId: approval.runId,
              messageId: approval.messageId,
              message: approval.message,
              agentId: approval.agentId,
              agent,
              trigger: approval.trigger,
              loop: run.pausedState,
              approval: approval.approval,
              approvedBy: approval.approvedBy,
              planner: options.planner,
              planIdFactory
            })
            const result = await consumeRunStream(stream, {
              jobId: job.id,
              events: options.events,
              plansByMessage,
              ...(options.chatMessages ? { chatMessages: options.chatMessages } : {}),
              ...(options.planEvents ? { planEvents: options.planEvents } : {}),
              runsById,
              setRun,
              agentId: approval.agentId,
              trigger: approval.trigger
            })

            return { kind: 'agentRun', runId: result.runId, planId: result.planId }
          } catch (error) {
            setRun(runFailureTrace(approval.runId, approval.messageId, runsById.get(approval.runId), error))
            throw error
          }
        }

        const runId = typeof job.payload.runId === 'string' ? job.payload.runId : idFactory('run')
        const messageId = typeof job.payload.messageId === 'string' ? job.payload.messageId : job.id
        const message = typeof job.payload.message === 'string' ? job.payload.message : ''
        const agentId = typeof job.payload.agentId === 'string' ? job.payload.agentId : 'orchestrator'
        const trigger = typeof job.payload.trigger === 'string' ? job.payload.trigger as AgentTriggerKind : 'canvasChat'
        const resolvedAgent = options.registry ? options.registry.get(agentId) : fallbackOrchestratorAgent(agentId)
        if (!resolvedAgent) {
          setRun({ runId, messageId, status: 'failed', agentId, trigger, errorClass: 'agent_not_found' })
          throw new Error('agent_not_found')
        }
        const agent = applyContextPolicyOverride(resolvedAgent, job.payload)

        if (!agent || !agent.enabled || !agent.triggerPolicy.allowedTriggers.includes(trigger)) {
          setRun({ runId, messageId, status: 'failed', agentId, trigger, errorClass: 'agent_not_found' })
          throw new Error('agent_not_found')
        }
        const loop = createAgentContextLoop({
          agent,
          trigger,
          message,
          availableTools: options.listTools?.() ?? []
        })

        setRun({ ...(runsById.get(runId) ?? { runId, messageId }), runId, messageId, status: 'running', agentId, trigger, effectiveAgent: agent })

        try {
          const stream = runOrchestrator({
            runId,
            messageId,
            message,
            agentId,
            agent,
            trigger,
            loop,
            planner: options.planner,
            planIdFactory
          })
          const result = await consumeRunStream(stream, {
            jobId: job.id,
            events: options.events,
            plansByMessage,
            ...(options.chatMessages ? { chatMessages: options.chatMessages } : {}),
            ...(options.planEvents ? { planEvents: options.planEvents } : {}),
            runsById,
            setRun,
            agentId,
            trigger
          })

          return { kind: 'agentRun', runId, planId: result.planId }
        } catch (error) {
          setRun(runFailureTrace(runId, messageId, runsById.get(runId), error))
          throw error
        }
      }
    }
  }
}
