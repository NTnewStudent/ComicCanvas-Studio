/**
 * Workflow and snippet panel for reusable canvas fragments.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Package, Trash2, Workflow, X } from 'lucide-react'

import type { CanvasSnippetView } from '../../../../../../shared/snippets'
import { CenteredCanvasPanel } from './CenteredCanvasPanel'

export interface WorkflowPanelProps {
  open: boolean
  snippets: CanvasSnippetView[]
  selectedSnippetId: string
  onSelectSnippet: (id: string) => void
  onInsertSnippet: () => void
  onSaveSnippet: () => void
  onDeleteSnippet: (id: string) => void
  onClose: () => void
}

/**
 * Renders the workflow/snippet library panel.
 * @param props - Panel visibility, snippet list, and actions.
 * @returns Floating workflow panel or null when closed.
 * @throws Error never intentionally.
 * @see docs/api-contracts/canvas-plan.md
 */
export function WorkflowPanel({
  open,
  snippets,
  selectedSnippetId,
  onSelectSnippet,
  onInsertSnippet,
  onSaveSnippet,
  onDeleteSnippet,
  onClose,
}: WorkflowPanelProps): JSX.Element | null {
  if (!open) return null

  return (
    <CenteredCanvasPanel ariaLabel="工作流片段面板" onClose={onClose}>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-secondary px-4">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-brand" />
          <div>
            <h2 className="text-[14px] font-bold text-text-base">工作流片段</h2>
            <p className="text-[11px] text-text-muted">保存和插入可复用画布片段</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base"
          aria-label="关闭工作流片段面板"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <button
          type="button"
          onClick={onSaveSnippet}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-3 text-[13px] font-semibold text-bg-base transition-all duration-200 ease-luxury hover:bg-brand-hover active:scale-95"
        >
          保存选中节点为片段
        </button>
        {snippets.length === 0 ? (
          <div className="rounded-lg border border-border-secondary bg-bg-card px-3 py-8 text-center text-[12px] text-text-muted">
            暂无片段。选择至少两个节点后保存。
          </div>
        ) : (
          <div className="space-y-2">
            {snippets.map((snippet) => {
              const active = snippet.id === selectedSnippetId
              const scopeLabel = snippet.scope === 'public' ? '公共片段' : '我的片段'
              return (
                <div
                  key={snippet.id}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-200 ease-luxury ${
                    active
                      ? 'border-brand/60 bg-brand/10'
                      : 'border-border-secondary bg-bg-card hover:border-brand/40 hover:bg-bg-hover'
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`选择片段 ${snippet.name}`}
                    onClick={() => onSelectSnippet(snippet.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    {snippet.thumbnailUrl ? (
                      <img
                        src={snippet.thumbnailUrl}
                        alt={`${snippet.name} thumbnail`}
                        className="h-12 w-12 shrink-0 rounded-md border border-border-secondary object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border-secondary bg-bg-panel">
                        <Package className="h-4 w-4 text-brand" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-[13px] font-semibold text-text-base">{snippet.name}</span>
                        <span className="shrink-0 rounded border border-border-secondary px-1.5 py-0.5 text-[10px] text-text-muted">{scopeLabel}</span>
                      </span>
                      <span className="mt-1 block text-[11px] text-text-muted">
                        {snippet.nodeCount} nodes / {snippet.edgeCount} edges
                      </span>
                      {snippet.description && (
                        <span className="mt-1 line-clamp-2 block text-[11px] text-text-secondary">{snippet.description}</span>
                      )}
                      {snippet.tags && snippet.tags.length > 0 && (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {snippet.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded bg-bg-panel px-1.5 py-0.5 text-[10px] text-text-muted">{tag}</span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`删除片段 ${snippet.name}`}
                    disabled={!snippet.ownedByCurrentUser}
                    onClick={() => onDeleteSnippet(snippet.id)}
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all duration-200 ease-luxury ${
                      snippet.ownedByCurrentUser
                        ? 'text-text-muted hover:bg-danger/10 hover:text-danger'
                        : 'cursor-not-allowed text-text-muted/40'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <footer className="border-t border-border-secondary p-3">
        <button
          type="button"
          onClick={onInsertSnippet}
          disabled={!selectedSnippetId}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-semibold text-text-base transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          插入片段
        </button>
      </footer>
    </CenteredCanvasPanel>
  )
}
