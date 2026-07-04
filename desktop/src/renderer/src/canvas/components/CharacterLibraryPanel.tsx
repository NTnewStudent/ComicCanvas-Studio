/**
 * Canvas character/category library panel.
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/canvas-plan.md
 */

import { Search, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { AssetCategory } from '../../../../../../shared/assets'

export interface CharacterLibraryPanelProps {
  open: boolean
  categories: AssetCategory[]
  onCreateCharacterNode: (category: AssetCategory | null) => void
  onClose: () => void
}

/**
 * Renders a lightweight category-backed character panel.
 * @param props - Panel visibility, available image categories, and insertion handler.
 * @returns Floating character/category panel or null.
 * @throws Error never intentionally.
 * @see docs/api-contracts/assets-files.md
 */
export function CharacterLibraryPanel({
  open,
  categories,
  onCreateCharacterNode,
  onClose,
}: CharacterLibraryPanelProps): JSX.Element | null {
  const [keyword, setKeyword] = useState('')
  const filteredCategories = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    if (!needle) return categories
    return categories.filter((category) => (
      category.name.toLowerCase().includes(needle) ||
      (category.description ?? '').toLowerCase().includes(needle)
    ))
  }, [categories, keyword])

  if (!open) return null

  return (
    <section
      aria-label="角色分类面板"
      className="nopan nodrag nowheel pointer-events-auto absolute left-[72px] top-4 z-30 flex max-h-[min(620px,calc(100vh-96px))] w-[360px] flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-panel shadow-pop"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-secondary px-4">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-brand" />
          <div>
            <h2 className="text-[14px] font-bold text-text-base">角色 / 场景分类</h2>
            <p className="text-[11px] text-text-muted">图片资源分类可插入为画布节点</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base"
          aria-label="关闭角色分类面板"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="border-b border-border-secondary p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索分类..."
            className="min-h-8 w-full rounded-md border border-border-input bg-bg-input py-1.5 pl-8 pr-3 text-[13px] text-text-base outline-none transition-shadow placeholder:text-text-muted focus:shadow-active"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          type="button"
          onClick={() => onCreateCharacterNode(null)}
          className="mb-2 flex w-full items-center gap-3 rounded-lg border border-border-secondary bg-bg-card px-3 py-2 text-left transition-all duration-200 ease-luxury hover:border-brand/40 hover:bg-bg-hover"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <UserRound className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[13px] font-semibold text-text-base">新建空角色节点</span>
            <span className="block text-[11px] text-text-muted">稍后从资产面板绑定图片资源</span>
          </span>
        </button>
        {filteredCategories.length === 0 ? (
          <div className="rounded-lg border border-border-secondary bg-bg-card px-3 py-8 text-center text-[12px] text-text-muted">
            暂无匹配分类
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onCreateCharacterNode(category)}
                className="flex w-full items-center gap-3 rounded-lg border border-border-secondary bg-bg-card px-3 py-2 text-left transition-all duration-200 ease-luxury hover:border-brand/40 hover:bg-bg-hover"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold text-bg-base"
                  style={{ backgroundColor: category.color ?? 'var(--cc-accent)' }}
                >
                  {(category.icon ?? category.name).slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-text-base">{category.name}</span>
                  <span className="block truncate text-[11px] text-text-muted">{category.description ?? '自定义图片分类'}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
