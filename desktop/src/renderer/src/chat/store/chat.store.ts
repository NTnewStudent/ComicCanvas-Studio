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

import type { AgentNonCanvasResponse, AgentResponse } from '../../../../../../shared/agents'
import {
  applyAgentEvent,
  createAssistantTurn,
  userTurnFromContent,
  type AgentChatEvent,
  type ChatTurn,
} from '../../../../../../shared/chat-blocks'
import type { CanvasPlan } from '../../../../../../shared/plan'
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
  approveAgentTool?(input: { runId: string; callId: string; approvedBy: string }): Promise<{ runId: string; jobId: string; status: 'pending' } | { errorClass: string; message: string; retryable: false }>
  getAgentRun?(input: { runId: string }): Promise<{ runId: string; status: string; trace?: Record<string, unknown> }>
  getChatHistory?(input: { workflowId: string }): Promise<ChatTurn[]>
  onCanvasPlanReady?(handler: (event: { messageId: string; planId: string }) => void): () => void
  onAgentResponseReady?(handler: (event: { runId: string; messageId: string; response: AgentNonCanvasResponse }) => void): () => void
  onAgentDelta?(handler: (event: { runId: string; messageId: string; delta: string }) => void): () => void
  onAgentToolStarted?(handler: (event: { runId: string; messageId: string; callId: string; toolId: string; inputSummary: string }) => void): () => void
  onAgentToolCompleted?(handler: (event: { runId: string; messageId: string; callId: string; toolId: string; invocationId: string; status: 'completed' | 'failed' | 'denied'; summary: string }) => void): () => void
  onAgentPermissionRequired?(handler: (event: { runId: string; messageId: string; callId: string; toolId: string; reason: string }) => void): () => void
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
  send(input: { message: string; agentId: string; agentAutoRun?: boolean | undefined }): Promise<void>
  approvePermission(callId: string): Promise<void>
  denyPermission(callId: string): void
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
}

export interface ChatStoreHandle {
  store: StoreApi<ChatStoreState>
  /** 取消全部 IPC 订阅。 */
  dispose(): void
}

/**
 * 创建会话 store 并订阅 Agent IPC 事件。
 * @param deps - preload API、可选 applyPlan 出口与时钟。
 * @returns store 实例与订阅清理函数。
 * @throws Error never intentionally; IPC 失败转为回合内错误块。
 */
export function createChatStore(deps: ChatStoreDeps): ChatStoreHandle {
  const clock = deps.clock ?? Date.now
  let reconcileFromRunSnapshot: (runId: string) => Promise<void> = async () => {
    // 在 createStore 初始化前占位；订阅注册时会被真实实现替换。
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

    async function reconcileFromRunSnapshotImpl(runId: string): Promise<void> {
      if (!deps.api.getAgentRun) {
        return
      }

      try {
        const run = await deps.api.getAgentRun({ runId })
        if (get().pending?.runId !== runId) {
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

      async send(input) {
        if (get().busy || input.message.trim().length === 0) {
          return
        }

        set((state) => ({
          busy: true,
          turns: [...state.turns, userTurnFromContent({ id: `user-${clock()}`, content: input.message, createdAt: clock() })],
        }))

        try {
          const ticket = await deps.api.sendCanvasChat({ message: input.message, agentId: input.agentId })
          set((state) => ({
            pending: { messageId: ticket.messageId, runId: ticket.runId, jobId: ticket.jobId, agentAutoRun: input.agentAutoRun === true },
            turns: [
              ...state.turns,
              createAssistantTurn({ id: `assistant-${ticket.messageId}`, runId: ticket.runId, messageId: ticket.messageId, createdAt: clock() }),
            ],
          }))
          applyToPending({ type: 'progress', message: `Agent 已排队：${ticket.jobId}` })

          // 补拉运行快照：排队早于事件订阅时 progress/response 可能已经落库。
          void reconcileFromRunSnapshotImpl(ticket.runId)
        } catch {
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

      async approvePermission(callId) {
        const pending = get().pending
        if (!pending || !deps.api.approveAgentTool) {
          return
        }

        set({ permissionBusy: true })
        try {
          const result = await deps.api.approveAgentTool({ runId: pending.runId, callId, approvedBy: 'chat-user' })
          if ('errorClass' in result) {
            throw new Error(result.message)
          }

          applyToPending({ type: 'permissionResolved', callId })
          set({ pending: { ...pending, jobId: result.jobId }, busy: true })

          // resume 事件可能在批准与订阅之间丢失，从运行快照兜底恢复终态。
          void reconcileFromRunSnapshotImpl(pending.runId)
        } catch {
          // 批准失败要在回合里可见，且不能让 run 卡在等待态。
          applyToPending({ type: 'runFailed', errorClass: 'agent_approval_failed', message: '工具批准失败，请重试。', retryable: true })
          finishPending()
        } finally {
          set({ permissionBusy: false })
        }
      },

      denyPermission(callId) {
        applyToPending({ type: 'permissionResolved', callId })
        applyToPending({ type: 'runFailed', errorClass: 'agent_tool_denied', message: '已拒绝工具调用，Agent 已停止。', retryable: false })
        finishPending()
      },

      setAutoExecute(value) {
        set({ autoExecute: value })
      },

      markPlanApplied(planId) {
        set((state) => (state.appliedPlanIds.includes(planId) ? state : { appliedPlanIds: [...state.appliedPlanIds, planId] }))
      },

      stopWaiting() {
        set({ busy: false, pending: null, permissionBusy: false })
      },

      async restore(workflowId) {
        if (!deps.api.getChatHistory) {
          return
        }

        try {
          const turns = await deps.api.getChatHistory({ workflowId })
          set({ turns })

          // 恢复的 plan 块补拉 plan 内容，使 PlanCard 在重启后仍可用。
          for (const turn of turns) {
            if (turn.role !== 'assistant' || !turn.messageId) {
              continue
            }

            for (const block of turn.blocks) {
              if (block.kind !== 'plan' || get().plansById[block.planId]) {
                continue
              }

              void deps.api.getCanvasPlan({ messageId: turn.messageId })
                .then((plan) => {
                  set((state) => ({ plansById: { ...state.plansById, [block.planId]: plan } }))
                })
                .catch(() => {
                  // 计划行可能已被清理；保留占位展示即可。
                })
            }
          }
        } catch {
          // 历史恢复失败保持空会话即可，不阻塞新对话。
        }
      },

      clearView() {
        set({ turns: [], busy: false, pending: null, permissionBusy: false })
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
      }
    }))
  }

  if (deps.api.onAgentToolCompleted) {
    unsubscribers.push(deps.api.onAgentToolCompleted((event) => {
      if (matchesPendingMessage(event.messageId)) {
        applyEvent({ type: 'toolCompleted', callId: event.callId, toolId: event.toolId, status: event.status, summary: event.summary })
      }
    }))
  }

  if (deps.api.onAgentPermissionRequired) {
    unsubscribers.push(deps.api.onAgentPermissionRequired((event) => {
      if (matchesPendingMessage(event.messageId)) {
        applyEvent({ type: 'permissionRequired', callId: event.callId, toolId: event.toolId, reason: event.reason })
        store.setState({ busy: true })
      }
    }))
  }

  if (deps.api.onAgentResponseReady) {
    unsubscribers.push(deps.api.onAgentResponseReady((event) => {
      if (!matchesPendingMessage(event.messageId)) {
        return
      }

      applyEvent({ type: 'responseReady', response: event.response })
      store.setState({ busy: false, pending: null })
    }))
  }

  if (deps.api.onCanvasPlanReady) {
    unsubscribers.push(deps.api.onCanvasPlanReady((event) => {
      if (!matchesPendingMessage(event.messageId)) {
        return
      }

      const pending = store.getState().pending
      void deps.api.getCanvasPlan({ messageId: event.messageId })
        .then((plan) => {
          store.setState((state) => ({ plansById: { ...state.plansById, [event.planId]: plan } }))

          // Task 60：门禁 + 自动执行意愿判定统一走 applyAgentPlanOnReady。
          const applied = deps.applyPlan
            ? applyAgentPlanOnReady({
                plan,
                uiAutoExecute: store.getState().autoExecute,
                agentAutoRun: pending?.agentAutoRun,
                applyPlan: deps.applyPlan,
              })
            : false
          if (applied) {
            store.getState().markPlanApplied(event.planId)
          }

          applyEvent({ type: 'planReady', planId: event.planId })
        })
        .catch(() => {
          applyEvent({ type: 'runFailed', errorClass: 'plan_fetch_failed', message: '计划获取失败，请重试。', retryable: true })
        })
        .finally(() => {
          store.setState({ busy: false, pending: null })
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
        store.setState({ busy: false, pending: null })
        return
      }

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
          applyEvent({ type: 'permissionRequired', callId: approval.callId, toolId: approval.toolId, reason: approval.reason })
        }
        store.setState({ busy: true })
        return
      }

      applyEvent({ type: 'runFailed', errorClass: event.error.errorClass, message: event.error.message, retryable: event.error.retryable })
      store.setState({ busy: false, pending: null })
    }))
  }

  return {
    store,
    dispose() {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
    },
  }
}
