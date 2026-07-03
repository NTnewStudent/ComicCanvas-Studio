/**
 * REQ-081 画布内 AI 对话（浮动 FAB + 展开面板）
 *
 * - FAB 按钮（48px 圆形，右下角）点击展开底部浮动面板
 * - 文本输入 + 发送，复用 canvas.chatSend IPC
 * - Agent @mention 路由
 * - Plan 结果预览（复用 PlanCard 模式）
 * - 自动执行 toggle
 * - nopan nodrag nowheel 避免 ReactFlow 事件冲突
 *
 * @see docs/api-contracts/canvas-plan.md
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { AtSign, Bot, ChevronDown, Loader2, Send } from 'lucide-react'

import type { AgentDefinition, AgentResponse } from '../../../../../../shared/agents'
import type { IpcEventMap } from '../../../../../../shared/ipc'
import type { CanvasPlan } from '../../../../../../shared/plan'
import { formatAgentTraceSummary } from '../../chat/agent-trace-summary'
import { AgentMentionPopover } from '../../chat/AgentMentionPopover'
import { PlanCard, type ApplyPlanOptions } from '../../chat/PlanCard'
import { useMentionTrigger } from '../../chat/useMentionTrigger'

/* ─── Types ─── */

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface CanvasChatBoxProps {
  open: boolean
  onToggle: () => void
  agentEnabled?: boolean
  onApplyPlan: (plan: CanvasPlan, options: ApplyPlanOptions) => void
}

const DEFAULT_AGENT_ID = 'general-purpose'
const FAB_SIZE = 48

function agentResponseMessage(response: AgentResponse): string | null {
  if (response.type === 'answer') return response.text
  if (response.type === 'clarification') return response.question
  return null
}

function findDefaultAgent(agents: AgentDefinition[]): AgentDefinition | null {
  return agents.find((agent) => agent.id === DEFAULT_AGENT_ID && agent.enabled) ?? agents.find((agent) => agent.enabled) ?? null
}

function stripSelectedAgentMention(message: string, agent: AgentDefinition | null): string {
  if (!agent) return message
  const escapedName = agent.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedId = agent.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return message.replace(new RegExp(`^@(?:${escapedName}|${escapedId})\\s+`, 'i'), '').trim()
}

/* ─── Component ─── */

const CanvasChatBox = ({ open, onToggle, agentEnabled = true, onApplyPlan }: CanvasChatBoxProps): JSX.Element => {
  const [input, setInput] = useState('')
  const [caretIndex, setCaretIndex] = useState(0)
  const [autoExecute, setAutoExecute] = useState(false)
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState<string[]>([])
  const [streamingText, setStreamingText] = useState<string>('')
  const [plan, setPlan] = useState<CanvasPlan | null>(null)
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null)
  const [activeAgentIndex, setActiveAgentIndex] = useState(0)
  const [dismissedMentionValue, setDismissedMentionValue] = useState<string | null>(null)
  /** FAB 圆心 X（viewport px），初始居中；null 时先隐藏避免闪烁 */
  const [fabX, setFabX] = useState<number | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startFabX: 0, moved: false })
  const pendingMessageIdRef = useRef<string | null>(null)
  const pendingJobIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mentionTrigger = useMentionTrigger(input, caretIndex)
  const filteredAgents = useMemo(() => {
    const query = mentionTrigger?.query.toLowerCase() ?? ''
    return agents.filter((agent) => {
      if (!agent.enabled) return false
      if (!query) return true
      return agent.name.toLowerCase().includes(query) || agent.id.toLowerCase().includes(query) || agent.description.toLowerCase().includes(query)
    })
  }, [agents, mentionTrigger])
  const mentionOpen = agentEnabled && mentionTrigger !== null && dismissedMentionValue !== input && filteredAgents.length > 0
  const activeAgent = filteredAgents[Math.min(activeAgentIndex, Math.max(filteredAgents.length - 1, 0))]
  const outgoingMessage = stripSelectedAgentMention(input.trim(), selectedAgent)
  const canSend = agentEnabled && outgoingMessage.length > 0 && !busy

  useEffect(() => {
    let mounted = true
    const api = window.comicCanvas
    if (!api?.listAgents) return

    api.listAgents()
      .then((items) => {
        if (!mounted) return
        setAgents(items)
        setSelectedAgent(findDefaultAgent(items))
      })
      .catch(() => {
        if (mounted) setSelectedAgent(null)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setActiveAgentIndex(0)
  }, [mentionTrigger?.query])

  // Center the FAB horizontally on mount.
  useEffect(() => {
    setFabX(window.innerWidth / 2)
  }, [])

  /* ── FAB drag: distinguish click (<5px) from drag, clamp to viewport ── */
  const handleFabPointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { active: true, startX: e.clientX, startFabX: fabX ?? window.innerWidth / 2, moved: false }
  }, [fabX])

  const handleFabPointerMove = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    if (Math.abs(dx) > 5) dragRef.current.moved = true
    const next = dragRef.current.startFabX + dx
    setFabX(Math.max(FAB_SIZE / 2 + 8, Math.min(window.innerWidth - FAB_SIZE / 2 - 8, next)))
  }, [])

  const handleFabPointerUp = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    const wasDrag = dragRef.current.moved
    dragRef.current.active = false
    dragRef.current.moved = false
    if (!wasDrag) onToggle()
  }, [onToggle])

  useEffect(() => {
    const api = window.comicCanvas
    if (!api?.onJobProgress) return

    return api.onJobProgress((event) => {
      if (!pendingJobIdRef.current || event.jobId !== pendingJobIdRef.current || !event.message) return

      const progressMessage = event.message
      setThinking((prev) => (prev.includes(progressMessage) ? prev : [...prev, progressMessage]))
    })
  }, [])

  /* ── Listen for plan ready events ── */
  useEffect(() => {
    const api = window.comicCanvas
    if (!api?.onCanvasPlanReady) return

    const unsub = api.onCanvasPlanReady((event: IpcEventMap['canvas.planReady']) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) return

      setBusy(true)
      api
        .getCanvasPlan({ messageId: event.messageId })
        .then((nextPlan: CanvasPlan) => {
          setPlan(nextPlan)
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${event.planId}`,
              role: 'assistant',
              content: nextPlan.kind === 'clarify' ? (nextPlan.question ?? '需要更多信息。') : `计划已就绪：${event.planId}`,
            },
          ])
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            { id: `assistant-error-${event.planId}`, role: 'assistant', content: '计划获取失败，请重试。' },
          ])
        })
        .finally(() => {
          setBusy(false)
          pendingMessageIdRef.current = null
          pendingJobIdRef.current = null
        })
    })

    return unsub
  }, [])

  useEffect(() => {
    const api = window.comicCanvas
    if (!api?.onAgentResponseReady) return

    const unsub = api.onAgentResponseReady((event: IpcEventMap['agent.responseReady']) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) return

      const assistantText = agentResponseMessage(event.response)
      if (!assistantText) return

      setStreamingText('')
      setMessages((prev) => [...prev, { id: `assistant-${event.runId}`, role: 'assistant', content: assistantText }])
      setBusy(false)
      pendingMessageIdRef.current = null
      pendingJobIdRef.current = null
    })

    return unsub
  }, [])

  // Accumulate streaming token deltas.
  useEffect(() => {
    const api = window.comicCanvas
    if (!api?.onAgentDelta) return

    return api.onAgentDelta((event) => {
      if (!pendingMessageIdRef.current || event.messageId !== pendingMessageIdRef.current) return
      setStreamingText((prev) => prev + event.delta)
    })
  }, [])

  /* ── Auto-scroll messages ── */
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
      return
    }
    element.scrollTop = element.scrollHeight
  }, [messages, thinking])

  // Show the transcript area when there's anything to show.
  const showTranscript = messages.length > 0 || thinking.length > 0 || streamingText.length > 0

  const selectAgent = useCallback((agent: AgentDefinition): void => {
    if (!mentionTrigger) {
      setSelectedAgent(agent)
      return
    }

    const nextInput = `${input.slice(0, mentionTrigger.start)}@${agent.name} ${input.slice(mentionTrigger.end)}`
    setSelectedAgent(agent)
    setInput(nextInput)
    setCaretIndex(nextInput.length)
    setDismissedMentionValue(nextInput)
  }, [input, mentionTrigger])

  /* ── Send message ── */
  const handleSend = useCallback(async () => {
    const content = stripSelectedAgentMention(input.trim(), selectedAgent)
    if (!agentEnabled || !content || busy) return

    const api = window.comicCanvas
    if (!api?.sendCanvasChat) return

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content }])
    setInput('')
    setCaretIndex(0)
    setBusy(true)
    setPlan(null)
    setThinking([])
    setStreamingText('')

    try {
      const result = await api.sendCanvasChat({ message: content, agentId: selectedAgent?.id ?? DEFAULT_AGENT_ID })
      pendingMessageIdRef.current = result.messageId
      pendingJobIdRef.current = result.jobId
      setThinking((prev) => [...prev, `Agent 已排队：${result.jobId}`])
      if (api.getAgentRun) {
        void api.getAgentRun({ runId: result.runId })
          .then((run) => {
            const lines = formatAgentTraceSummary(run.trace)
            if (lines.length === 0) return

            setThinking((prev) => {
              const existing = new Set(prev)
              const next = lines.filter((line) => !existing.has(line))
              return next.length > 0 ? [...prev, ...next] : prev
            })
          })
      }
    } catch {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: '发送失败，请重试。' }])
    } finally {
      setBusy(false)
    }
  }, [agentEnabled, input, selectedAgent, busy])

  /* ── Keyboard: Enter sends, Shift+Enter newline ── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setActiveAgentIndex((index) => Math.min(index + 1, filteredAgents.length - 1))
          return
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setActiveAgentIndex((index) => Math.max(index - 1, 0))
          return
        }

        if (e.key === 'Escape') {
          e.preventDefault()
          setDismissedMentionValue(input)
          return
        }

        if (e.key === 'Enter' && activeAgent) {
          e.preventDefault()
          selectAgent(activeAgent)
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [activeAgent, filteredAgents.length, handleSend, input, mentionOpen, selectAgent],
  )

  /* ── Apply plan callback ── */
  const handleApplyPlan = useCallback(
    (p: CanvasPlan, options: ApplyPlanOptions) => {
      onApplyPlan(p, options)
      setPlan(null)
    },
    [onApplyPlan],
  )

  return (
    <div className="nopan nodrag nowheel pointer-events-none fixed inset-0 z-30">
      {/* ── FAB 按钮：底部居中、可拖动（参考 hjwall） ── */}
      <div
        className="pointer-events-auto fixed bottom-6 z-40"
        style={{
          left: `${(fabX ?? window.innerWidth / 2) - FAB_SIZE / 2}px`,
          opacity: open ? 0 : 1,
          transform: open ? 'scale(0)' : 'scale(1)',
          transition: 'opacity 320ms cubic-bezier(0.34,1.56,0.64,1), transform 320ms cubic-bezier(0.34,1.56,0.64,1)',
          pointerEvents: open ? 'none' : 'auto',
          visibility: fabX === null ? 'hidden' : 'visible',
          touchAction: 'none',
        }}
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        title="打开对话（可拖动）"
      >
        <div className="relative flex h-12 w-12 cursor-grab select-none items-center justify-center rounded-full border border-border-primary bg-bg-panel shadow-card active:cursor-grabbing">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          ) : (
            <Bot className="h-5 w-5 text-brand" />
          )}
          {/* 呼吸光晕 */}
          {!open && !busy && (
            <span className="pointer-events-none absolute inset-0 rounded-full animate-ping bg-brand/8" />
          )}
        </div>
      </div>

      {/* ── 展开面板 ── */}
      <div
        className={`pointer-events-auto fixed bottom-6 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-4 transition-all duration-400 ${
          open
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {/* Plan 预览卡片 */}
        {plan && (
          <div className="mb-2">
            <PlanCard
              plan={plan}
              autoExecute={autoExecute}
              onAutoExecuteChange={setAutoExecute}
              onApplyPlan={handleApplyPlan}
            />
          </div>
        )}

        {/* 主面板 */}
        <div className="overflow-hidden rounded-2xl border border-border-primary bg-bg-panel shadow-pop">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-0 pt-3">
            <div className="flex min-w-0 items-center gap-2 text-[13px] text-text-secondary">
              <Bot className="h-4 w-4 shrink-0 text-brand" />
              <span className="font-medium">AI 对话</span>
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border-secondary bg-bg-card px-2 py-0.5 text-[11px] text-text-muted">
                <AtSign className="h-3 w-3 text-brand" />
                <span className="truncate">{selectedAgent ? selectedAgent.name : 'General Purpose'}</span>
              </span>
              {!agentEnabled && (
                <span className="rounded-full border border-border-secondary bg-bg-card px-2 py-0.5 text-[11px] text-text-muted">
                  Agent 自动编排未启用
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-hover"
              title="收起"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* 对话历史 */}
          {showTranscript && (
            <div
              ref={scrollRef}
              className="mx-4 mt-2 flex max-h-[200px] flex-col gap-2 overflow-y-auto rounded-lg bg-bg-input/50 p-3"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-1.5 text-[13px] ${
                      msg.role === 'user'
                        ? 'bg-brand text-bg-base'
                        : 'bg-bg-card text-text-base'
                    }`}
                  >
                    <span className="whitespace-pre-wrap break-all">{msg.content}</span>
                  </div>
                </div>
              ))}
              {thinking.length > 0 && (
                <details className="rounded-xl bg-bg-card/60 px-3 py-1.5 text-[12px] text-text-muted">
                  <summary className="cursor-pointer select-none text-text-secondary">思考过程（{thinking.length}）</summary>
                  <div className="mt-1.5 space-y-1">
                    {thinking.map((line, index) => (
                      <p key={`think-${index}`} className="m-0 whitespace-pre-wrap break-all font-mono leading-relaxed">
                        {line}
                      </p>
                    ))}
                  </div>
                </details>
              )}
              {/* Live streaming partial text */}
              {streamingText.length > 0 && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-xl bg-bg-card px-3 py-1.5 text-[13px] text-text-base whitespace-pre-wrap break-all">
                    {streamingText}
                    <span className="ml-1 inline-block h-3.5 w-0.5 animate-pulse bg-brand" aria-hidden="true" />
                  </div>
                </div>
              )}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-xl bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                    <span>AI 编排中…</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 输入区域 */}
          <div className="px-4 pb-3 pt-2">
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
                onChange={(e) => {
                  setInput(e.target.value)
                  setCaretIndex(e.target.selectionStart)
                  setDismissedMentionValue(null)
                }}
                onSelect={(e) => setCaretIndex(e.currentTarget.selectionStart)}
                onKeyDown={handleKeyDown}
                disabled={!agentEnabled || busy}
                aria-controls={mentionOpen ? 'agent-mention-selector' : undefined}
                aria-expanded={mentionOpen}
                aria-label="Canvas floating agent message"
                rows={1}
                placeholder={agentEnabled ? '描述你想要的画布内容，或输入 @ 选择 Agent…' : '当前阶段先使用手动画布'}
                className="min-h-[40px] max-h-[120px] w-full resize-none rounded-md bg-bg-input px-3 py-2 text-[14px] text-text-base outline-none placeholder:text-text-muted focus:ring-1 focus:ring-brand/40"
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              {/* 自动执行开关 */}
              <button
                type="button"
                onClick={() => setAutoExecute((v) => !v)}
                disabled={!agentEnabled}
                className="flex items-center gap-2"
                title="自动执行"
              >
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    autoExecute ? 'bg-brand' : 'bg-bg-action-btn'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      autoExecute ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </span>
                <span className="text-[12px] text-text-secondary">自动执行</span>
              </button>

              {/* 发送按钮 */}
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!canSend}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-bg-base transition hover:bg-brand-hover disabled:opacity-50"
                title="发送"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CanvasChatBox
