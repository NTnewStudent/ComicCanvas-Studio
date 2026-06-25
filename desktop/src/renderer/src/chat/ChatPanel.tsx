/**
 * Canvas agent chat panel and Plan preview card.
 * @see docs/api-contracts/canvas-plan.md
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AtSign, Bot, Loader2, Send } from 'lucide-react'

import type { AgentDefinition } from '../../../../../shared/agents'
import type { IpcEventMap, IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import type { CanvasPlan } from '../../../../../shared/plan'
import { cn } from '../lib/cn'
import { AgentMentionPopover } from './AgentMentionPopover'
import { PlanCard, type ApplyPlanOptions } from './PlanCard'
import { useMentionTrigger } from './useMentionTrigger'

export interface ChatPanelApi {
  /** @see docs/api-contracts/canvas-plan.md */
  sendCanvasChat: (input: IpcRequestMap['canvas.chatSend']) => Promise<IpcResponseMap['canvas.chatSend']>
  /** @see docs/api-contracts/canvas-plan.md */
  getCanvasPlan: (input: IpcRequestMap['canvas.chatGetPlan']) => Promise<IpcResponseMap['canvas.chatGetPlan']>
  /** @see docs/api-contracts/agents.md */
  listAgents: () => Promise<IpcResponseMap['agent.list']>
  /** @see docs/api-contracts/canvas-plan.md */
  onCanvasPlanReady: (handler: (event: IpcEventMap['canvas.planReady']) => void) => () => void
}

export interface ChatPanelProps {
  api?: ChatPanelApi
  onApplyPlan: (plan: CanvasPlan, options: ApplyPlanOptions) => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const DEFAULT_AGENT_ID = 'orchestrator'

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
 * Renders the canvas agent chat composer and async Plan preview flow.
 * @param props - Optional preload API override and Plan apply callback.
 * @returns Chat panel component.
 * @throws Error never intentionally; IPC failures are displayed as assistant messages.
 * @see docs/api-contracts/canvas-plan.md
 */
export function ChatPanel({ api = window.comicCanvas, onApplyPlan }: ChatPanelProps): JSX.Element {
  const [input, setInput] = useState('')
  const [caretIndex, setCaretIndex] = useState(0)
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null)
  const [activeAgentIndex, setActiveAgentIndex] = useState(0)
  const [dismissedMentionValue, setDismissedMentionValue] = useState<string | null>(null)
  const [autoExecute, setAutoExecute] = useState(false)
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<CanvasPlan | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const pendingMessageIdRef = useRef<string | null>(null)
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
    pendingMessageIdRef.current = pendingMessageId
  }, [pendingMessageId])

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

  useEffect(() => {
    setActiveAgentIndex(0)
  }, [mentionTrigger?.query])

  useEffect(() => {
    return api.onCanvasPlanReady((event) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) {
        return
      }

      setBusy(true)
      api.getCanvasPlan({ messageId: event.messageId })
        .then((nextPlan) => {
          setPlan(nextPlan)
          setMessages((items) => [
            ...items,
            {
              id: `assistant-${event.planId}`,
              role: 'assistant',
              content: nextPlan.kind === 'clarify' ? '需要澄清。' : `计划已就绪：${event.planId}`
            }
          ])
        })
        .catch(() => {
          // The queued chat can outlive its result fetch, so surface a recoverable assistant message.
          setMessages((items) => [...items, { id: `assistant-error-${event.planId}`, role: 'assistant', content: '计划获取失败。' }])
        })
        .finally(() => {
          setBusy(false)
        })
    })
  }, [api])

  const statusText = useMemo(() => {
    if (busy && pendingMessageId) {
      return '等待计划中...'
    }

    if (pendingMessageId && !plan) {
      return '计划已排队'
    }

    if (plan) {
      return plan.kind === 'clarify' ? '需要澄清' : '计划已就绪'
    }

    return '就绪'
  }, [busy, pendingMessageId, plan])

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

    setBusy(true)
    setPlan(null)
    setMessages((items) => [...items, { id: `user-${Date.now()}`, role: 'user', content: message }])

    api.sendCanvasChat({ message, agentId: selectedAgent?.id ?? DEFAULT_AGENT_ID })
      .then((ticket) => {
        setPendingMessageId(ticket.messageId)
        setMessages((items) => [...items, { id: `assistant-${ticket.jobId}`, role: 'assistant', content: `计划已排队：${ticket.jobId}` }])
        setInput('')
        setCaretIndex(0)
      })
      .catch(() => {
        // Chat send errors are user-recoverable, so keep the typed failure inside conversation history.
        setMessages((items) => [...items, { id: `assistant-error-${Date.now()}`, role: 'assistant', content: '计划请求失败。' }])
      })
      .finally(() => {
        setBusy(false)
      })
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

  return (
    <section className="rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card" aria-label="画布 Agent 对话">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-secondary bg-bg-input text-brand">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="m-0 text-[18px] font-semibold leading-tight text-text-base">画布 Agent</h2>
            <p className="mt-1 text-[13px] text-text-secondary">{statusText}</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
          <input
            type="checkbox"
            role="switch"
            aria-label="自动执行计划运行步骤"
            checked={autoExecute}
            onChange={(event) => setAutoExecute(event.currentTarget.checked)}
            className="h-4 w-4 accent-brand"
          />
          自动执行
        </label>
      </div>

      <div className="mt-4 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border-secondary bg-bg-input p-3">
        {messages.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">让内置 Agent 起草文本、图片和视频节点。</p>
        ) : (
          messages.map((message) => (
            <p
              key={message.id}
              className={cn(
                'm-0 rounded-lg px-3 py-2 text-[13px] leading-relaxed',
                message.role === 'user' ? 'bg-brand/15 text-text-base' : 'bg-bg-card text-text-secondary'
              )}
            >
              {message.content}
            </p>
          ))
        )}
      </div>

      <div className="mt-4 rounded-lg border border-border-input bg-bg-input p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-border-input bg-bg-card px-2.5 py-1 text-[12px] font-medium text-text-secondary">
            <AtSign className="h-3 w-3 text-brand" aria-hidden="true" />
            {selectedAgent ? selectedAgent.name : 'Orchestrator'}
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

      {plan && (
        <div className="mt-4">
          <PlanCard plan={plan} autoExecute={autoExecute} onAutoExecuteChange={setAutoExecute} onApplyPlan={onApplyPlan} />
        </div>
      )}
    </section>
  )
}
