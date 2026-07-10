/**
 * Canvas agent chat panel — thin shell over the shared chat store and block renderer.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/agents.md
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AtSign, Bot, Check, Loader2, Send, Square, Trash2 } from 'lucide-react'
import { useStore } from 'zustand'

import type { AgentDefinition } from '../../../../../shared/agents'
import type { IpcEventMap, IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import type { CanvasPlan } from '../../../../../shared/plan'
import { cn } from '../lib/cn'
import { AgentMentionPopover } from './AgentMentionPopover'
import { TurnView } from './blocks/TurnView'
import { PlanCard, type ApplyPlanOptions } from './PlanCard'
import { createChatStore, type ChatStoreApi } from './store/chat.store'
import { useMentionTrigger } from './useMentionTrigger'

export interface ChatPanelApi {
  /** @see docs/api-contracts/canvas-plan.md */
  sendCanvasChat: (input: IpcRequestMap['canvas.chatSend']) => Promise<IpcResponseMap['canvas.chatSend']>
  /** @see docs/api-contracts/canvas-plan.md */
  getCanvasPlan: (input: IpcRequestMap['canvas.chatGetPlan']) => Promise<IpcResponseMap['canvas.chatGetPlan']>
  /** @see docs/api-contracts/agents.md */
  listAgents: () => Promise<IpcResponseMap['agent.list']>
  /** @see docs/api-contracts/agents.md */
  getAgentRun?: (input: IpcRequestMap['agent.getRun']) => Promise<IpcResponseMap['agent.getRun']>
  /** @see docs/api-contracts/agents.md */
  approveAgentTool?: (input: IpcRequestMap['agent.approveTool']) => Promise<IpcResponseMap['agent.approveTool']>
  /** @see docs/api-contracts/agents.md */
  getChatHistory?: (input: IpcRequestMap['chat.history']) => Promise<IpcResponseMap['chat.history']>
  /** @see docs/api-contracts/canvas-plan.md */
  onCanvasPlanReady: (handler: (event: IpcEventMap['canvas.planReady']) => void) => () => void
  /** @see docs/api-contracts/agents.md */
  onAgentResponseReady: (handler: (event: IpcEventMap['agent.responseReady']) => void) => () => void
  /** @see docs/api-contracts/agents.md — streaming token deltas */
  onAgentDelta?: (handler: (event: IpcEventMap['agent.delta']) => void) => () => void
  /** @see docs/api-contracts/agents.md */
  onAgentToolStarted?: (handler: (event: IpcEventMap['agent.toolStarted']) => void) => () => void
  /** @see docs/api-contracts/agents.md */
  onAgentToolCompleted?: (handler: (event: IpcEventMap['agent.toolCompleted']) => void) => () => void
  /** @see docs/api-contracts/agents.md */
  onAgentPermissionRequired?: (handler: (event: IpcEventMap['agent.permissionRequired']) => void) => () => void
  /** @see docs/api-contracts/jobs.md */
  onJobProgress?: (handler: (event: IpcEventMap['job.progress']) => void) => () => void
  /** @see docs/api-contracts/jobs.md */
  onJobCompleted?: (handler: (event: IpcEventMap['job.completed']) => void) => () => void
  /** @see docs/api-contracts/jobs.md */
  onJobFailed?: (handler: (event: IpcEventMap['job.failed']) => void) => () => void
}

export interface ChatPanelProps {
  api?: ChatPanelApi
  onApplyPlan: (plan: CanvasPlan, options: ApplyPlanOptions) => void
  /** 会话恢复用的 workflow 作用域；缺省对齐 orchestrator 默认。 */
  workflowId?: string
}

const DEFAULT_AGENT_ID = 'general-purpose'

/**
 * Finds the first enabled orchestrator-compatible agent.
 * @param agents - Agent definitions returned by the registry.
 * @returns Default agent or null when the registry is unavailable.
 */
function findDefaultAgent(agents: AgentDefinition[]): AgentDefinition | null {
  return agents.find((agent) => agent.id === DEFAULT_AGENT_ID && agent.enabled) ?? agents.find((agent) => agent.enabled) ?? null
}

/**
 * Removes a leading selected-agent mention from the message body before sending.
 * @param message - Trimmed composer message.
 * @param agent - Selected agent used for routing.
 * @returns Message without the visible routing mention prefix.
 */
function stripSelectedAgentMention(message: string, agent: AgentDefinition | null): string {
  if (!agent) {
    return message
  }

  const escapedName = agent.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedId = agent.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return message.replace(new RegExp(`^@(?:${escapedName}|${escapedId})\\s+`, 'i'), '').trim()
}

/**
 * Adapts the preload-facing panel API to the chat store dependency surface.
 * @param api - Panel API (real preload bridge or test double).
 * @returns Chat store API subset.
 */
function toStoreApi(api: ChatPanelApi): ChatStoreApi {
  return {
    sendCanvasChat: (input) => api.sendCanvasChat(input),
    getCanvasPlan: (input) => api.getCanvasPlan(input),
    ...(api.approveAgentTool ? { approveAgentTool: api.approveAgentTool } : {}),
    ...(api.getAgentRun ? { getAgentRun: api.getAgentRun } : {}),
    ...(api.getChatHistory ? { getChatHistory: api.getChatHistory } : {}),
    ...(api.onCanvasPlanReady ? { onCanvasPlanReady: api.onCanvasPlanReady } : {}),
    ...(api.onAgentResponseReady ? { onAgentResponseReady: api.onAgentResponseReady } : {}),
    ...(api.onAgentDelta ? { onAgentDelta: api.onAgentDelta } : {}),
    ...(api.onAgentToolStarted ? { onAgentToolStarted: api.onAgentToolStarted } : {}),
    ...(api.onAgentToolCompleted ? { onAgentToolCompleted: api.onAgentToolCompleted } : {}),
    ...(api.onAgentPermissionRequired ? { onAgentPermissionRequired: api.onAgentPermissionRequired } : {}),
    ...(api.onJobProgress ? { onJobProgress: api.onJobProgress } : {}),
    ...(api.onJobCompleted ? { onJobCompleted: api.onJobCompleted } : {}),
    ...(api.onJobFailed ? { onJobFailed: api.onJobFailed } : {}),
  }
}

/**
 * Renders the canvas agent chat composer and block-based transcript.
 * @param props - Optional preload API override, Plan apply callback, and workflow scope.
 * @returns Chat panel component.
 * @throws Error never intentionally; IPC failures surface as in-transcript error blocks.
 * @see docs/api-contracts/canvas-plan.md
 */
export function ChatPanel({ api = window.comicCanvas, onApplyPlan, workflowId = 'default' }: ChatPanelProps): JSX.Element {
  const [input, setInput] = useState('')
  const [caretIndex, setCaretIndex] = useState(0)
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null)
  const [activeAgentIndex, setActiveAgentIndex] = useState(0)
  const [dismissedMentionValue, setDismissedMentionValue] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const handle = useMemo(
    () => createChatStore({
      api: toStoreApi(api),
      applyPlan: (plan, options) => onApplyPlan(plan, options),
    }),
    [api],
  )
  const turns = useStore(handle.store, (state) => state.turns)
  const busy = useStore(handle.store, (state) => state.busy)
  const permissionBusy = useStore(handle.store, (state) => state.permissionBusy)
  const autoExecute = useStore(handle.store, (state) => state.autoExecute)
  const plansById = useStore(handle.store, (state) => state.plansById)
  const appliedPlanIds = useStore(handle.store, (state) => state.appliedPlanIds)
  const pending = useStore(handle.store, (state) => state.pending)

  useEffect(() => () => handle.dispose(), [handle])

  useEffect(() => {
    if (api.getChatHistory) {
      void handle.store.getState().restore(workflowId)
    }
  }, [api, handle, workflowId])

  useEffect(() => {
    let isMounted = true

    api.listAgents()
      .then((items) => {
        if (!isMounted) {
          return
        }

        setAgents(items)
        setSelectedAgent(findDefaultAgent(items))
      })
      .catch(() => {
        if (isMounted) {
          // Keep chat usable with the built-in default when settings cannot be loaded.
          setSelectedAgent(null)
        }
      })

    return () => {
      isMounted = false
    }
  }, [api])

  const mentionTrigger = useMentionTrigger(input, caretIndex)
  const filteredAgents = useMemo(() => {
    const query = mentionTrigger?.query.toLowerCase() ?? ''
    return agents.filter((agent) => {
      if (!agent.enabled) {
        return false
      }

      if (!query) {
        return true
      }

      return agent.name.toLowerCase().includes(query) || agent.id.toLowerCase().includes(query) || agent.description.toLowerCase().includes(query)
    })
  }, [agents, mentionTrigger])
  const mentionOpen = mentionTrigger !== null && dismissedMentionValue !== input && filteredAgents.length > 0
  const activeAgent = filteredAgents[Math.min(activeAgentIndex, Math.max(filteredAgents.length - 1, 0))]
  const outgoingMessage = stripSelectedAgentMention(input.trim(), selectedAgent)
  const canSend = outgoingMessage.length > 0 && !busy

  useEffect(() => {
    setActiveAgentIndex(0)
  }, [mentionTrigger?.query])

  // Keep the newest turn visible as the transcript grows.
  useEffect(() => {
    const element = transcriptRef.current
    if (element) {
      element.scrollTop = element.scrollHeight
    }
  }, [turns, busy])

  const statusText = useMemo(() => {
    if (busy && pending) {
      return '等待 Agent 回复...'
    }

    if (pending) {
      return 'Agent 已排队'
    }

    return '就绪'
  }, [busy, pending])

  function selectAgent(agent: AgentDefinition): void {
    if (!mentionTrigger) {
      setSelectedAgent(agent)
      return
    }

    const nextInput = `${input.slice(0, mentionTrigger.start)}@${agent.name} ${input.slice(mentionTrigger.end)}`
    setSelectedAgent(agent)
    setInput(nextInput)
    setCaretIndex(nextInput.length)
    setDismissedMentionValue(nextInput)
  }

  function sendMessage(): void {
    const message = stripSelectedAgentMention(input.trim(), selectedAgent)

    if (!message || busy) {
      return
    }

    void handle.store.getState().send({
      message,
      agentId: selectedAgent?.id ?? DEFAULT_AGENT_ID,
      agentAutoRun: selectedAgent?.triggerPolicy.autoRun,
    })
    setInput('')
    setCaretIndex(0)
  }

  function stopRun(): void {
    handle.store.getState().stopWaiting()
  }

  function clearConversation(): void {
    handle.store.getState().clearView()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (mentionOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveAgentIndex((index) => Math.min(index + 1, filteredAgents.length - 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveAgentIndex((index) => Math.max(index - 1, 0))
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissedMentionValue(input)
        return
      }

      if (event.key === 'Enter' && activeAgent) {
        event.preventDefault()
        selectAgent(activeAgent)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  function renderPlan(planId: string): JSX.Element {
    const plan = plansById[planId]

    if (!plan) {
      return <p className="m-0 rounded-lg bg-bg-card px-3 py-2 text-[13px] text-text-secondary">计划已就绪：{planId}</p>
    }

    if (appliedPlanIds.includes(planId)) {
      return (
        <p className="m-0 inline-flex items-center gap-1.5 rounded-lg bg-bg-card px-3 py-2 text-[13px] text-text-secondary">
          <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          已应用到画布
        </p>
      )
    }

    return (
      <PlanCard
        plan={plan}
        autoExecute={autoExecute}
        onAutoExecuteChange={(value) => handle.store.getState().setAutoExecute(value)}
        onApplyPlan={(appliedPlan, options) => {
          onApplyPlan(appliedPlan, options)
          handle.store.getState().markPlanApplied(planId)
        }}
      />
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card" aria-label="画布 Agent 对话">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-secondary bg-bg-input text-brand">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="m-0 text-[18px] font-semibold leading-tight text-text-base">画布 Agent</h2>
            <p className="mt-1 text-[13px] text-text-secondary">{statusText}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="清空对话"
            onClick={clearConversation}
            disabled={turns.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-secondary px-2.5 py-1 text-[12px] text-text-secondary transition-colors hover:text-text-base disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            清空
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              role="switch"
              aria-label="自动执行计划运行步骤"
              checked={autoExecute}
              onChange={(event) => handle.store.getState().setAutoExecute(event.currentTarget.checked)}
              className="h-4 w-4 accent-brand"
            />
            自动执行
          </label>
        </div>
      </div>

      <div ref={transcriptRef} className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-border-secondary bg-bg-input p-3">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Bot className="h-8 w-8 text-text-muted/60" aria-hidden="true" />
            <p className="m-0 text-[13px] text-text-muted">让内置 Agent 起草文本、图片和视频节点，或直接提问、读取与检索项目文件。</p>
          </div>
        ) : (
          turns.map((turn) => (
            <TurnView
              key={turn.id}
              turn={turn}
              renderPlan={renderPlan}
              permissionBusy={permissionBusy}
              onApprovePermission={(callId) => { void handle.store.getState().approvePermission(callId) }}
              onDenyPermission={(callId) => handle.store.getState().denyPermission(callId)}
            />
          ))
        )}
      </div>

      <div className="mt-4 shrink-0 rounded-lg border border-border-input bg-bg-input p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-border-input bg-bg-card px-2.5 py-1 text-[12px] font-medium text-text-secondary">
            <AtSign className="h-3 w-3 text-brand" aria-hidden="true" />
            {selectedAgent ? selectedAgent.name : 'General Purpose'}
          </span>
        </div>
        <div className="relative">
          {mentionOpen && (
            <AgentMentionPopover
              agents={filteredAgents}
              activeIndex={activeAgentIndex}
              onActiveIndexChange={setActiveAgentIndex}
              onSelect={selectAgent}
            />
          )}
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setCaretIndex(event.target.selectionStart)
              setDismissedMentionValue(null)
            }}
            onSelect={(event) => setCaretIndex(event.currentTarget.selectionStart)}
            onKeyDown={handleKeyDown}
            aria-controls={mentionOpen ? 'agent-mention-selector' : undefined}
            aria-expanded={mentionOpen}
            aria-label="Canvas agent message"
            rows={3}
            placeholder="描述你要生成的漫剧画布节点"
            className="min-h-[88px] w-full resize-none bg-transparent text-[14px] leading-relaxed text-text-base outline-none placeholder:text-text-muted"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="m-0 text-[12px] text-text-muted">Enter 发送。Shift+Enter 换行。</p>
          <div className="flex items-center gap-2">
            {busy && (
              <button
                type="button"
                aria-label="停止 Agent"
                onClick={stopRun}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-secondary px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-base"
              >
                <Square className="h-4 w-4" aria-hidden="true" />
                停止
              </button>
            )}
            <button
              type="button"
              aria-label="发送画布消息"
              disabled={!canSend}
              onClick={sendMessage}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-[13px] font-semibold text-bg-base',
                'transition-transform duration-200 ease-luxury hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              发送
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
