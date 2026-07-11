/**
 * 会话 store — 统一订阅 Agent IPC 事件并用共享 reducer 组装消息块。
 *
 * `ChatPanel` 与 `CanvasChatBox` 各自创建实例（依赖注入 preload API 与
 * applyPlan 行为），共享同一实现；块组装规则唯一真源在
 * `shared/chat-blocks.ts`。
 *
 * @see docs/api-contracts/agents.md
 */

import { createStore, type StoreApi } from 'zustand/vanilla'

import type { PermissionGrantScope } from '../../../../../../shared/agent-run-events'
import type { AgentNonCanvasResponse, AgentResponse, AgentRunViewResponse } from '../../../../../../shared/agents'
import {
  applyAgentEvent,
  createAssistantTurn,
  userTurnFromContent,
  type AgentChatEvent,
  type ChatTurn,
} from '../../../../../../shared/chat-blocks'
import type { CanvasPlan } from '../../../../../../shared/plan'
import type { ToolPermission } from '../../../../../../shared/tools'
import { formatAgentTraceSummary } from '../agent-trace-summary'
import { applyAgentPlanOnReady } from '../agent/apply-agent-plan-on-ready'
import { approvalRequestFromJobFailure, isApprovalRequiredJobFailure } from '../agent/approval-job-failure'
import { agentResponseFromTrace, errorClassFromTrace } from '../agent/run-trace-state'

interface JobFailedError {
  errorClass: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

/** chatStore 依赖的 preload API 子集（可注入 fake 以便测试）。 */
export interface ChatStoreApi {
  sendCanvasChat(input: { message: string; agentId: string }): Promise<{ runId: string; jobId: string; messageId: string; status: 'pending' }>
  getCanvasPlan(input: { messageId: string }): Promise<CanvasPlan>
  approveAgentTool?(input: { runId: string; callId: string; approvedBy: string; scope?: PermissionGrantScope }): Promise<{ runId: string; jobId: string; status: 'pending' } | { errorClass: string; message: string; retryable: false }>
  denyAgentTool?(input: { runId: string; callId: string; deniedBy: string }): Promise<{ runId: string; status: 'aborted'; errorClass: 'agent_tool_denied' } | { errorClass: string; message: string; retryable: boolean }>
  getAgentRun?(input: { runId: string }): Promise<AgentRunViewResponse>
  getChatHistory?(input: { workflowId: string }): Promise<ChatTurn[]>
  onCanvasPlanReady?(handler: (event: { messageId: string; planId: string }) => void): () => void
  onAgentResponseReady?(handler: (event: { runId: string; messageId: string; response: AgentNonCanvasResponse }) => void): () => void
  onAgentDelta?(handler: (event: { runId: string; messageId: string; delta: string }) => void): () => void
  onAgentToolStarted?(handler: (event: { runId: string; messageId: string; callId: string; toolId: string; inputSummary: string }) => void): () => void
  onAgentToolCompleted?(handler: (event: { runId: string; messageId: string; callId: string; toolId: string; invocationId: string; status: 'completed' | 'failed' | 'denied'; summary: string }) => void): () => void
  onAgentPermissionRequired?(handler: (event: { runId: string; messageId: string; callId: string; toolId: string; reason: string; requiredPermissions?: ToolPermission[] }) => void): () => void
  onJobProgress?(handler: (event: { jobId: string; progress: number; message?: string }) => void): () => void
  onJobCompleted?(handler: (event: { jobId: string; result: { kind: string; runId?: string; planId?: string; response?: AgentResponse } }) => void): () => void
  onJobFailed?(handler: (event: { jobId: string; error: JobFailedError }) => void): () => void
}

export interface ChatStoreState {
  turns: ChatTurn[]
  busy: boolean
  permissionBusy: boolean
  autoExecute: boolean
  plansById: Record<string, CanvasPlan>
  /** 已应用到画布的 planId（含自动 apply），用于 PlanCard 去重展示。 */
  appliedPlanIds: string[]
  pending: { messageId: string; runId: string; jobId: string; agentAutoRun: boolean } | null
  activeRunId: string | null
  activeRunView: AgentRunViewResponse | null
  send(input: { message: string; agentId: string; agentAutoRun?: boolean | undefined }): Promise<void>
  approvePermission(callId: string, scope?: PermissionGrantScope): Promise<void>
  denyPermission(callId: string): Promise<void>
  setAutoExecute(value: boolean): void
  markPlanApplied(planId: string): void
  stopWaiting(): void
  restore(workflowId: string): Promise<void>
  clearView(): void
}

export interface ChatStoreDeps {
  api: ChatStoreApi
  /** Task 60 自动 apply 出口；宿主接 applyPlan/PlanRunner。 */
  applyPlan?: (plan: CanvasPlan, options: { autoExecute: boolean }) => void
  clock?: () => number
  /** React 宿主在 effect 中启动订阅，避免 StrictMode render 阶段产生泄漏。 */
  deferSubscriptions?: boolean
}

export interface ChatStoreHandle {
  store: StoreApi<ChatStoreState>
  /** 注册 IPC 事件订阅；重复调用幂等，dispose 后可再次启动。 */
  start(): void
  /** 取消全部 IPC 订阅。 */
  dispose(): void
}

function latestSnapshotSequence(view: AgentRunViewResponse | null): number | null {
  const events = view?.snapshot?.events
  if (!events || events.length === 0) {
    return null
  }

  return events.reduce((latest, event) => Math.max(latest, event.sequence), 0)
}

function isTerminalRunStatus(status: AgentRunViewResponse['status']): boolean {
  return status === 'completed'
    || status === 'failed'
    || status === 'aborted'
    || status === 'max_turns_exceeded'
}

/**
 * 创建会话 store 并订阅 Agent IPC 事件。
 * @param deps - preload API、可选 applyPlan 出口与时钟。
 * @returns store 实例与订阅清理函数。
 * @throws Error never intentionally; IPC 失败转为回合内错误块。
 */
export function createChatStore(deps: ChatStoreDeps): ChatStoreHandle {
  const clock = deps.clock ?? Date.now
  let conversationOperationId = 0
  const terminalRunIds = new Set<string>()
  const reconcileGenerationByRun = new Map<string, number>()
  const hydratingPlanIds = new Set<string>()
  let reconcileFromRunSnapshot: (runId: string) => Promise<void> = async () => {
    // 在 createStore 初始化前占位；订阅注册时会被真实实现替换。
  }

  function nextReconcileGeneration(runId: string): number {
    const generation = (reconcileGenerationByRun.get(runId) ?? 0) + 1
    reconcileGenerationByRun.set(runId, generation)
    return generation
  }

  function markRunTerminal(runId: string): void {
    terminalRunIds.add(runId)
    nextReconcileGeneration(runId)
  }

  const store = createStore<ChatStoreState>((set, get) => {
    function applyToPending(event: AgentChatEvent): void {
      const pending = get().pending
      if (!pending) {
        return
      }

      set((state) => ({
        turns: state.turns.map((turn) =>
          turn.role === 'assistant' && turn.messageId === pending.messageId ? applyAgentEvent(turn, event) : turn,
        ),
      }))
    }

    function finishPending(): void {
      set({ busy: false, pending: null })
    }

    function hydrateProjectedPlans(turn: ChatTurn, operationId: number): void {
      if (!turn.messageId) {
        return
      }

      for (const block of turn.blocks) {
        if (
          block.kind !== 'plan'
          || get().plansById[block.planId]
          || hydratingPlanIds.has(block.planId)
        ) {
          continue
        }

        hydratingPlanIds.add(block.planId)
        void deps.api.getCanvasPlan({ messageId: turn.messageId })
          .then((plan) => {
            if (operationId !== conversationOperationId) {
              return
            }
            const stillProjected = get().turns.some((candidate) => {
              return candidate.role === 'assistant'
                && candidate.messageId === turn.messageId
                && candidate.blocks.some((candidateBlock) => {
                  return candidateBlock.kind === 'plan' && candidateBlock.planId === block.planId
                })
            })
            if (!stillProjected) {
              return
            }
            set((state) => ({
              plansById: {
                ...state.plansById,
                [block.planId]: plan
              }
            }))
          })
          .catch(() => {
            // Missing historical plans keep their projected placeholder block.
          })
          .finally(() => {
            hydratingPlanIds.delete(block.planId)
          })
      }
    }

    async function reconcileFromRunSnapshotImpl(runId: string): Promise<void> {
      if (!deps.api.getAgentRun) {
        return
      }

      const generation = nextReconcileGeneration(runId)
      try {
        const run = await deps.api.getAgentRun({ runId })
        if (get().activeRunId !== runId && get().pending?.runId !== runId) {
          return
        }
        if (terminalRunIds.has(runId) && !isTerminalRunStatus(run.status)) {
          return
        }

        const currentView = get().activeRunView
        const currentSequence = currentView?.runId === runId
          ? latestSnapshotSequence(currentView)
          : null
        const incomingSequence = latestSnapshotSequence(run)
        const latestGeneration = reconcileGenerationByRun.get(runId) ?? generation
        if (
          generation < latestGeneration
          && (
            incomingSequence === null
            || (currentSequence !== null && incomingSequence <= currentSequence)
          )
        ) {
          return
        }
        if (currentView?.runId === runId) {
          if (currentSequence !== null && (incomingSequence === null || incomingSequence < currentSequence)) {
            return
          }
        }

        if (isTerminalRunStatus(run.status)) {
          markRunTerminal(runId)
        }
        set({ activeRunId: runId, activeRunView: run })

        if (
          !get().pending
          && (run.status === 'pending' || run.status === 'running' || run.status === 'approval_required')
          && run.snapshot?.run.jobId
        ) {
          set({
            busy: true,
            pending: {
              runId,
              messageId: run.snapshot.run.messageId,
              jobId: run.snapshot.run.jobId,
              agentAutoRun: false
            }
          })
        }

        if (run.projection) {
          const projectedTurn = run.projection.chatTurn
          const replaceBlocks = projectedTurn.blocks.length > 0
            || isTerminalRunStatus(run.status)
            || run.status === 'approval_required'
          set((state) => {
            let matched = false
            const turns = state.turns.map((turn) => {
              if (turn.role !== 'assistant' || (turn.runId !== runId && turn.messageId !== projectedTurn.messageId)) {
                return turn
              }

              matched = true
              if (replaceBlocks) {
                return projectedTurn
              }
              return {
                ...turn,
                status: projectedTurn.status
              }
            })

            return { turns: matched ? turns : [...turns, projectedTurn] }
          })
          hydrateProjectedPlans(projectedTurn, conversationOperationId)

          if (projectedTurn.status === 'completed' || projectedTurn.status === 'failed') {
            finishPending()
          }
          return
        }

        for (const line of formatAgentTraceSummary(run.trace)) {
          applyToPending({ type: 'progress', message: line })
        }

        const response = agentResponseFromTrace(run.trace)
        if (response && response.type !== 'canvasPlan') {
          applyToPending({ type: 'responseReady', response })
          finishPending()
          return
        }

        if (run.status === 'completed') {
          finishPending()
          return
        }

        const errorClass = errorClassFromTrace(run.trace)
        if (run.status === 'failed' && errorClass && errorClass !== 'agent_tool_approval_required') {
          applyToPending({ type: 'runFailed', errorClass, message: 'Agent 运行失败。', retryable: false })
          finishPending()
        }
      } catch {
        // 快照恢复失败不影响正常事件流。
      }
    }

    reconcileFromRunSnapshot = reconcileFromRunSnapshotImpl

    return {
      turns: [],
      busy: false,
      permissionBusy: false,
      autoExecute: false,
      plansById: {},
      appliedPlanIds: [],
      pending: null,
      activeRunId: null,
      activeRunView: null,

      async send(input) {
        if (get().busy || input.message.trim().length === 0) {
          return
        }

        const operationId = ++conversationOperationId
        set((state) => ({
          busy: true,
          turns: [...state.turns, userTurnFromContent({ id: `user-${clock()}`, content: input.message, createdAt: clock() })],
        }))

        try {
          const ticket = await deps.api.sendCanvasChat({ message: input.message, agentId: input.agentId })
          if (operationId !== conversationOperationId) {
            return
          }

          set((state) => ({
            pending: { messageId: ticket.messageId, runId: ticket.runId, jobId: ticket.jobId, agentAutoRun: input.agentAutoRun === true },
            activeRunId: ticket.runId,
            activeRunView: null,
            turns: [
              ...state.turns,
              createAssistantTurn({ id: `assistant-${ticket.messageId}`, runId: ticket.runId, messageId: ticket.messageId, createdAt: clock() }),
            ],
          }))
          terminalRunIds.delete(ticket.runId)
          applyToPending({ type: 'progress', message: `Agent 已排队：${ticket.jobId}` })

          // 补拉运行快照：排队早于事件订阅时 progress/response 可能已经落库。
          void reconcileFromRunSnapshotImpl(ticket.runId)
        } catch {
          if (operationId !== conversationOperationId) {
            return
          }

          // 发送失败必须可见；补一个失败的 assistant 回合。
          set((state) => ({
            busy: false,
            turns: [
              ...state.turns,
              applyAgentEvent(
                createAssistantTurn({ id: `assistant-error-${clock()}`, createdAt: clock() }),
                { type: 'runFailed', errorClass: 'agent_send_failed', message: '发送失败，请重试。', retryable: true },
              ),
            ],
          }))
        }
      },

      async approvePermission(callId, scope = 'session') {
        const pending = get().pending
        if (!pending || !deps.api.approveAgentTool) {
          return
        }

        set({ permissionBusy: true })
        try {
          const result = await deps.api.approveAgentTool({ runId: pending.runId, callId, approvedBy: 'chat-user', scope })
          if ('errorClass' in result) {
            throw new Error(result.message)
          }

          applyToPending({ type: 'permissionResolved', callId, decision: 'approved', scope })
          set({ pending: { ...pending, jobId: result.jobId }, busy: true })

          // resume 事件可能在批准与订阅之间丢失，从运行快照兜底恢复终态。
          void reconcileFromRunSnapshotImpl(pending.runId)
        } catch {
          // Durable Run 仍在等待授权；保留 pending 让用户可重试批准或改为拒绝。
          applyToPending({ type: 'runFailed', errorClass: 'agent_approval_failed', message: '工具批准失败，请重试。', retryable: true })
          set({ busy: true })
        } finally {
          set({ permissionBusy: false })
        }
      },

      async denyPermission(callId) {
        const pending = get().pending
        if (!pending || !deps.api.denyAgentTool) {
          return
        }

        set({ permissionBusy: true })
        try {
          const result = await deps.api.denyAgentTool({
            runId: pending.runId,
            callId,
            deniedBy: 'chat-user'
          })
          if (!('status' in result) || result.errorClass !== 'agent_tool_denied') {
            throw new Error('message' in result ? result.message : 'Agent denial failed.')
          }

          applyToPending({ type: 'permissionResolved', callId, decision: 'denied' })
          applyToPending({ type: 'runFailed', errorClass: 'agent_tool_denied', message: '已拒绝工具调用，Agent 已停止。', retryable: false })
          markRunTerminal(pending.runId)
          finishPending()
          void reconcileFromRunSnapshotImpl(pending.runId)
        } catch {
          applyToPending({ type: 'runFailed', errorClass: 'agent_denial_failed', message: '拒绝操作未保存，请重试。', retryable: true })
          set({ busy: true })
        } finally {
          set({ permissionBusy: false })
        }
      },

      setAutoExecute(value) {
        set({ autoExecute: value })
      },

      markPlanApplied(planId) {
        set((state) => (state.appliedPlanIds.includes(planId) ? state : { appliedPlanIds: [...state.appliedPlanIds, planId] }))
      },

      stopWaiting() {
        conversationOperationId += 1
        set({ busy: false, pending: null, permissionBusy: false })
      },

      async restore(workflowId) {
        if (!deps.api.getChatHistory) {
          return
        }

        const operationId = ++conversationOperationId
        try {
          const turns = await deps.api.getChatHistory({ workflowId })
          if (operationId !== conversationOperationId) {
            return
          }

          const latestRunTurn = [...turns].reverse().find((turn) => turn.runId)
          set({
            turns,
            activeRunId: latestRunTurn?.runId ?? null,
            activeRunView: null,
            busy: false,
            pending: null,
            permissionBusy: false
          })

          if (latestRunTurn?.runId) {
            await reconcileFromRunSnapshotImpl(latestRunTurn.runId)
          }
          if (operationId !== conversationOperationId) {
            return
          }

          // 恢复的 plan 块补拉 plan 内容，使 PlanCard 在重启后仍可用。
          for (const turn of turns) {
            if (turn.role === 'assistant') {
              hydrateProjectedPlans(turn, operationId)
            }
          }
        } catch {
          // 历史恢复失败保持空会话即可，不阻塞新对话。
        }
      },

      clearView() {
        conversationOperationId += 1
        set({ turns: [], busy: false, pending: null, permissionBusy: false, activeRunId: null, activeRunView: null })
      },
    }
  })

  function matchesPendingMessage(messageId: string): boolean {
    return store.getState().pending?.messageId === messageId
  }

  function applyEvent(event: AgentChatEvent): void {
    const pending = store.getState().pending
    if (!pending) {
      return
    }

    store.setState((state) => ({
      turns: state.turns.map((turn) =>
        turn.role === 'assistant' && turn.messageId === pending.messageId ? applyAgentEvent(turn, event) : turn,
      ),
    }))
  }

  const unsubscribers: Array<() => void> = []
  let started = false

  function start(): void {
    if (started) {
      return
    }

    started = true

    if (deps.api.onAgentDelta) {
      unsubscribers.push(deps.api.onAgentDelta((event) => {
        if (matchesPendingMessage(event.messageId)) {
          applyEvent({ type: 'delta', delta: event.delta })
        }
      }))
    }

    if (deps.api.onJobProgress) {
      unsubscribers.push(deps.api.onJobProgress((event) => {
        const pending = store.getState().pending
        if (pending && event.jobId === pending.jobId && event.message) {
          applyEvent({ type: 'progress', message: event.message })
        }
      }))
    }

    if (deps.api.onAgentToolStarted) {
      unsubscribers.push(deps.api.onAgentToolStarted((event) => {
        if (matchesPendingMessage(event.messageId)) {
          applyEvent({ type: 'toolStarted', callId: event.callId, toolId: event.toolId, inputSummary: event.inputSummary })
          void reconcileFromRunSnapshot(event.runId)
        }
      }))
    }

    if (deps.api.onAgentToolCompleted) {
      unsubscribers.push(deps.api.onAgentToolCompleted((event) => {
        if (matchesPendingMessage(event.messageId)) {
          applyEvent({ type: 'toolCompleted', callId: event.callId, toolId: event.toolId, status: event.status, summary: event.summary })
          void reconcileFromRunSnapshot(event.runId)
        }
      }))
    }

    if (deps.api.onAgentPermissionRequired) {
      unsubscribers.push(deps.api.onAgentPermissionRequired((event) => {
        if (matchesPendingMessage(event.messageId)) {
          applyEvent({
            type: 'permissionRequired',
            callId: event.callId,
            toolId: event.toolId,
            reason: event.reason,
            ...(event.requiredPermissions ? { requiredPermissions: event.requiredPermissions } : {})
          })
          store.setState({ busy: true })
          void reconcileFromRunSnapshot(event.runId)
        }
      }))
    }

    if (deps.api.onAgentResponseReady) {
      unsubscribers.push(deps.api.onAgentResponseReady((event) => {
        if (!matchesPendingMessage(event.messageId)) {
          return
        }

        applyEvent({ type: 'responseReady', response: event.response })
        markRunTerminal(event.runId)
        store.setState({ busy: false, pending: null })
        void reconcileFromRunSnapshot(event.runId)
      }))
    }

    if (deps.api.onCanvasPlanReady) {
      unsubscribers.push(deps.api.onCanvasPlanReady((event) => {
        if (!matchesPendingMessage(event.messageId)) {
          return
        }

        const pending = store.getState().pending
        if (!pending) {
          return
        }
        const operationId = conversationOperationId
        const capturedPending = { ...pending }
        markRunTerminal(capturedPending.runId)
        const isCurrentPlanRequest = (): boolean => {
          const current = store.getState().pending
          return operationId === conversationOperationId
            && current?.runId === capturedPending.runId
            && current.messageId === capturedPending.messageId
            && current.jobId === capturedPending.jobId
        }
        void deps.api.getCanvasPlan({ messageId: event.messageId })
          .then((plan) => {
            if (!isCurrentPlanRequest()) {
              return
            }
            store.setState((state) => ({ plansById: { ...state.plansById, [event.planId]: plan } }))

            // Task 60：门禁 + 自动执行意愿判定统一走 applyAgentPlanOnReady。
            const applied = deps.applyPlan
              ? applyAgentPlanOnReady({
                  plan,
                  uiAutoExecute: store.getState().autoExecute,
                  agentAutoRun: capturedPending.agentAutoRun,
                  applyPlan: deps.applyPlan,
                })
              : false
            if (applied) {
              store.getState().markPlanApplied(event.planId)
            }

            applyEvent({ type: 'planReady', planId: event.planId })
          })
          .catch(() => {
            if (!isCurrentPlanRequest()) {
              return
            }
            applyEvent({ type: 'runFailed', errorClass: 'plan_fetch_failed', message: '计划获取失败，请重试。', retryable: true })
          })
          .finally(() => {
            if (!isCurrentPlanRequest()) {
              return
            }
            store.setState({ busy: false, pending: null })
            void reconcileFromRunSnapshot(capturedPending.runId)
          })
      }))
    }

    if (deps.api.onJobCompleted) {
      unsubscribers.push(deps.api.onJobCompleted((event) => {
        const pending = store.getState().pending
        if (!pending || event.jobId !== pending.jobId) {
          return
        }

        // agent.responseReady / canvas.planReady 丢失时，用 job 终态兜底恢复 busy。
        if (event.result.kind === 'agentRun' && event.result.response && event.result.response.type !== 'canvasPlan') {
          applyEvent({ type: 'responseReady', response: event.result.response })
          markRunTerminal(pending.runId)
          store.setState({ busy: false, pending: null })
          void reconcileFromRunSnapshot(pending.runId)
          return
        }

        markRunTerminal(pending.runId)
        void reconcileFromRunSnapshot(pending.runId)
      }))
    }

    if (deps.api.onJobFailed) {
      unsubscribers.push(deps.api.onJobFailed((event) => {
        const pending = store.getState().pending
        if (!pending || event.jobId !== pending.jobId) {
          return
        }

        // 批准等待型「失败」是暂停而非终态：保留/补齐权限块并继续等待用户。
        if (isApprovalRequiredJobFailure(event.error)) {
          const approval = approvalRequestFromJobFailure(pending.runId, event.error)
          if (approval) {
            applyEvent({
              type: 'permissionRequired',
              callId: approval.callId,
              toolId: approval.toolId,
              reason: approval.reason,
              ...(approval.requiredPermissions ? { requiredPermissions: approval.requiredPermissions } : {})
            })
          }
          store.setState({ busy: true })
          void reconcileFromRunSnapshot(pending.runId)
          return
        }

        applyEvent({ type: 'runFailed', errorClass: event.error.errorClass, message: event.error.message, retryable: event.error.retryable })
        markRunTerminal(pending.runId)
        store.setState({ busy: false, pending: null })
        void reconcileFromRunSnapshot(pending.runId)
      }))
    }
  }

  if (!deps.deferSubscriptions) {
    start()
  }

  return {
    store,
    start,
    dispose() {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
      unsubscribers.length = 0
      started = false
    },
  }
}
