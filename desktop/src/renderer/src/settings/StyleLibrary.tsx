import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Image as ImageIcon, Palette, Pencil, Plus, Power, Trash2, X } from 'lucide-react'

import type { IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import type { StylePresetSaveInput, StylePresetView } from '../../../../../shared/styles'
import { cn } from '../lib/cn'

export interface StyleLibraryApi {
  listStyles(input?: IpcRequestMap['style.list']): Promise<IpcResponseMap['style.list']>
  saveStyle(input: IpcRequestMap['style.save']): Promise<IpcResponseMap['style.save']>
  deleteStyle(input: IpcRequestMap['style.delete']): Promise<IpcResponseMap['style.delete']>
}

export interface StyleLibraryProps {
  api?: StyleLibraryApi
}

type LoadState = 'loading' | 'ready' | 'error'

interface StyleFormState {
  id?: string
  code: string
  name: string
  description: string
  promptBefore: string
  promptAfter: string
  negativePrompt: string
  coverAssetId: string
  tags: string
  enabled: boolean
  sortOrder: number
}

function styleApi(): StyleLibraryApi {
  return window.comicCanvas
}

function emptyForm(): StyleFormState {
  return {
    code: '',
    name: '',
    description: '',
    promptBefore: '',
    promptAfter: '',
    negativePrompt: '',
    coverAssetId: '',
    tags: '',
    enabled: true,
    sortOrder: 0,
  }
}

function formFromStyle(style: StylePresetView): StyleFormState {
  return {
    id: style.id,
    code: style.code,
    name: style.name,
    description: style.description ?? '',
    promptBefore: style.promptBefore ?? '',
    promptAfter: style.promptAfter ?? '',
    negativePrompt: style.negativePrompt ?? '',
    coverAssetId: style.coverAssetId ?? '',
    tags: style.tags.join(', '),
    enabled: style.enabled,
    sortOrder: style.sortOrder,
  }
}

function inputFromForm(form: StyleFormState): StylePresetSaveInput {
  return {
    ...(form.id ? { id: form.id } : {}),
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    promptBefore: form.promptBefore.trim(),
    promptAfter: form.promptAfter.trim(),
    negativePrompt: form.negativePrompt.trim(),
    coverAssetId: form.coverAssetId.trim() || null,
    tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    enabled: form.enabled,
    sortOrder: form.sortOrder,
  }
}

function upsertStyle(current: StylePresetView[], saved: StylePresetView): StylePresetView[] {
  const existing = current.findIndex((style) => style.id === saved.id)
  if (existing === -1) return [...current, saved]
  return current.map((style) => (style.id === saved.id ? saved : style))
}

function sortStyles(styles: StylePresetView[]): StylePresetView[] {
  return styles.slice().sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

/**
 * Renders the style preset library for project and node generation styles.
 * @param props - Optional API override for component tests.
 * @returns Style preset management panel.
 * @throws Error never intentionally; request failures are shown in-panel.
 * @see docs/api-contracts/styles.md
 */
export function StyleLibrary({ api = styleApi() }: StyleLibraryProps): JSX.Element {
  const [styles, setStyles] = useState<StylePresetView[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [editing, setEditing] = useState<StyleFormState | null>(null)
  const [deleting, setDeleting] = useState<StylePresetView | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const orderedStyles = useMemo(() => sortStyles(styles), [styles])

  useEffect(() => {
    async function loadStyles(): Promise<void> {
      setLoadState('loading')
    try {
      const items = await api.listStyles({ includeDisabled: true })
      setStyles(items)
      setLoadState('ready')
    } catch {
      setLoadState('error')
      setMessage('风格库加载失败。')
    }
    }

    void loadStyles()
  }, [api])

  async function saveCurrent(): Promise<void> {
    if (!editing) return
    const input = inputFromForm(editing)
    if (!input.name || !input.code) {
      setMessage('风格名称和风格编码不能为空。')
      return
    }

    try {
      const saved = await api.saveStyle(input)
      setStyles((current) => sortStyles(upsertStyle(current, saved)))
      setEditing(null)
      setMessage(`已保存 ${saved.name}`)
    } catch {
      setMessage('风格保存失败。')
    }
  }

  async function toggleEnabled(style: StylePresetView): Promise<void> {
    const saved = await api.saveStyle({
      id: style.id,
      code: style.code,
      name: style.name,
      description: style.description,
      promptBefore: style.promptBefore ?? null,
      promptAfter: style.promptAfter ?? null,
      legacyPromptPreset: style.legacyPromptPreset ?? null,
      negativePrompt: style.negativePrompt ?? null,
      coverAssetId: style.coverAssetId ?? null,
      tags: style.tags,
      enabled: !style.enabled,
      sortOrder: style.sortOrder,
    })
    setStyles((current) => upsertStyle(current, saved))
    setMessage(`${saved.enabled ? '已启用' : '已停用'} ${saved.name}`)
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) return
    const target = deleting
    await api.deleteStyle({ stylePresetId: target.id })
    setStyles((current) => current.filter((style) => style.id !== target.id))
    setDeleting(null)
    setMessage(`已删除 ${target.name}`)
  }

  return (
    <section className="flex w-full max-w-6xl flex-col gap-5 rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-card">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">风格</p>
          <h1 className="text-[24px] font-bold leading-tight text-text-base">风格库</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            管理项目默认风格和节点覆盖风格使用的前置、后置提示词。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(emptyForm())}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover"
          aria-label="新增风格"
        >
          <Plus className="h-4 w-4" />
          新增风格
        </button>
      </header>

      {message && (
        <div className="inline-flex max-w-max items-center gap-2 rounded-pill border border-border-secondary bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-semantic-success" />
          {message}
        </div>
      )}

      {editing && (
        <div className="grid gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 md:grid-cols-2">
          <label className="grid gap-1 text-[12px] font-medium text-text-secondary">
            风格名称
            <input
              aria-label="风格名称"
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:border-border-primary"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-medium text-text-secondary">
            风格编码
            <input
              aria-label="风格编码"
              value={editing.code}
              onChange={(event) => setEditing({ ...editing, code: event.target.value })}
              className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:border-border-primary"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-medium text-text-secondary md:col-span-2">
            描述
            <input
              aria-label="描述"
              value={editing.description}
              onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:border-border-primary"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-medium text-text-secondary">
            前置提示词
            <textarea
              aria-label="前置提示词"
              value={editing.promptBefore}
              onChange={(event) => setEditing({ ...editing, promptBefore: event.target.value })}
              className="min-h-20 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:border-border-primary"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-medium text-text-secondary">
            后置提示词
            <textarea
              aria-label="后置提示词"
              value={editing.promptAfter}
              onChange={(event) => setEditing({ ...editing, promptAfter: event.target.value })}
              className="min-h-20 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:border-border-primary"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-medium text-text-secondary">
            负向提示词
            <input
              aria-label="负向提示词"
              value={editing.negativePrompt}
              onChange={(event) => setEditing({ ...editing, negativePrompt: event.target.value })}
              className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:border-border-primary"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-medium text-text-secondary">
            封面资产 ID
            <input
              aria-label="封面资产 ID"
              value={editing.coverAssetId}
              onChange={(event) => setEditing({ ...editing, coverAssetId: event.target.value })}
              placeholder="asset-..."
              className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:border-border-primary"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-medium text-text-secondary md:col-span-2">
            标签
            <input
              aria-label="标签"
              value={editing.tags}
              onChange={(event) => setEditing({ ...editing, tags: event.target.value })}
              className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:border-border-primary"
            />
          </label>
          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-base"
            >
              <X className="h-4 w-4" />
              取消
            </button>
            <button
              type="button"
              onClick={() => void saveCurrent()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base"
            >
              保存风格
            </button>
          </div>
        </div>
      )}

      {loadState === 'loading' && <p className="text-[13px] text-text-muted">正在加载风格...</p>}
      {loadState === 'error' && <p className="text-[13px] text-semantic-negative">风格库无法加载。</p>}

      {loadState === 'ready' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {orderedStyles.map((style) => (
            <article key={style.id} className="flex flex-col gap-4 rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-input">
                  {style.coverUrl ? (
                    <img src={style.coverUrl} alt={`${style.name} 封面`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-text-muted">
                      <ImageIcon className="h-5 w-5 opacity-60" />
                      无封面
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[16px] font-semibold text-text-base">{style.name}</h2>
                    <span className="rounded-pill border border-border-input bg-bg-input px-2 py-0.5 font-mono text-[12px] text-text-muted">{style.code}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">{style.description || '暂无描述'}</p>
                </div>
                <label className="ml-auto inline-flex items-center gap-2 text-[12px] font-medium text-text-secondary">
                  <span className="sr-only">{style.name} enabled</span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`${style.name} enabled`}
                    checked={style.enabled}
                    onChange={() => void toggleEnabled(style)}
                    className="h-4 w-8 rounded-pill accent-[var(--cc-accent-gold)]"
                  />
                  <Power className={cn('h-4 w-4', style.enabled ? 'text-semantic-success' : 'text-text-muted')} />
                </label>
              </div>

              <dl className="grid gap-2 text-[12px] text-text-secondary">
                <div>
                  <dt className="mb-1 text-text-muted">Before</dt>
                  <dd className="line-clamp-2 rounded-lg bg-bg-input px-2 py-1.5">{style.promptBefore || '无'}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-text-muted">后置</dt>
                  <dd className="line-clamp-2 rounded-lg bg-bg-input px-2 py-1.5">{style.promptAfter || '无'}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {style.tags.length === 0 && <span className="rounded-pill border border-border-input bg-bg-input px-2 py-1 text-[12px] text-text-muted">无标签</span>}
                {style.tags.map((tag) => (
                  <span key={`${style.id}-${tag}`} className="inline-flex items-center gap-1 rounded-pill border border-border-input bg-bg-input px-2 py-1 text-[12px] font-medium text-text-secondary">
                    <Palette className="h-3.5 w-3.5 text-brand" />
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(formFromStyle(style))}
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-1.5 text-[13px] font-medium text-text-base transition hover:border-border-primary"
                  aria-label={`编辑 ${style.name}`}
                >
                  <Pencil className="h-4 w-4 text-brand" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(style)}
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-1.5 text-[13px] font-medium text-semantic-negative transition hover:border-border-primary"
                  aria-label={`删除 ${style.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleting && (
        <div role="alertdialog" aria-modal="true" aria-label={`删除风格 ${deleting.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-pop">
            <h2 className="text-[16px] font-semibold text-text-base">删除 {deleting.name}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">已有节点会保留风格 ID，但这个预设不会再出现在选择器中。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-base"
              >
                取消
              </button>
              <button type="button" onClick={() => void confirmDelete()} className="rounded-lg bg-semantic-negative px-3 py-2 text-[13px] font-semibold text-white">
                确认删除风格
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
