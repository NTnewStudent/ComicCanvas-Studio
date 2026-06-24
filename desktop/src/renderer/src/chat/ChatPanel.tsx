/**
 * Canvas agent chat panel and Plan preview card.
 * @see docs/api-contracts/canvas-plan.md
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Bot, Loader2, Send } from 'lucide-react'

import type { IpcEventMap, IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import type { CanvasPlan } from '../../../../../shared/plan'
import { cn } from '../lib/cn'
import { PlanCard, type ApplyPlanOptions } from './PlanCard'

export interface ChatPanelApi {
  sendCanvasChat: (input: IpcRequestMap['canvas.chatSend']) => Promise<IpcResponseMap['canvas.chatSend']>
  getCanvasPlan: (input: IpcRequestMap['canvas.chatGetPlan']) => Promise<IpcResponseMap['canvas.chatGetPlan']>
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

/**
 * Renders the canvas agent chat composer and async Plan preview flow.
 * @param props - Optional preload API override and Plan apply callback.
 * @returns Chat panel component.
 * @throws Error never intentionally; IPC failures are displayed as assistant messages.
 * @see docs/api-contracts/canvas-plan.md
 */
export function ChatPanel({ api = window.comicCanvas, onApplyPlan }: ChatPanelProps): JSX.Element {
  const [input, setInput] = useState('')
  const [autoExecute, setAutoExecute] = useState(false)
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<CanvasPlan | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const pendingMessageIdRef = useRef<string | null>(null)
  const canSend = input.trim().length > 0 && !busy

  useEffect(() => {
    pendingMessageIdRef.current = pendingMessageId
  }, [pendingMessageId])

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
              content: nextPlan.kind === 'clarify' ? 'Clarification needed.' : `Plan ready: ${event.planId}`
            }
          ])
        })
        .catch(() => {
          setMessages((items) => [...items, { id: `assistant-error-${event.planId}`, role: 'assistant', content: 'Plan fetch failed.' }])
        })
        .finally(() => {
          setBusy(false)
        })
    })
  }, [api])

  const statusText = useMemo(() => {
    if (busy && pendingMessageId) {
      return 'Waiting for plan...'
    }

    if (pendingMessageId && !plan) {
      return 'Plan queued'
    }

    if (plan) {
      return plan.kind === 'clarify' ? 'Clarification needed' : 'Plan ready'
    }

    return 'Ready'
  }, [busy, pendingMessageId, plan])

  function sendMessage(): void {
    const message = input.trim()

    if (!message || busy) {
      return
    }

    setBusy(true)
    setPlan(null)
    setMessages((items) => [...items, { id: `user-${Date.now()}`, role: 'user', content: message }])

    api.sendCanvasChat({ message, agentId: 'orchestrator' })
      .then((ticket) => {
        setPendingMessageId(ticket.messageId)
        setMessages((items) => [...items, { id: `assistant-${ticket.jobId}`, role: 'assistant', content: `Plan queued: ${ticket.jobId}` }])
        setInput('')
      })
      .catch(() => {
        setMessages((items) => [...items, { id: `assistant-error-${Date.now()}`, role: 'assistant', content: 'Plan request failed.' }])
      })
      .finally(() => {
        setBusy(false)
      })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <section className="rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card" aria-label="Canvas agent chat">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-secondary bg-bg-input text-brand">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="m-0 text-[18px] font-semibold leading-tight text-text-base">Canvas agent</h2>
            <p className="mt-1 text-[13px] text-text-secondary">{statusText}</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
          <input
            type="checkbox"
            role="switch"
            aria-label="Auto execute plan run steps"
            checked={autoExecute}
            onChange={(event) => setAutoExecute(event.currentTarget.checked)}
            className="h-4 w-4 accent-brand"
          />
          Auto execute
        </label>
      </div>

      <div className="mt-4 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border-secondary bg-bg-input p-3">
        {messages.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">Ask the built-in agent to draft text, image, and video nodes.</p>
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
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Canvas agent message"
          rows={3}
          placeholder="描述你要生成的漫剧画布节点"
          className="min-h-[88px] w-full resize-none bg-transparent text-[14px] leading-relaxed text-text-base outline-none placeholder:text-text-muted"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="m-0 text-[12px] text-text-muted">Enter to send. Shift+Enter for a new line.</p>
          <button
            type="button"
            aria-label="Send canvas message"
            disabled={!canSend}
            onClick={sendMessage}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-[13px] font-semibold text-[#06070a]',
              'transition-transform duration-200 ease-luxury hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            Send
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
