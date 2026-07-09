/**
 * REQ-081 画布内 AI 对话（浮动 FAB + 展开面板）— 共享 chat store 薄壳。
 *
 * - FAB 按钮（48px 圆形）点击展开底部浮动面板，可拖动
 * - 消息块渲染、事件订阅与会话状态统一走 `chat/store/chat.store.ts`
 * - Plan 预览、权限批准、思考块均由 `TurnView` 按块渲染
 * - nopan nodrag nowheel 避免 ReactFlow 事件冲突
 *
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/agents.md
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { AtSign, Bot, Check, ChevronDown, Loader2, Send } from 'lucide-react'
import { useStore } from 'zustand'

import type { AgentDefinition } from '../../../../../../shared/agents'
import type { CanvasPlan } from '../../../../../../shared/plan'
import { TurnView } from '../../chat/blocks/TurnView'
import { AgentMentionPopover } from '../../chat/AgentMentionPopover'
import { PlanCard, type ApplyPlanOptions } from '../../chat/PlanCard'
import { createChatStore, type ChatStoreApi } from '../../chat/store/chat.store'
import { useMentionTrigger } from '../../chat/useMentionTrigger'

export interface CanvasChatBoxProps {
  open: boolean
  onToggle: () => void
  agentEnabled?: boolean
  onApplyPlan: (plan: CanvasPlan, options: ApplyPlanOptions) => void
  /** 会话恢复用的 workflow 作用域。 */
  workflowId?: string
}

const DEFAULT_AGENT_ID = 'general-purpose'
const FAB_SIZE = 48

function findDefaultAgent(agents: AgentDefinition[]): AgentDefinition | null {
  return agents.find((agent) => agent.id === DEFAULT_AGENT_ID && agent.enabled) ?? agents.find((agent) => agent.enabled) ?? null
}

function stripSelectedAgentMention(message: string, agent: AgentDefinition | null): string {
  if (!agent) return message
  const escapedName = agent.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedId = agent.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return message.replace(new RegExp(`^@(?:${escapedName}|${escapedId})\\s+`, 'i'), '').trim()
}

/**
 * 从 preload bridge 构造 chat store 的 API 依赖面。
 * @returns preload 可用时的 store API；bridge 缺失时返回 null。
 */
function storeApiFromPreload(): ChatStoreApi | null {
  const api = window.comicCanvas
  if (!api?.sendCanvasChat || !api.getCanvasPlan) {
    return null
  }

  return {
    sendCanvasChat: (input) => api.sendCanvasChat(input),
    getCanvasPlan: (input) => api.getCanvasPlan(input),
    ...(api.approveAgentTool ? { approveAgentTool: (input) => api.approveAgentTool(input) } : {}),
    ...(api.getAgentRun ? { getAgentRun: (input) => api.getAgentRun(input) } : {}),
    ...(api.getChatHistory ? { getChatHistory: (input) => api.getChatHistory(input) } : {}),
    ...(api.onCanvasPlanReady ? { onCanvasPlanReady: (handler) => api.onCanvasPlanReady(handler) } : {}),
    ...(api.onAgentResponseReady ? { onAgentResponseReady: (handler) => api.onAgentResponseReady(handler) } : {}),
    ...(api.onAgentDelta ? { onAgentDelta: (handler) => api.onAgentDelta(handler) } : {}),
    ...(api.onAgentToolStarted ? { onAgentToolStarted: (handler) => api.onAgentToolStarted(handler) } : {}),
    ...(api.onAgentToolCompleted ? { onAgentToolCompleted: (handler) => api.onAgentToolCompleted(handler) } : {}),
    ...(api.onAgentPermissionRequired ? { onAgentPermissionRequired: (handler) => api.onAgentPermissionRequired(handler) } : {}),
    ...(api.onJobProgress ? { onJobProgress: (handler) => api.onJobProgress(handler) } : {}),
    ...(api.onJobCompleted ? { onJobCompleted: (handler) => api.onJobCompleted(handler) } : {}),
    ...(api.onJobFailed ? { onJobFailed: (handler) => api.onJobFailed(handler) } : {}),
  }
}

/**
 * 画布浮动 Agent 对话框。
 * @param props - 面板开合、Plan 应用回调与 workflow 作用域。
 * @returns 浮动对话组件。
 */
const CanvasChatBox = ({ open, onToggle, agentEnabled = true, onApplyPlan, workflowId = 'default' }: CanvasChatBoxProps): JSX.Element => {
  const [input, setInput] = useState('')
  const [caretIndex, setCaretIndex] = useState(0)
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null)
  const [activeAgentIndex, setActiveAgentIndex] = useState(0)
  const [dismissedMentionValue, setDismissedMentionValue] = useState<string | null>(null)
  /** FAB 圆心 X（viewport px），初始居中；null 时先隐藏避免闪烁 */
  const [fabX, setFabX] = useState<number | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startFabX: 0, moved: false })
  const onApplyPlanRef = useRef(onApplyPlan)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onApplyPlanRef.current = onApplyPlan
  }, [onApplyPlan])

  const handle = useMemo(() => {
    const storeApi = storeApiFromPreload()
    if (!storeApi) {
      return null
    }

    return createChatStore({
      api: storeApi,
      applyPlan: (plan, options) => onApplyPlanRef.current(plan, options),
    })
  }, [])

  const store = useMemo(() => handle?.store ?? createFallbackStore(), [handle])
  const turns = useStore(store, (state) => state.turns)
  const busy = useStore(store, (state) => state.busy)
  const permissionBusy = useStore(store, (state) => state.permissionBusy)
  const autoExecute = useStore(store, (state) => state.autoExecute)
  const plansById = useStore(store, (state) => state.plansById)
  const appliedPlanIds = useStore(store, (state) => state.appliedPlanIds)

  useEffect(() => () => handle?.dispose(), [handle])

  useEffect(() => {
    if (handle) {
      void handle.store.getState().restore(workflowId)
    }
  }, [handle, workflowId])

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

  /* ── Auto-scroll transcript ── */
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
      return
    }
    element.scrollTop = element.scrollHeight
  }, [turns, busy])

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

  const handleSend = useCallback((): void => {
    const content = stripSelectedAgentMention(input.trim(), selectedAgent)
    if (!agentEnabled || !content || busy || !handle) return

    void handle.store.getState().send({
      message: content,
      agentId: selectedAgent?.id ?? DEFAULT_AGENT_ID,
      agentAutoRun: selectedAgent?.triggerPolicy.autoRun,
    })
    setInput('')
    setCaretIndex(0)
  }, [agentEnabled, busy, handle, input, selectedAgent])

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
        handleSend()
      }
    },
    [activeAgent, filteredAgents.length, handleSend, input, mentionOpen, selectAgent],
  )

  const renderPlan = useCallback((planId: string): JSX.Element => {
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
        onAutoExecuteChange={(value) => handle?.store.getState().setAutoExecute(value)}
        onApplyPlan={(appliedPlan, options) => {
          onApplyPlanRef.current(appliedPlan, options)
          handle?.store.getState().markPlanApplied(planId)
        }}
      />
    )
  }, [appliedPlanIds, autoExecute, handle, plansById])

  const showTranscript = turns.length > 0 || busy

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

          {/* 对话历史（块渲染） */}
          {showTranscript && (
            <div
              ref={scrollRef}
              className="mx-4 mt-2 flex max-h-[46vh] flex-col gap-3 overflow-y-auto rounded-lg bg-bg-input/50 p-3"
            >
              {turns.map((turn) => (
                <TurnView
                  key={turn.id}
                  turn={turn}
                  renderPlan={renderPlan}
                  permissionBusy={permissionBusy}
                  onApprovePermission={(callId) => { void handle?.store.getState().approvePermission(callId) }}
                  onDenyPermission={(callId) => handle?.store.getState().denyPermission(callId)}
                />
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-xl bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                    <span>AI 思考中…</span>
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
                onClick={() => handle?.store.getState().setAutoExecute(!autoExecute)}
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
                onClick={handleSend}
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

/** 无 preload bridge（如纯组件测试）时的惰性空 store 单例。 */
let fallbackStoreSingleton: ReturnType<typeof createChatStore>['store'] | null = null

function createFallbackStore(): ReturnType<typeof createChatStore>['store'] {
  if (!fallbackStoreSingleton) {
    fallbackStoreSingleton = createChatStore({
      api: {
        sendCanvasChat: () => Promise.reject(new Error('preload bridge unavailable')),
        getCanvasPlan: () => Promise.reject(new Error('preload bridge unavailable')),
      },
    }).store
  }
  return fallbackStoreSingleton
}

export default CanvasChatBox
