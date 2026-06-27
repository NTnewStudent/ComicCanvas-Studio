/**
 * REQ-081 画布内 AI 对话（浮动 FAB + 展开面板）
 *
 * - FAB 按钮（48px 圆形，右下角）点击展开底部浮动面板
 * - 文本输入 + 发送，复用 canvas.chatSend IPC
 * - Plan 结果预览（复用 PlanCard 模式）
 * - 自动执行 toggle
 * - nopan nodrag nowheel 避免 ReactFlow 事件冲突
 *
 * @see docs/api-contracts/canvas-plan.md
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Bot, ChevronDown, Loader2, MessageSquare, Send } from 'lucide-react'

import type { IpcEventMap } from '../../../../../../shared/ipc'
import type { CanvasPlan } from '../../../../../../shared/plan'
import { PlanCard, type ApplyPlanOptions } from '../../chat/PlanCard'

/* ─── Types ─── */

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface CanvasChatBoxProps {
  open: boolean
  onToggle: () => void
  onApplyPlan: (plan: CanvasPlan, options: ApplyPlanOptions) => void
}

/* ─── Component ─── */

const CanvasChatBox = ({ open, onToggle, onApplyPlan }: CanvasChatBoxProps): JSX.Element => {
  const [input, setInput] = useState('')
  const [autoExecute, setAutoExecute] = useState(false)
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [plan, setPlan] = useState<CanvasPlan | null>(null)
  const pendingMessageIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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
        })
    })

    return unsub
  }, [])

  /* ── Auto-scroll messages ── */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  /* ── Send message ── */
  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || busy) return

    const api = window.comicCanvas
    if (!api?.sendCanvasChat) return

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content }])
    setInput('')
    setBusy(true)
    setPlan(null)

    try {
      const result = await api.sendCanvasChat({ message: content })
      pendingMessageIdRef.current = result.messageId
    } catch {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: '发送失败，请重试。' }])
      setBusy(false)
    }
  }, [input, busy])

  /* ── Keyboard: Enter sends, Shift+Enter newline ── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
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
      {/* ── FAB 按钮 ── */}
      <button
        type="button"
        onClick={onToggle}
        className={`pointer-events-auto fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border-primary bg-bg-panel shadow-card transition-all duration-300 ${
          open ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        title="打开对话"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        ) : (
          <MessageSquare className="h-5 w-5 text-text-secondary" />
        )}
        {/* 呼吸光晕 */}
        {!open && !busy && (
          <span className="pointer-events-none absolute inset-0 rounded-full animate-ping bg-brand/8" />
        )}
      </button>

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
            <div className="flex items-center gap-2 text-[13px] text-text-secondary">
              <Bot className="h-4 w-4 text-brand" />
              <span className="font-medium">AI 对话</span>
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
          {messages.length > 0 && (
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
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="描述你想要的画布内容…"
              className="min-h-[40px] max-h-[120px] w-full resize-none rounded-md bg-bg-input px-3 py-2 text-[14px] text-text-base outline-none placeholder:text-text-muted focus:ring-1 focus:ring-brand/40"
            />
            <div className="mt-2 flex items-center justify-between">
              {/* 自动执行开关 */}
              <button
                type="button"
                onClick={() => setAutoExecute((v) => !v)}
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
                disabled={busy || !input.trim()}
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
