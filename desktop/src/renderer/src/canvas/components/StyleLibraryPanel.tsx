/**
 * Canvas style library panel for project default style review.
 * @see docs/api-contracts/canvas-plan.md
 */

import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Palette, X } from 'lucide-react'

import type { IpcRequestMap, IpcResponseMap } from '../../../../../../shared/ipc'
import type { StylePresetView } from '../../../../../../shared/styles'
import { cn } from '../../lib/cn'
import { CenteredCanvasPanel } from './CenteredCanvasPanel'

export interface StyleLibraryPanelApi {
  listStyles(input?: IpcRequestMap['style.list']): Promise<IpcResponseMap['style.list']>
  getProjectDefaultStyle(input: IpcRequestMap['style.getProjectDefault']): Promise<IpcResponseMap['style.getProjectDefault']>
  setProjectDefaultStyle(input: IpcRequestMap['style.setProjectDefault']): Promise<IpcResponseMap['style.setProjectDefault']>
}

export interface StyleLibraryPanelProps {
  open: boolean
  workflowId: string
  onClose: () => void
  api?: StyleLibraryPanelApi
}

type LoadState = 'loading' | 'ready' | 'error'

function styleApi(): StyleLibraryPanelApi {
  return window.comicCanvas
}

function sortStyles(styles: StylePresetView[]): StylePresetView[] {
  return styles.slice().sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

/**
 * Renders the canvas style panel for browsing presets and assigning the project default.
 * @param props - Panel visibility and close callback.
 * @returns Floating style panel or null.
 * @throws Error never intentionally.
 * @see docs/api-contracts/canvas-plan.md
 */
export function StyleLibraryPanel({ open, workflowId, onClose, api = styleApi() }: StyleLibraryPanelProps): JSX.Element | null {
  const [styles, setStyles] = useState<StylePresetView[]>([])
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const orderedStyles = useMemo(() => sortStyles(styles), [styles])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load(): Promise<void> {
      setLoadState('loading')
      setMessage(null)
      try {
        const [styleList, defaultStyle] = await Promise.all([
          api.listStyles({ includeDisabled: true }),
          api.getProjectDefaultStyle({ workflowId }),
        ])
        if (cancelled) return
        setStyles(styleList)
        setSelectedStyleId(defaultStyle.stylePresetId)
        setLoadState('ready')
      } catch {
        if (cancelled) return
        setStyles([])
        setSelectedStyleId(null)
        setLoadState('error')
        setMessage('画风库加载失败。')
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [api, open, workflowId])

  async function setDefaultStyle(stylePresetId: string | null): Promise<void> {
    const previous = selectedStyleId
    setSelectedStyleId(stylePresetId)
    setMessage(null)
    try {
      const saved = await api.setProjectDefaultStyle({ workflowId, stylePresetId })
      setSelectedStyleId(saved.stylePresetId)
      setMessage(saved.stylePresetId ? '已更新项目默认画风。' : '已清除项目默认画风。')
    } catch {
      setSelectedStyleId(previous)
      setMessage('项目默认画风更新失败。')
    }
  }

  if (!open) return null

  return (
    <CenteredCanvasPanel ariaLabel="画风库面板" onClose={onClose}>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-secondary px-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-brand" />
          <div>
            <h2 className="text-[14px] font-bold text-text-base">画风库</h2>
            <p className="text-[11px] text-text-muted">项目默认画风与节点覆盖参考</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base"
          aria-label="关闭画风库面板"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-[260px] flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-secondary px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-text-base">项目默认</p>
            <p className="truncate text-[11px] text-text-muted">
              {selectedStyleId ? orderedStyles.find((style) => style.id === selectedStyleId)?.name ?? '不可用画风' : '未设置'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void setDefaultStyle(null)}
            className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border-secondary px-2.5 text-[12px] font-semibold text-text-secondary transition hover:bg-bg-hover hover:text-text-base"
            aria-label="清除项目默认画风"
          >
            清除默认
          </button>
        </div>

        {message && (
          <div className="mx-4 mt-3 rounded-lg border border-border-secondary bg-bg-card px-3 py-2 text-[12px] text-text-secondary">
            {message}
          </div>
        )}

        {loadState === 'loading' && <div className="p-4 text-[13px] text-text-muted">正在加载画风...</div>}
        {loadState === 'error' && <div className="p-4 text-[13px] text-semantic-negative">画风库无法加载。</div>}
        {loadState === 'ready' && orderedStyles.length === 0 && <div className="p-4 text-[13px] text-text-muted">暂无画风。</div>}

        {loadState === 'ready' && orderedStyles.length > 0 && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-3">
              {orderedStyles.map((style) => {
                const isDefault = selectedStyleId === style.id
                return (
                  <article
                    key={style.id}
                    className={cn(
                      'rounded-xl border bg-bg-card p-3 transition',
                      isDefault ? 'border-brand/60 shadow-card' : 'border-border-secondary',
                      !style.enabled && 'opacity-70',
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-input">
                        {style.coverUrl ? (
                          <img src={style.coverUrl} alt={`${style.name} 封面`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-[11px] text-text-muted">
                            <ImageIcon className="h-4 w-4" />
                            无封面
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate text-[13px] font-bold text-text-base">{style.name}</h3>
                          {isDefault && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">当前项目默认</span>}
                          {!style.enabled && <span className="rounded-full bg-bg-input px-2 py-0.5 text-[11px] font-semibold text-text-muted">已停用</span>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-text-secondary">{style.description ?? '暂无描述'}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {style.tags.length === 0 && <span className="rounded-full border border-border-secondary px-2 py-0.5 text-[11px] text-text-muted">无标签</span>}
                          {style.tags.map((tag) => (
                            <span key={`${style.id}-${tag}`} className="rounded-full border border-border-secondary px-2 py-0.5 text-[11px] text-text-muted">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-mono text-[11px] text-text-muted">{style.code}</span>
                      <button
                        type="button"
                        onClick={() => void setDefaultStyle(style.id)}
                        disabled={isDefault}
                        className="inline-flex h-8 shrink-0 items-center rounded-lg bg-brand px-3 text-[12px] font-semibold text-bg-base transition hover:bg-brand-hover disabled:cursor-default disabled:bg-bg-input disabled:text-text-muted"
                        aria-label={`设为项目默认 ${style.name}`}
                      >
                        {isDefault ? '已设为默认' : '设为默认'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </CenteredCanvasPanel>
  )
}
