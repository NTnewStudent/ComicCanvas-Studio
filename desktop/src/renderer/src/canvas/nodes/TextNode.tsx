/**
 * Text canvas node for compact script and prompt editing.
 * @see docs/api-contracts/canvas-plan.md
 */

import { useEffect, useRef, useState } from 'react'

import type { TextNodeData } from '../../../../../../shared/nodes'

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
    <article ref={nodeRef} className={`text-node${selected ? ' is-selected' : ''}`} data-node-id={id}>
      <header className="text-node__header">
        {isRenaming ? (
          <input
            ref={renameRef}
            aria-label="Rename text node"
            className="text-node__rename"
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
            className="text-node__label"
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
          className="text-node__textarea"
          value={content}
          onChange={(event) => updateContent(event.target.value)}
          onBlur={() => setIsExpanded(false)}
        />
      ) : (
        <button type="button" className="text-node__preview" onClick={() => setIsExpanded(true)}>
          {content || 'Write a beat, prompt, or scene note'}
        </button>
      )}
    </article>
  )
}
