/**
 * Bottom canvas input panel for manual prompt node creation.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Send, Sparkles } from 'lucide-react'
import { useCallback, useState, type KeyboardEvent } from 'react'

export interface BottomInputPanelProps {
  agentEnabled: boolean
  onCreateTextNode: (content: string) => void
}

/**
 * Renders a bottom prompt composer for the manual canvas phase.
 * @param props - Agent gate flag and text-node creation callback.
 * @returns Floating bottom input panel.
 * @throws Error never intentionally.
 * @see docs/api-contracts/canvas-plan.md
 */
export function BottomInputPanel({ agentEnabled, onCreateTextNode }: BottomInputPanelProps): JSX.Element {
  const [input, setInput] = useState('')

  const handleSend = useCallback(() => {
    const content = input.trim()
    if (!content) return
    onCreateTextNode(content)
    setInput('')
  }, [input, onCreateTextNode])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <section
      aria-label="底部输入面板"
      className="nopan nodrag nowheel pointer-events-auto absolute bottom-5 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-4"
    >
      <div className="rounded-2xl border border-border-primary bg-bg-panel p-3 shadow-pop">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={agentEnabled ? '描述你想生成的画布...' : '输入提示词，先手动创建文本节点'}
          className="min-h-[40px] max-h-[120px] w-full resize-none rounded-md bg-bg-input px-3 py-2 text-[14px] text-text-base outline-none placeholder:text-text-muted focus:ring-1 focus:ring-brand/40"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-text-muted">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>{agentEnabled ? 'Agent 编排已启用' : 'Agent 自动编排将在后续阶段启用'}</span>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-bg-base transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="创建文本节点"
            title="创建文本节点"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
