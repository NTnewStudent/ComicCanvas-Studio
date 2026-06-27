/**
 * Text canvas node for compact script and prompt editing.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import React, { useEffect, useRef, useState } from 'react'

import type { TextNodeData } from '../../../../../../shared/nodes'
import { RichTextToolbar, type RichTextCommand } from '../components/RichTextToolbar'
import { TextFocusModal, textToParagraphHtml } from '../components/TextFocusModal'
import { useInlineRename } from '../hooks/use-inline-rename'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES, NODE_UI_CLASS_NAMES } from '../lib/node-sizing'
import { cn } from '../../lib/cn'

export interface TextNodeProps {
  id: string
  data: TextNodeData
  selected?: boolean
  onChange?: (id: string, patch: Partial<TextNodeData>) => void
  onRename?: (id: string, label: string) => void
  onPolish?: (id: string) => void
}

function mentionChips(value: string): { id: string; name: string }[] {
  const chips: { id: string; name: string }[] = []
  const seen = new Set<string>()
  const matcher = /\[([^\]|]+)\|([^\]]+)\]/g
  let match: RegExpExecArray | null

  while ((match = matcher.exec(value)) !== null) {
    const id = match[1]
    const name = match[2]
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    chips.push({ id, name })
  }

  return chips
}

function htmlForCommand(command: RichTextCommand, content: string): string {
  const html = textToParagraphHtml(content)
  if (command === 'bold') return `<strong>${html}</strong>`
  if (command === 'italic') return `<em>${html}</em>`
  if (command === 'underline') return `<u>${html}</u>`
  if (command === 'strikeThrough') return `<s>${html}</s>`
  return `<mark>${html}</mark>`
}

/**
 * Renders a text node with collapsed preview, expanded textarea, and inline rename.
 * @param props - Text node ID, data, selection, and update callbacks.
 * @returns Text node React element.
 * @throws Error never intentionally; empty rename is ignored.
 * @see docs/api-contracts/canvas-plan.md
 */
function TextNodeComponent({ id, data, selected = false, onChange, onRename, onPolish }: TextNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFocusOpen, setIsFocusOpen] = useState(false)
  const [content, setContent] = useState(data.content)
  const rename = useInlineRename({
    value: data.label,
    onCommit: (next) => onRename?.(id, next)
  })
  const nodeRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setContent(data.content)
  }, [data.content])

  useEffect(() => {
    if (isExpanded) {
      textareaRef.current?.focus()
    }
  }, [isExpanded])

  useEffect(() => {
    if (rename.isRenaming) {
      renameRef.current?.focus()
      renameRef.current?.select()
    }
  }, [rename.isRenaming])

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

  function updateContent(next: string): void {
    setContent(next)
    onChange?.(id, { content: next })
  }

  function updateContentAndHtml(next: string, html: string): void {
    setContent(next)
    onChange?.(id, { content: next, html })
  }

  function applyRichTextCommand(command: RichTextCommand): void {
    onChange?.(id, { html: htmlForCommand(command, content) })
  }

  function requestPolish(): void {
    onChange?.(id, { polishStatus: 'pending' })
    onPolish?.(id)
  }

  const chips = mentionChips(content)
  const isPolishing = data.polishStatus === 'pending' || data.polishStatus === 'running'

  return (
    <article
      ref={nodeRef}
      className={cn(
        'h-full w-full',
        NODE_UI_CLASS_NAMES.textShell,
        selected && 'border-border-primary shadow-active'
      )}
      data-node-id={id}
    >
      {selected || isExpanded ? (
        <div className="absolute left-3 right-3 top-[-48px] z-20 flex justify-center">
          <RichTextToolbar
            {...(data.polishStatus ? { polishStatus: data.polishStatus } : {})}
            onCommand={applyRichTextCommand}
            onOpenFocus={() => setIsFocusOpen(true)}
            onPolish={requestPolish}
          />
        </div>
      ) : null}

      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.text}
        minHeight={NODE_MIN_HEIGHT.text}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className={NODE_UI_CLASS_NAMES.header}>
        {rename.isRenaming ? (
          <input
            ref={renameRef}
            aria-label="重命名文本节点"
            className={cn('w-full min-w-0', NODE_UI_CLASS_NAMES.field, NODE_UI_CLASS_NAMES.title)}
            value={rename.draft}
            onChange={(event) => rename.setDraft(event.target.value)}
            onBlur={rename.cancel}
            onKeyDown={rename.handleKeyDown}
          />
        ) : (
          <button
            type="button"
            className={cn('cursor-text bg-transparent p-0 text-left outline-none focus-visible:shadow-[0_0_0_4px_var(--cc-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand', NODE_UI_CLASS_NAMES.title)}
            onClick={() => setIsExpanded(true)}
            onDoubleClick={rename.start}
          >
            {rename.value}
          </button>
        )}
        {data.polishStatus ? (
          <span
            className={cn(
              'ml-auto rounded-sm border border-border-secondary bg-bg-input px-2 py-1 text-[11px] font-medium text-text-muted',
              isPolishing && 'cc-polish-shimmer text-brand'
            )}
          >
            {isPolishing ? '润色中' : data.polishStatus === 'done' ? '润色完成' : data.polishStatus === 'error' ? '润色失败' : '等待润色'}
          </span>
        ) : null}
      </header>

      {isExpanded ? (
        <textarea
          ref={textareaRef}
          aria-label="文本内容"
          className={cn('min-h-[116px] flex-1 resize-none', NODE_UI_CLASS_NAMES.field)}
          value={content}
          onChange={(event) => updateContent(event.target.value)}
          onBlur={() => setIsExpanded(false)}
        />
      ) : (
        <button
          type="button"
          className={cn('min-h-[116px] flex-1 cursor-text overflow-auto whitespace-pre-wrap break-words text-left', NODE_UI_CLASS_NAMES.field)}
          onClick={() => setIsExpanded(true)}
        >
          {content || '写一段节拍、提示词或场景备注'}
        </button>
      )}

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center rounded-full border border-brand/30 bg-success-subtle px-2 py-0.5 text-[11px] font-medium text-brand"
            >
              @{chip.name}
            </span>
          ))}
        </div>
      ) : null}

      {selected || isExpanded ? (
        <div
          aria-label="Prompt 贡献预览"
          className="max-h-16 overflow-auto rounded-md border border-border-secondary bg-bg-input/60 px-2.5 py-2 text-[11px] leading-[1.5] text-text-muted"
        >
          {content || '该文本节点尚无 prompt 贡献'}
        </div>
      ) : null}

      {isFocusOpen ? (
        <TextFocusModal
          content={content}
          onClose={() => setIsFocusOpen(false)}
          onSave={(nextContent, html) => {
            updateContentAndHtml(nextContent, html)
            setIsFocusOpen(false)
            setIsExpanded(false)
          }}
        />
      ) : null}

      {/* 输入/输出连接点 */}
      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

export const TextNode = React.memo(TextNodeComponent)
