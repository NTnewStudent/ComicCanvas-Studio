/**
 * Lightweight rich-text toolbar used by TextNode.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Bold, Expand, Highlighter, Italic, Sparkles, Strikethrough, Underline } from 'lucide-react'
import type { JSX } from 'react'

import type { NodeStatus } from '../../../../../../shared/nodes'
import { cn } from '../../lib/cn'

/** Supported toolbar formatting command. */
export type RichTextCommand = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'highlight'

/** Props for the TextNode rich-text toolbar. */
export interface RichTextToolbarProps {
  /** Current polish status, if the text node has an async polish task. */
  polishStatus?: NodeStatus
  /** Called when the user requests a rich-text formatting command. */
  onCommand: (command: RichTextCommand) => void
  /** Called when the user opens the focus editor. */
  onOpenFocus: () => void
  /** Called when the user requests AI polish. */
  onPolish?: () => void
}

const polishLabel: Partial<Record<NodeStatus, string>> = {
  pending: '等待润色',
  running: '润色中',
  done: '润色完成',
  error: '润色失败'
}

/**
 * Renders compact TextNode formatting, focus, and polish controls.
 * @param props - Toolbar callbacks and optional polish status.
 * @returns Toolbar element.
 * @throws Error never intentionally; buttons delegate all behavior to callbacks.
 * @see docs/api-contracts/canvas-plan.md
 */
export function RichTextToolbar({ polishStatus, onCommand, onOpenFocus, onPolish }: RichTextToolbarProps): JSX.Element {
  const isPolishing = polishStatus === 'pending' || polishStatus === 'running'

  return (
    <div
      role="toolbar"
      aria-label="文本富文本工具栏"
      className="nodrag flex flex-wrap items-center gap-1 rounded-lg border border-border-secondary bg-bg-card p-1.5 text-text-base shadow-card"
    >
      <button type="button" aria-label="加粗" className="cc-toolbar-button" onClick={() => onCommand('bold')}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="斜体" className="cc-toolbar-button" onClick={() => onCommand('italic')}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="下划线" className="cc-toolbar-button" onClick={() => onCommand('underline')}>
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="删除线" className="cc-toolbar-button" onClick={() => onCommand('strikeThrough')}>
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="高亮" className="cc-toolbar-button" onClick={() => onCommand('highlight')}>
        <Highlighter className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="打开专注编辑" className="cc-toolbar-button" onClick={onOpenFocus}>
        <Expand className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="AI 润色"
        className={cn('ml-1 inline-flex h-7 items-center gap-1 rounded-sm border border-border-input bg-bg-input px-2 text-[12px] text-text-secondary', isPolishing && 'cc-polish-shimmer text-brand')}
        disabled={isPolishing}
        onClick={onPolish}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {polishStatus === 'error' ? polishLabel.error : 'AI 润色'}
      </button>
    </div>
  )
}
