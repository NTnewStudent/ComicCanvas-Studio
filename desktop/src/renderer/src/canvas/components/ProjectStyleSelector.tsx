import { useEffect, useMemo, useState } from 'react'
import { Palette } from 'lucide-react'

import type { IpcRequestMap, IpcResponseMap } from '../../../../../../shared/ipc'
import type { StylePresetView } from '../../../../../../shared/styles'
import { cn } from '../../lib/cn'

export interface ProjectStyleSelectorApi {
  listStyles(input?: IpcRequestMap['style.list']): Promise<IpcResponseMap['style.list']>
  getProjectDefaultStyle(input: IpcRequestMap['style.getProjectDefault']): Promise<IpcResponseMap['style.getProjectDefault']>
  setProjectDefaultStyle(input: IpcRequestMap['style.setProjectDefault']): Promise<IpcResponseMap['style.setProjectDefault']>
}

export interface ProjectStyleSelectorProps {
  workflowId: string
  api?: ProjectStyleSelectorApi
}

type LoadState = 'loading' | 'ready' | 'error'

function styleApi(): ProjectStyleSelectorApi {
  return window.comicCanvas
}

function selectedName(styles: StylePresetView[], stylePresetId: string | null): string {
  if (!stylePresetId) return '无'
  return styles.find((style) => style.id === stylePresetId)?.name ?? '不可用'
}

/**
 * Renders and persists the current workflow's default style preset.
 * @param props - Workflow ID and optional API override for tests.
 * @returns Compact project style selector for the canvas toolbar.
 * @throws Error never intentionally; request failures are shown as an error label.
 * @see docs/api-contracts/styles.md
 */
export function ProjectStyleSelector({ workflowId, api = styleApi() }: ProjectStyleSelectorProps): JSX.Element {
  const [styles, setStyles] = useState<StylePresetView[]>([])
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [open, setOpen] = useState(false)
  const orderedStyles = useMemo(
    () => styles.slice().sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [styles],
  )
  const label = selectedName(styles, selectedStyleId)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setLoadState('loading')
      setOpen(false)

      try {
        const [styleList, defaultStyle] = await Promise.all([
          api.listStyles({ includeDisabled: false }),
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
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [api, workflowId])

  async function selectStyle(stylePresetId: string | null): Promise<void> {
    const previous = selectedStyleId
    setSelectedStyleId(stylePresetId)
    setOpen(false)

    try {
      const saved = await api.setProjectDefaultStyle({ workflowId, stylePresetId })
      setSelectedStyleId(saved.stylePresetId)
    } catch {
      setSelectedStyleId(previous)
      setLoadState('error')
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={loadState === 'loading'}
        className={cn(
          'inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base disabled:opacity-50',
          open && 'border-border-primary text-text-base',
        )}
        aria-label={`项目风格：${loadState === 'error' ? '错误' : label}`}
      >
        <Palette className="h-3.5 w-3.5 text-brand" />
        <span className="truncate">{loadState === 'loading' ? '项目风格...' : loadState === 'error' ? '风格错误' : label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-[240px] overflow-hidden rounded-xl border border-border-primary bg-bg-panel py-1.5 shadow-pop">
          <button
            type="button"
            onClick={() => void selectStyle(null)}
            className={cn(
              'flex w-full items-center justify-between px-3 py-2 text-left text-[12px] text-text-secondary hover:bg-bg-hover hover:text-text-base',
              selectedStyleId === null && 'bg-success-subtle text-brand',
            )}
          >
            不使用项目风格
          </button>
          {orderedStyles.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => void selectStyle(style.id)}
              aria-label={style.name}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] text-text-secondary hover:bg-bg-hover hover:text-text-base',
                selectedStyleId === style.id && 'bg-success-subtle text-brand',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{style.name}</span>
              {style.tags[0] && <span className="shrink-0 rounded-pill bg-bg-input px-2 py-0.5 text-[11px] text-text-muted">{style.tags[0]}</span>}
            </button>
          ))}
          {orderedStyles.length === 0 && <p className="px-3 py-2 text-[12px] text-text-muted">暂无可用风格</p>}
        </div>
      )}
    </div>
  )
}
