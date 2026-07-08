/**
 * Canvas agent chat panel and Plan preview card.
 * @see docs/api-contracts/canvas-plan.md
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AtSign, Bot, Loader2, Send, Square, Trash2 } from 'lucide-react'

import type { AgentDefinition, AgentResponse } from '../../../../../shared/agents'
import type { IpcEventMap, IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import type { CanvasPlan } from '../../../../../shared/plan'
import { cn } from '../lib/cn'
import { formatAgentTraceSummary } from './agent-trace-summary'
import { applyAgentPlanOnReady } from './agent/apply-agent-plan-on-ready'
import { AgentPermissionModal, type AgentPermissionRequest } from './agent/AgentPermissionModal'
import { AgentRunStatusBar } from './agent/AgentRunStatusBar'
import { AgentSubAgentPanel, extractSubAgentItems } from './agent/AgentSubAgentPanel'
import { AgentToolTrace, type AgentToolTraceItem } from './agent/AgentToolPill'
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
  /** @see docs/api-contracts/agents.md */
  getAgentRun: (input: IpcRequestMap['agent.getRun']) => Promise<IpcResponseMap['agent.getRun']>
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
  /** @see docs/api-contracts/agents.md */
  approveAgentTool?: (input: IpcRequestMap['agent.approveTool']) => Promise<IpcResponseMap['agent.approveTool']>
  /** @see docs/api-contracts/jobs.md */
  onJobProgress?: (handler: (event: IpcEventMap['job.progress']) => void) => () => void
  /** @see docs/api-contracts/jobs.md */
  onJobFailed?: (handler: (event: IpcEventMap['job.failed']) => void) => () => void
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

const DEFAULT_AGENT_ID = 'general-purpose'

/**
 * Converts a terminal non-plan Agent response into transcript text.
 * @param response - Agent response emitted by the v2 harness.
 * @returns Assistant message text, or null for CanvasPlan responses.
 */
function agentResponseMessage(response: AgentResponse): string | null {
  if (response.type === 'answer') {
    return response.text
  }

  if (response.type === 'clarification') {
    return response.question
  }

  return null
}

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
  const [thinking, setThinking] = useState<string[]>([])
  const [toolTrace, setToolTrace] = useState<AgentToolTraceItem[]>([])
  const [permissionRequest, setPermissionRequest] = useState<AgentPermissionRequest | null>(null)
  const [permissionBusy, setPermissionBusy] = useState(false)
  /** Partial model output accumulating while the model streams. Cleared on final responseReady. */
  const [streamingText, setStreamingText] = useState<string>('')
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [runTrace, setRunTrace] = useState<Record<string, unknown> | null>(null)
  const pendingMessageIdRef = useRef<string | null>(null)
  const pendingJobIdRef = useRef<string | null>(null)
  const pendingRunIdRef = useRef<string | null>(null)
  const autoExecuteRef = useRef(autoExecute)
  const selectedAgentRef = useRef(selectedAgent)
  const onApplyPlanRef = useRef(onApplyPlan)
  const transcriptRef = useRef<HTMLDivElement>(null)
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
  const subAgentItems = useMemo(() => extractSubAgentItems(toolTrace), [toolTrace])

  const refreshRunTrace = useCallback((runId: string) => {
    if (!api.getAgentRun) {
      return
    }

    void api.getAgentRun({ runId })
      .then((run) => {
        setRunTrace(run.trace ?? null)
      })
      .catch(() => {
        setRunTrace(null)
      })
  }, [api])

  useEffect(() => {
    pendingMessageIdRef.current = pendingMessageId
  }, [pendingMessageId])

  useEffect(() => {
    autoExecuteRef.current = autoExecute
  }, [autoExecute])

  useEffect(() => {
    selectedAgentRef.current = selectedAgent
  }, [selectedAgent])

  useEffect(() => {
    onApplyPlanRef.current = onApplyPlan
  }, [onApplyPlan])

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
          const applied = applyAgentPlanOnReady({
            plan: nextPlan,
            uiAutoExecute: autoExecuteRef.current,
            agentAutoRun: selectedAgentRef.current?.triggerPolicy.autoRun,
            applyPlan: (plan, options) => {
              onApplyPlanRef.current(plan, options)
              setPlan(null)
            },
          })

          if (!applied) {
            setPlan(nextPlan)
          }

          setMessages((items) => [
            ...items,
            {
              id: `assistant-${event.planId}`,
              role: 'assistant',
              content: nextPlan.kind === 'clarify'
                ? (nextPlan.question ?? '需要更多信息。')
                : applied
                  ? `计划已自动应用：${event.planId}`
                  : `计划已就绪：${event.planId}`
            }
          ])

          if (applied) {
            setThinking((items) => (
              items.includes('计划已自动应用到画布并执行运行步骤。')
                ? items
                : [...items, '计划已自动应用到画布并执行运行步骤。']
            ))
          }
        })
        .catch(() => {
          // The queued chat can outlive its result fetch, so surface a recoverable assistant message.
          setMessages((items) => [...items, { id: `assistant-error-${event.planId}`, role: 'assistant', content: '计划获取失败。' }])
        })
        .finally(() => {
          const completedRunId = pendingRunIdRef.current
          setBusy(false)
          setPendingMessageId(null)
          pendingJobIdRef.current = null
          pendingRunIdRef.current = null
          setPermissionRequest(null)
          if (completedRunId) {
            refreshRunTrace(completedRunId)
          }
        })
    })
  }, [api])

  useEffect(() => {
    if (!api.onAgentToolStarted) return undefined

    return api.onAgentToolStarted((event) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) {
        return
      }

      pendingRunIdRef.current = event.runId
      setToolTrace((items) => [
        ...items.filter((item) => item.callId !== event.callId),
        {
          callId: event.callId,
          toolId: event.toolId,
          status: 'running',
          inputSummary: event.inputSummary
        }
      ])
    })
  }, [api])

  useEffect(() => {
    if (!api.onAgentToolCompleted) return undefined

    return api.onAgentToolCompleted((event) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) {
        return
      }

      setToolTrace((items) => [
        ...items.filter((item) => item.callId !== event.callId),
        {
          callId: event.callId,
          toolId: event.toolId,
          status: event.status === 'completed' ? 'completed' : event.status === 'denied' ? 'denied' : 'failed',
          summary: event.summary
        }
      ])
    })
  }, [api])

  useEffect(() => {
    if (!api.onAgentPermissionRequired) return undefined

    return api.onAgentPermissionRequired((event) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) {
        return
      }

      pendingRunIdRef.current = event.runId
      setPermissionRequest({
        runId: event.runId,
        callId: event.callId,
        toolId: event.toolId,
        reason: event.reason
      })
      setBusy(true)
    })
  }, [api])

  useEffect(() => {
    return api.onAgentResponseReady((event) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) {
        return
      }

      const assistantText = agentResponseMessage(event.response)
      if (!assistantText) {
        return
      }

      setStreamingText('')
      setMessages((items) => [
        ...items,
        {
          id: `assistant-${event.runId}`,
          role: 'assistant',
          content: assistantText
        }
      ])
      setBusy(false)
      setPendingMessageId(null)
      pendingJobIdRef.current = null
      pendingRunIdRef.current = null
      setPermissionRequest(null)
      refreshRunTrace(event.runId)
    })
  }, [api, refreshRunTrace])

  // Accumulate streaming token deltas into a live partial-text display.
  useEffect(() => {
    if (!api.onAgentDelta) return undefined

    return api.onAgentDelta((event) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) {
        return
      }
      setStreamingText((prev) => prev + event.delta)
    })
  }, [api])

  useEffect(() => {
    if (!api.onJobProgress) return undefined

    return api.onJobProgress((event) => {
      if (!pendingJobIdRef.current || event.jobId !== pendingJobIdRef.current || !event.message) {
        return
      }

      const progressMessage = event.message
      setThinking((items) => (items.includes(progressMessage) ? items : [...items, progressMessage]))
    })
  }, [api])

  useEffect(() => {
    if (!api.onJobFailed) return undefined

    return api.onJobFailed((event) => {
      if (!pendingJobIdRef.current || event.jobId !== pendingJobIdRef.current) {
        return
      }

      const failedRunId = pendingRunIdRef.current
      setStreamingText('')
      setMessages((items) => [
        ...items,
        { id: `assistant-job-failed-${event.jobId}`, role: 'assistant', content: `Agent 执行失败：${event.error.message}` }
      ])
      setBusy(false)
      setPendingMessageId(null)
      pendingMessageIdRef.current = null
      pendingJobIdRef.current = null
      pendingRunIdRef.current = null
      setPermissionRequest(null)
      if (failedRunId) {
        refreshRunTrace(failedRunId)
      }
    })
  }, [api, refreshRunTrace])

  // Keep the newest turn visible as the transcript grows.
  useEffect(() => {
    const element = transcriptRef.current
    if (element) {
      element.scrollTop = element.scrollHeight
    }
  }, [messages, thinking, busy, toolTrace.length, streamingText])

  const handleApprovePermission = useCallback(async () => {
    if (!api.approveAgentTool || !permissionRequest) {
      return
    }

    setPermissionBusy(true)
    try {
      const result = await api.approveAgentTool({
        runId: permissionRequest.runId,
        callId: permissionRequest.callId,
        approvedBy: 'chat-panel-user'
      })
      if ('errorClass' in result) {
        throw new Error(result.message)
      }
      pendingRunIdRef.current = result.runId
      pendingJobIdRef.current = result.jobId
      setPermissionRequest(null)
    } catch {
      setMessages((items) => [...items, { id: `permission-error-${Date.now()}`, role: 'assistant', content: '工具批准失败，请重试。' }])
      setPermissionRequest(null)
      setBusy(false)
    } finally {
      setPermissionBusy(false)
    }
  }, [api, permissionRequest])

  const handleDismissPermission = useCallback(() => {
    setPermissionRequest(null)
    setBusy(false)
    setPendingMessageId(null)
    pendingMessageIdRef.current = null
    pendingJobIdRef.current = null
    pendingRunIdRef.current = null
    setMessages((items) => [...items, { id: `permission-denied-${Date.now()}`, role: 'assistant', content: '已拒绝工具调用，Agent 已停止。' }])
  }, [])

  const statusText = useMemo(() => {
    if (busy && pendingMessageId) {
      return '等待 Agent 回复...'
    }

    if (pendingMessageId && !plan) {
      return 'Agent 已排队'
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
    setThinking([])
    setToolTrace([])
    setPermissionRequest(null)
    setStreamingText('')
    setRunStartedAt(Date.now())
    setRunTrace(null)
    setMessages((items) => [...items, { id: `user-${Date.now()}`, role: 'user', content: message }])

    api.sendCanvasChat({ message, agentId: selectedAgent?.id ?? DEFAULT_AGENT_ID })
      .then((ticket) => {
        setPendingMessageId(ticket.messageId)
        pendingJobIdRef.current = ticket.jobId
        pendingRunIdRef.current = ticket.runId
        setThinking((items) => [...items, `Agent 已排队：${ticket.jobId}`])
        void api.getAgentRun({ runId: ticket.runId })
          .then((run) => {
            const lines = formatAgentTraceSummary(run.trace)
            if (lines.length === 0) return

            setThinking((items) => {
              const existing = new Set(items)
              const next = lines.filter((line) => !existing.has(line))
              return next.length > 0 ? [...items, ...next] : items
            })
          })
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

  function stopRun(): void {
    setThinking((items) => [...items, '已停止等待当前回复。'])
    setBusy(false)
    setPendingMessageId(null)
    pendingMessageIdRef.current = null
    pendingJobIdRef.current = null
    pendingRunIdRef.current = null
    setPermissionRequest(null)
  }

  function clearConversation(): void {
    setMessages([])
    setThinking([])
    setToolTrace([])
    setPlan(null)
    stopRun()
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="清空对话"
            onClick={clearConversation}
            disabled={messages.length === 0 && thinking.length === 0 && !plan}
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
              onChange={(event) => setAutoExecute(event.currentTarget.checked)}
              className="h-4 w-4 accent-brand"
            />
            自动执行
          </label>
        </div>
      </div>

      <AgentSubAgentPanel items={subAgentItems} />
      <AgentToolTrace items={toolTrace} />

      <div ref={transcriptRef} className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border-secondary bg-bg-input p-3">
        {messages.length === 0 && thinking.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">让内置 Agent 起草文本、图片和视频节点，或直接提问、读取与检索项目文件。</p>
        ) : (
          messages.map((message) => (
            <p
              key={message.id}
              className={cn(
                'm-0 rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap',
                message.role === 'user' ? 'bg-brand/15 text-text-base' : 'bg-bg-card text-text-secondary'
              )}
            >
              {message.content}
            </p>
          ))
        )}

        {thinking.length > 0 && (
          <details className="rounded-lg border border-border-secondary bg-bg-card/60 px-3 py-2 text-[12px] text-text-muted">
            <summary className="cursor-pointer select-none text-text-secondary">思考过程（{thinking.length}）</summary>
            <div className="mt-2 space-y-1">
              {thinking.map((line, index) => (
                <p key={`think-${index}`} className="m-0 font-mono leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          </details>
        )}

        {/* Live streaming partial text — hidden once responseReady fires */}
        {streamingText.length > 0 && (
          <div className="flex justify-start">
            <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words bg-bg-card text-text-base')}>
              {streamingText}
              <span className="ml-1 inline-block h-3.5 w-0.5 animate-pulse bg-brand" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-border-input bg-bg-input p-3">
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
        <AgentRunStatusBar busy={busy} runStartedAt={runStartedAt} trace={runTrace} />
      </div>

      {plan && (
        <div className="mt-4">
          <PlanCard plan={plan} autoExecute={autoExecute} onAutoExecuteChange={setAutoExecute} onApplyPlan={onApplyPlan} />
        </div>
      )}

      <AgentPermissionModal
        request={permissionRequest}
        busy={permissionBusy}
        onApprove={() => { void handleApprovePermission() }}
        onDismiss={handleDismissPermission}
      />
    </section>
  )
}
