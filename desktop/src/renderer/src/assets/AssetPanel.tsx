import { useEffect, useMemo, useState } from 'react'
import { Archive, Folder, FolderPlus, Image, Loader2, Trash2 } from 'lucide-react'

import type {
  AssetFolder,
  AssetFolderCreateRequest,
  AssetFolderDeleteRequest,
  AssetFolderDeleteResponse,
  AssetMoveRequest,
  AssetRecord,
  AssetTrashRequest,
  AssetTrashResponse
} from '../../../../../shared/assets'
import { cn } from '../lib/cn'

export interface AssetLibraryApi {
  listAssets: (input?: { folderId?: string; mediaType?: string }) => Promise<AssetRecord[]>
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

interface FolderNode {
  folder: AssetFolder
  depth: number
}

function defaultApi(): AssetLibraryApi {
  return window.comicCanvas
}

function flattenFolders(folders: AssetFolder[], parentId: string | null = null, depth = 0): FolderNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((folder) => [{ folder, depth }, ...flattenFolders(folders, folder.id, depth + 1)])
}

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
    return '资产库根目录'
  }

  return folders.find((folder) => folder.id === folderId)?.name ?? '未知文件夹'
}

/**
 * Renders the local asset library with nested folders and reference-safe destructive actions.
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
  const orderedFolders = useMemo(() => flattenFolders(folders), [folders])
  const selectedFolder = selectedFolderId ? folders.find((folder) => folder.id === selectedFolderId) ?? null : null

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
    <section className="flex w-full max-w-6xl flex-col gap-5 rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-card">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">资产</p>
          <h1 className="text-[24px] font-bold leading-tight text-text-base">资产库</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            将本地图片、视频、文本输出组织到文件夹中，同时保留画布引用。
          </p>
        </div>
        <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-secondary">
          <Archive className="h-4 w-4 text-brand" />
          {assets.length} 个资产
        </div>
      </header>

      {message && (
        <div className="inline-flex max-w-max rounded-pill border border-border-secondary bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
          {message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-[360px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-3 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-text-base">文件夹</span>
            <span className="rounded-pill border border-border-input bg-bg-input px-2 py-0.5 text-[12px] text-text-muted">{folders.length}</span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              'flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
              selectedFolderId === null ? 'border border-border-primary bg-bg-input text-text-base' : 'text-text-secondary hover:bg-bg-input'
            )}
          >
            <Folder className="h-4 w-4 text-brand" />
            资产库根目录
          </button>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {loadState === 'loading' && (
              <p className="flex items-center gap-2 px-2 py-3 text-[13px] text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                文件夹加载中...
              </p>
            )}
            {loadState === 'error' && <p className="px-2 py-3 text-[13px] text-semantic-negative">文件夹无法加载。</p>}
            {loadState === 'ready' &&
              orderedFolders.map(({ folder, depth }) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  aria-label={`Open folder ${folder.name}`}
                  className={cn(
                    'flex min-h-9 items-center gap-2 rounded-lg py-2 pr-3 text-left text-[13px] font-medium transition-colors',
                    selectedFolderId === folder.id ? 'border border-border-primary bg-bg-input text-text-base' : 'text-text-secondary hover:bg-bg-input'
                  )}
                  style={{ paddingLeft: `${8 + depth * 14}px` }}
                >
                  <Folder className="h-4 w-4 shrink-0 text-brand" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-border-secondary pt-3">
            <label className="sr-only" htmlFor="asset-folder-name">
              新文件夹名称
            </label>
            <input
              id="asset-folder-name"
              aria-label="新文件夹名称"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 text-[13px] text-text-base outline-none transition-shadow focus:shadow-active"
              placeholder="文件夹名称"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-label="创建文件夹"
                onClick={() => void createFolder()}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition-colors hover:bg-brand-hover"
              >
                <FolderPlus className="h-4 w-4" />
                创建
              </button>
              <button
                type="button"
                aria-label={selectedFolder ? `删除文件夹 ${selectedFolder.name}` : '删除选中文件夹'}
                onClick={() => void deleteSelectedFolder()}
                disabled={!selectedFolder}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-[360px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-text-base">{folderName(folders, selectedFolderId)}</h2>
              <p className="mt-1 text-[12px] text-text-muted">引用安全的本地文件</p>
            </div>
            <span className="rounded-pill border border-border-input bg-bg-input px-2.5 py-1 text-[12px] text-text-secondary">{assetState}</span>
          </div>

          {assetState === 'loading' && (
            <p className="flex items-center gap-2 text-[13px] text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              资产加载中...
            </p>
          )}
          {assetState === 'error' && <p className="text-[13px] text-semantic-negative">资产无法加载。</p>}
          {assetState === 'ready' && assets.length === 0 && (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-border-secondary bg-bg-input text-center">
              <Image className="h-7 w-7 text-text-muted" />
              <p className="text-[13px] text-text-secondary">此文件夹中暂无资产。</p>
            </div>
          )}
          {assetState === 'ready' && assets.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {assets.map((asset) => {
                const label = assetLabel(asset)

                return (
                  <article key={asset.id} className="flex min-h-[180px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-input p-3">
                    <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-card">
                      {asset.mediaType === 'image' ? (
                        <img src={asset.safeUrl} alt={label} className="h-full w-full object-contain" />
                      ) : (
                        <Image className="h-8 w-8 text-text-muted" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-semibold text-text-base">{asset.id}</h3>
                      <p className="mt-1 truncate text-[12px] text-text-muted">{label}</p>
                    </div>
                    <div className="mt-auto grid grid-cols-[minmax(0,1fr)_40px] gap-2">
                      <label className="sr-only" htmlFor={`move-${asset.id}`}>
                        {`Move ${label}`}
                      </label>
                      <select
                        id={`move-${asset.id}`}
                        aria-label={`Move ${label}`}
                        value={asset.folderId ?? '__root__'}
                        onChange={(event) => void moveAsset(asset, event.target.value === '__root__' ? null : event.target.value)}
                        className="min-h-9 rounded-lg border border-border-input bg-bg-card px-2 text-[12px] text-text-base outline-none"
                      >
                        <option value="__root__">资产库根目录</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Trash ${label}`}
                        onClick={() => void trashAsset(asset)}
                        className="inline-flex h-9 w-10 items-center justify-center rounded-lg border border-border-input bg-bg-card text-text-secondary transition-colors hover:border-border-primary hover:text-semantic-negative"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
