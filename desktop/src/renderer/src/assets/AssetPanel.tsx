import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Folder,
  FolderPlus,
  Grid3X3,
  Image,
  LayoutList,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react'

import type {
  AssetFolder,
  AssetFolderCreateRequest,
  AssetFolderDeleteRequest,
  AssetFolderDeleteResponse,
  AssetMoveRequest,
  AssetRecord,
  AssetTrashRequest,
  AssetTrashResponse,
} from '../../../../../shared/assets'
import { cn } from '../lib/cn'

/**
 * Asset library API surface for the panel component.
 * @see docs/api-contracts/assets-files.md
 */
export interface AssetLibraryApi {
  listAssets: (input?: { folderId?: string; mediaType?: string; keyword?: string }) => Promise<AssetRecord[]>
  getAssetFolders: () => Promise<AssetFolder[]>
  createAssetFolder: (input: AssetFolderCreateRequest) => Promise<AssetFolder>
  moveAsset: (input: AssetMoveRequest) => Promise<AssetRecord>
  trashAsset: (input: AssetTrashRequest) => Promise<AssetTrashResponse>
  deleteAssetFolder: (input: AssetFolderDeleteRequest) => Promise<AssetFolderDeleteResponse>
}

export interface AssetPanelProps {
  api?: AssetLibraryApi
}

type LoadState = 'loading' | 'ready' | 'error'
type ViewMode = 'grid' | 'list'

interface FolderNode {
  folder: AssetFolder
  depth: number
}

function defaultApi(): AssetLibraryApi {
  return window.comicCanvas
}

/** Flattens nested folder tree into ordered list with depth info. */
function flattenFolders(folders: AssetFolder[], parentId: string | null = null, depth = 0): FolderNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((folder) => [{ folder, depth }, ...flattenFolders(folders, folder.id, depth + 1)])
}

/** Collects all descendant folder IDs for batch deletion. */
function collectDescendantIds(folders: AssetFolder[], folderId: string): Set<string> {
  const ids = new Set<string>([folderId])
  let changed = true

  while (changed) {
    changed = false
    for (const folder of folders) {
      if (folder.parentId !== null && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id)
        changed = true
      }
    }
  }

  return ids
}

function basename(path: string): string {
  const fileName = path.split(/[\\/]/u).pop() ?? path
  return fileName.replace(/\.[^.]+$/u, '')
}

function titleize(value: string): string {
  return value
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function assetLabel(asset: AssetRecord): string {
  const dimensions = asset.metadata.width && asset.metadata.height ? ` ${asset.metadata.width}x${asset.metadata.height}` : ''
  return `${titleize(basename(asset.relativePath))}${dimensions}`
}

function folderName(folders: AssetFolder[], folderId: string | null): string {
  if (!folderId) {
    return '全部资产'
  }

  return folders.find((folder) => folder.id === folderId)?.name ?? '未知文件夹'
}

/** Formats a timestamp into a locale-friendly date string. */
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Renders the local asset library with folder tree and hjwall-inspired card grid.
 * @param props - Optional API override for component tests.
 * @returns Asset library management panel.
 * @throws Error never intentionally; request failures are presented as local panel state.
 * @see docs/api-contracts/assets-files.md
 */
export function AssetPanel({ api = defaultApi() }: AssetPanelProps): JSX.Element {
  const [folders, setFolders] = useState<AssetFolder[]>([])
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [assetState, setAssetState] = useState<LoadState>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchKeyword, setSearchKeyword] = useState('')
  const orderedFolders = useMemo(() => flattenFolders(folders), [folders])
  const selectedFolder = selectedFolderId ? folders.find((folder) => folder.id === selectedFolderId) ?? null : null

  const filteredAssets = useMemo(() => {
    if (!searchKeyword.trim()) return assets
    const kw = searchKeyword.toLowerCase()
    return assets.filter((a) => a.id.toLowerCase().includes(kw) || a.relativePath.toLowerCase().includes(kw))
  }, [assets, searchKeyword])

  useEffect(() => {
    async function loadFolders(): Promise<void> {
      setLoadState('loading')

      try {
        const items = await api.getAssetFolders()
        setFolders(items)
        setLoadState('ready')
      } catch {
        // Folder load failures stay local so the rest of the renderer remains usable.
        setLoadState('error')
        setMessage('资产文件夹加载失败。')
      }
    }

    void loadFolders()
  }, [api])

  useEffect(() => {
    async function loadAssets(): Promise<void> {
      setAssetState('loading')

      try {
        const request = selectedFolderId ? { folderId: selectedFolderId } : {}
        const items = await api.listAssets(request)
        setAssets(items)
        setAssetState('ready')
      } catch {
        // Asset list failures should not expose IPC details in renderer UI.
        setAssetState('error')
        setMessage('资产加载失败。')
      }
    }

    void loadAssets()
  }, [api, selectedFolderId])

  async function createFolder(): Promise<void> {
    const name = newFolderName.trim()
    if (!name) {
      setMessage('文件夹名称为必填项。')
      return
    }

    try {
      const created = await api.createAssetFolder({ name, parentId: selectedFolderId, type: 'mixed' })
      setFolders((current) => [...current, created])
      setNewFolderName('')
      setMessage(`已创建 ${created.name}`)
    } catch {
      // Folder creation errors are recoverable and should leave the typed name intact.
      setMessage('文件夹创建失败。')
    }
  }

  async function moveAsset(asset: AssetRecord, folderId: string | null): Promise<void> {
    try {
      const moved = await api.moveAsset({ assetId: asset.id, folderId })
      setAssets((current) => current.map((item) => (item.id === moved.id ? moved : item)))
      setMessage(`已移动 ${asset.id}`)
    } catch {
      // Move failures can happen when the target folder was deleted in another surface.
      setMessage('资产移动失败。')
    }
  }

  async function trashAsset(asset: AssetRecord): Promise<void> {
    try {
      const result = await api.trashAsset({ assetId: asset.id, mode: 'safe' })
      if (result.status === 'rejected') {
        setMessage(`${asset.id} 仍被引用中。`)
        return
      }

      setAssets((current) => current.filter((item) => item.id !== asset.id))
      setMessage(`已回收 ${asset.id}`)
    } catch {
      // Trash failures are shown locally because destructive actions need clear recovery.
      setMessage('资产回收失败。')
    }
  }

  async function deleteSelectedFolder(): Promise<void> {
    if (!selectedFolder) {
      return
    }

    try {
      const deleted = await api.deleteAssetFolder({ folderId: selectedFolder.id, mode: 'force-tombstone' })
      if (deleted.status === 'rejected') {
        setMessage(`${selectedFolder.name} 存在阻塞引用。`)
        return
      }

      const deletedIds = collectDescendantIds(folders, selectedFolder.id)
      setFolders((current) => current.filter((folder) => !deletedIds.has(folder.id)))
      setSelectedFolderId(selectedFolder.parentId)
      setMessage(`已删除 ${selectedFolder.name}`)
    } catch {
      // Delete failures are recoverable and should keep the current folder selection visible.
      setMessage('文件夹删除失败。')
    }
  }

  return (
    <section className="flex h-full flex-col">
      {/* ── 顶部工具栏：搜索 + 视图切换 ── */}
      <div className="flex items-center justify-between gap-3 border-b border-border-secondary px-5 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold text-text-base">资产库</h1>
          <div className="inline-flex items-center gap-1.5 rounded-pill border border-border-secondary bg-bg-card px-2.5 py-0.5 text-[12px] text-text-muted">
            <Archive className="h-3.5 w-3.5" />
            {assets.length}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 搜索栏 */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索资产…"
              className="h-8 w-52 rounded-lg border border-border-secondary bg-bg-input pl-8 pr-3 text-[13px] text-text-base placeholder:text-text-muted focus:border-border-primary focus:outline-none"
            />
          </div>
          {/* 视图切换 */}
          <div className="flex items-center rounded-lg border border-border-secondary bg-bg-card p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="网格视图"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-bg-hover text-text-base' : 'text-text-muted hover:text-text-secondary',
              )}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="列表视图"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                viewMode === 'list' ? 'bg-bg-hover text-text-base' : 'text-text-muted hover:text-text-secondary',
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 状态消息 */}
      {message && (
        <div className="border-b border-border-secondary px-5 py-2">
          <span className="inline-flex max-w-max rounded-pill border border-border-secondary bg-bg-card px-3 py-1 text-[12px] text-text-secondary">
            {message}
          </span>
        </div>
      )}

      {/* ── 主体：左侧文件夹树 + 右侧资产网格 ── */}
      <div className="flex min-h-0 flex-1">
        {/* 左侧文件夹树 */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border-secondary bg-bg-surface">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[12px] font-bold uppercase tracking-wider text-text-muted">文件夹</span>
            <span className="rounded-pill bg-bg-hover px-1.5 py-0.5 text-[11px] text-text-muted">{folders.length}</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {/* 根目录按钮 */}
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                selectedFolderId === null
                  ? 'bg-bg-hover text-text-base'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
              )}
            >
              <Folder className="h-4 w-4 shrink-0 text-brand" />
              全部资产
            </button>

            {loadState === 'loading' && (
              <p className="flex items-center gap-2 px-3 py-2 text-[12px] text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                加载中…
              </p>
            )}
            {loadState === 'error' && (
              <p className="px-3 py-2 text-[12px] text-semantic-negative">加载失败</p>
            )}
            {loadState === 'ready' &&
              orderedFolders.map(({ folder, depth }) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-[13px] font-medium transition-colors',
                    selectedFolderId === folder.id
                      ? 'bg-bg-hover text-text-base'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
                  )}
                  style={{ paddingLeft: `${12 + depth * 14}px` }}
                >
                  <Folder className="h-4 w-4 shrink-0 text-brand" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
          </div>

          {/* 新建/删除文件夹 */}
          <div className="flex flex-col gap-2 border-t border-border-secondary p-3">
            <input
              aria-label="新文件夹名称"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              className="h-8 rounded-lg border border-border-secondary bg-bg-input px-2.5 text-[12px] text-text-base placeholder:text-text-muted focus:border-border-primary focus:outline-none"
              placeholder="文件夹名称"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void createFolder()}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand px-2.5 text-[12px] font-semibold text-bg-base transition-colors hover:bg-brand-hover"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                创建
              </button>
              <button
                type="button"
                onClick={() => void deleteSelectedFolder()}
                disabled={!selectedFolder}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-secondary bg-bg-card px-2.5 text-[12px] font-semibold text-text-secondary transition-colors hover:border-border-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </button>
            </div>
          </div>
        </aside>

        {/* 右侧资产展示区 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4">
          {/* 当前文件夹标题 */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-text-base">
              {folderName(folders, selectedFolderId)}
            </h2>
            <span className="text-[12px] text-text-muted">
              {filteredAssets.length} 个资产
            </span>
          </div>

          {assetState === 'loading' && (
            <div className="flex flex-1 items-center justify-center">
              <p className="flex items-center gap-2 text-[13px] text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                资产加载中…
              </p>
            </div>
          )}
          {assetState === 'error' && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[13px] text-semantic-negative">资产加载失败。</p>
            </div>
          )}
          {assetState === 'ready' && filteredAssets.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Image className="h-10 w-10 text-text-muted" />
              <p className="text-[13px] text-text-secondary">
                {searchKeyword ? '未找到匹配的资产。' : '此文件夹中暂无资产。'}
              </p>
            </div>
          )}

          {/* 网格视图 */}
          {assetState === 'ready' && filteredAssets.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredAssets.map((asset) => {
                const label = assetLabel(asset)

                return (
                  <article
                    key={asset.id}
                    className="group relative aspect-square w-full overflow-hidden rounded-xl border border-border-secondary bg-bg-card transition hover:border-border-primary hover:shadow-card"
                  >
                    {/* 缩略图 */}
                    <div className="flex h-full w-full items-center justify-center overflow-hidden">
                      {asset.mediaType === 'image' ? (
                        <img
                          src={asset.safeUrl}
                          alt={label}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-bg-input">
                          <Image className="h-8 w-8 text-text-muted" />
                          <span className="mt-2 text-[11px] text-text-muted">
                            {asset.mediaType === 'video' ? '视频' : '文本'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Hover 遮罩 — 文件名 + 时间 */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/80 to-transparent p-3 transition group-hover:translate-y-0">
                      <p className="truncate text-[12px] font-medium text-white">{asset.id}</p>
                      <p className="mt-0.5 text-[11px] text-white/70">{formatDate(asset.createdAt)}</p>
                    </div>

                    {/* Hover 操作按钮 */}
                    <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`回收 ${label}`}
                        onClick={() => void trashAsset(asset)}
                        className="rounded-md bg-black/60 p-1.5 text-white transition hover:bg-black/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* 移动下拉（始终显示在底部，hover 时可见） */}
                    <div className="absolute inset-x-0 bottom-0 z-20 hidden group-hover:block">
                      <div className="translate-y-full bg-black/70 p-2 transition group-hover:translate-y-0">
                        <select
                          aria-label={`移动 ${label}`}
                          value={asset.folderId ?? '__root__'}
                          onChange={(event) =>
                            void moveAsset(asset, event.target.value === '__root__' ? null : event.target.value)
                          }
                          className="h-7 w-full rounded-md border border-border-secondary bg-bg-card px-2 text-[11px] text-text-base outline-none"
                        >
                          <option value="__root__">全部资产</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* 列表视图 */}
          {assetState === 'ready' && filteredAssets.length > 0 && viewMode === 'list' && (
            <div className="flex flex-col gap-1">
              {filteredAssets.map((asset) => {
                const label = assetLabel(asset)

                return (
                  <div
                    key={asset.id}
                    className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-border-secondary hover:bg-bg-card"
                  >
                    {/* 缩略图 */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-secondary bg-bg-input">
                      {asset.mediaType === 'image' ? (
                        <img src={asset.safeUrl} alt={label} className="h-full w-full object-cover" />
                      ) : (
                        <Image className="h-4 w-4 text-text-muted" />
                      )}
                    </div>

                    {/* 名称 */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text-base">{asset.id}</p>
                      <p className="truncate text-[11px] text-text-muted">{label}</p>
                    </div>

                    {/* 时间 */}
                    <span className="shrink-0 text-[12px] text-text-muted">
                      {formatDate(asset.createdAt)}
                    </span>

                    {/* 移动 */}
                    <select
                      aria-label={`移动 ${label}`}
                      value={asset.folderId ?? '__root__'}
                      onChange={(event) =>
                        void moveAsset(asset, event.target.value === '__root__' ? null : event.target.value)
                      }
                      className="h-7 w-28 shrink-0 rounded-md border border-border-secondary bg-bg-input px-2 text-[11px] text-text-base outline-none"
                    >
                      <option value="__root__">全部资产</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>

                    {/* 删除 */}
                    <button
                      type="button"
                      aria-label={`回收 ${label}`}
                      onClick={() => void trashAsset(asset)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:text-semantic-negative"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
