/**
 * Text canvas node for compact script and prompt editing.
 * @see docs/api-contracts/canvas-plan.md
 */

import { useEffect, useRef, useState } from 'react'

import type { TextNodeData } from '../../../../../../shared/nodes'
import { cn } from '../../lib/cn'

export interface TextNodeProps {
  id: string
  data: TextNodeData
  selected?: boolean
  onChange?: (id: string, patch: Partial<TextNodeData>) => void
  onRename?: (id: string, label: string) => void
}

/**
 * Renders a text node with collapsed preview, expanded textarea, and inline rename.
 * @param props - Text node ID, data, selection, and update callbacks.
 * @returns Text node React element.
 * @throws Error never intentionally; empty rename is ignored.
 * @see docs/api-contracts/canvas-plan.md
 */
export function TextNode({ id, data, selected = false, onChange, onRename }: TextNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [content, setContent] = useState(data.content)
  const [label, setLabel] = useState(data.label)
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftLabel, setDraftLabel] = useState(data.label)
  const nodeRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setContent(data.content)
  }, [data.content])

  useEffect(() => {
    setLabel(data.label)
    setDraftLabel(data.label)
  }, [data.label])

  useEffect(() => {
    if (isExpanded) {
      textareaRef.current?.focus()
    }
  }, [isExpanded])

  useEffect(() => {
    if (isRenaming) {
      renameRef.current?.focus()
      renameRef.current?.select()
    }
  }, [isRenaming])

  useEffect(() => {
    if (!isExpanded) return

    function collapseOnOutsidePointer(event: MouseEvent): void {
      const target = event.target
      if (!(target instanceof Node)) return
      if (nodeRef.current?.contains(target)) return

      setIsExpanded(false)
    }

    document.addEventListener('mousedown', collapseOnOutsidePointer)
    return () => document.removeEventListener('mousedown', collapseOnOutsidePointer)
  }, [isExpanded])

  function commitRename(): void {
    const next = draftLabel.trim()
    if (!next) {
      setDraftLabel(label)
      setIsRenaming(false)
      return
    }

    setLabel(next)
    setDraftLabel(next)
    setIsRenaming(false)
    onRename?.(id, next)
  }

  function cancelRename(): void {
    setDraftLabel(label)
    setIsRenaming(false)
  }

  function updateContent(next: string): void {
    setContent(next)
    onChange?.(id, { content: next })
  }

  return (
    <article
      ref={nodeRef}
      className={cn(
        'flex min-h-[168px] w-[320px] flex-col gap-2.5 rounded-xl border border-border-secondary bg-bg-card p-4 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
        selected && 'border-border-primary shadow-active'
      )}
      data-node-id={id}
    >
      <header className="flex min-h-7 items-center">
        {isRenaming ? (
          <input
            ref={renameRef}
            aria-label="Rename text node"
            className="w-full min-w-0 rounded-sm border border-border-input bg-bg-input px-2 py-1.5 text-[16px] font-semibold leading-[1.35] text-text-base outline-none focus-visible:shadow-[0_0_0_4px_var(--cc-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand"
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onBlur={cancelRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitRename()
              }
              if (event.key === 'Escape') {
                cancelRename()
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="cursor-text bg-transparent p-0 text-left text-[16px] font-semibold leading-[1.35] text-text-base outline-none focus-visible:shadow-[0_0_0_4px_var(--cc-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand"
            onClick={() => setIsExpanded(true)}
            onDoubleClick={() => setIsRenaming(true)}
          >
            {label}
          </button>
        )}
      </header>

      {isExpanded ? (
        <textarea
          ref={textareaRef}
          aria-label="Text content"
          className="min-h-28 flex-1 resize-none rounded-sm border border-border-input bg-bg-input p-2.5 text-[14px] leading-relaxed text-text-base outline-none focus-visible:shadow-[0_0_0_4px_var(--cc-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand"
          value={content}
          onChange={(event) => updateContent(event.target.value)}
          onBlur={() => setIsExpanded(false)}
        />
      ) : (
        <button
          type="button"
          className="min-h-[102px] flex-1 cursor-text overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border-input bg-bg-input p-2.5 text-left text-[14px] leading-relaxed text-text-base outline-none focus-visible:shadow-[0_0_0_4px_var(--cc-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand"
          onClick={() => setIsExpanded(true)}
        >
          {content || 'Write a beat, prompt, or scene note'}
        </button>
      )}
    </article>
  )
}
