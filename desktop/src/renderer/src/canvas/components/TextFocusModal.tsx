/**
 * Focus editor modal used by TextNode for longer script and prompt editing.
 * @see docs/api-contracts/canvas-plan.md
 */

import { X } from 'lucide-react'
import { useEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'

/** Props for the TextNode focus editor modal. */
export interface TextFocusModalProps {
  /** Initial plain-text content. */
  content: string
  /** Called with plain-text and simple paragraph HTML when the user saves. */
  onSave: (content: string, html: string) => void
  /** Called when the user dismisses the modal. */
  onClose: () => void
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Converts plain text into paragraph HTML suitable for TextNode rich-text storage.
 * @param content - Plain text from the focus editor.
 * @returns Escaped paragraph HTML.
 * @throws Error never intentionally; empty text returns an empty paragraph.
 * @see docs/api-contracts/canvas-plan.md
 */
export function textToParagraphHtml(content: string): string {
  return `<p>${escapeHtml(content)}</p>`
}

/**
 * Renders a modal textarea for expanded TextNode editing.
 * @param props - Current content and save/close callbacks.
 * @returns Portal-backed focus editor.
 * @throws Error never intentionally; Escape closes without saving.
 * @see docs/api-contracts/canvas-plan.md
 */
export function TextFocusModal({ content, onSave, onClose }: TextFocusModalProps): JSX.Element {
  const [draft, setDraft] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="专注编辑文本节点"
        className="flex max-h-[82vh] w-full max-w-3xl flex-col gap-4 rounded-lg border border-border-secondary bg-bg-card p-5 text-text-base shadow-active"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold">专注编辑</h2>
          <button
            type="button"
            aria-label="关闭专注编辑"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border-input bg-bg-input text-text-secondary"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <textarea
          ref={textareaRef}
          aria-label="专注编辑文本内容"
          className="min-h-[360px] resize-none rounded-sm border border-border-input bg-bg-input p-3 text-[14px] leading-relaxed text-text-base outline-none focus:ring-1 focus:ring-brand"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <footer className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-sm border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-secondary"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-sm bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base"
            onClick={() => onSave(draft, textToParagraphHtml(draft))}
          >
            保存专注编辑
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
