import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Folder, Image, Loader2, Music, Search, Video, X } from 'lucide-react'

import type { AssetCategory, AssetFolder, AssetListRequest, AssetRecord } from '../../../../../../shared/assets'
import type { AssetLibraryApi } from '../../assets/AssetPanel'
import { assetDisplayUrl } from '../../assets/asset-url'
import { cn } from '../../lib/cn'

export type CanvasAssetInsertMode = 'image' | 'video' | 'audio' | 'character' | 'scene' | 'reference'

export interface CanvasAssetPanelProps {
  open: boolean
  onClose: () => void
  onInsertAsset: (asset: { id: string; url: string; type: 'image' | 'video' | 'audio'; name: string; mode?: CanvasAssetInsertMode }) => void
}

type MediaTab = 'all' | 'image' | 'video' | 'audio'
type LoadState = 'loading' | 'ready' | 'error'

interface FolderNode {
  folder: AssetFolder
  depth: number
}

const MEDIA_TABS: { key: MediaTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' }
]

const IMAGE_INSERT_MODES: { key: CanvasAssetInsertMode; label: string }[] = [
  { key: 'image', label: '图片' },
  { key: 'character', label: '角色' },
  { key: 'scene', label: '场景' },
  { key: 'reference', label: '引用' }
]

function defaultApi(): AssetLibraryApi {
  return window.comicCanvas
}

function flattenFolders(folders: AssetFolder[], parentId: string | null = null, depth = 0): FolderNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((folder) => [{ folder, depth }, ...flattenFolders(folders, folder.id, depth + 1)])
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
  if (asset.displayName) return asset.displayName
  const dimensions =
    asset.metadata.width && asset.metadata.height ? ` ${asset.metadata.width}x${asset.metadata.height}` : ''
  return `${titleize(basename(asset.relativePath))}${dimensions}`
}

function assetDisplayName(asset: AssetRecord): string {
  return asset.displayName ?? basename(asset.relativePath) ?? asset.id
}

function toInsertType(mediaType: AssetRecord['mediaType']): 'image' | 'video' | 'audio' {
  if (mediaType === 'audio') return 'audio'
  return mediaType === 'video' ? 'video' : 'image'
}

/**
 * Floating asset library panel embedded inside the canvas workspace.
 * Supports debounced keyword search, media type filtering, folder navigation,
 * and click-to-insert behaviour for canvas nodes.
 * @param props - Panel visibility, close callback, and asset insertion callback.
 * @returns Floating canvas asset panel.
 */
export function CanvasAssetPanel({ open, onClose, onInsertAsset }: CanvasAssetPanelProps): JSX.Element | null {
  const api = useMemo<AssetLibraryApi>(() => defaultApi(), [])
  const [folders, setFolders] = useState<AssetFolder[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [mediaTab, setMediaTab] = useState<MediaTab>('all')
  const [insertMode, setInsertMode] = useState<CanvasAssetInsertMode>('image')
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [folderState, setFolderState] = useState<LoadState>('loading')
  const [assetState, setAssetState] = useState<LoadState>('loading')
  const [showFolders, setShowFolders] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const orderedFolders = useMemo(() => flattenFolders(folders), [folders])

  // Debounce keyword input for search.
  useEffect(() => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedKeyword(keyword)
    }, 300)

    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [keyword])

  // Load folder tree on mount.
  useEffect(() => {
    if (!open) {
      return
    }

    async function loadFolders(): Promise<void> {
      setFolderState('loading')
      try {
        const [folderItems, categoryItems] = await Promise.all([
          api.getAssetFolders(),
          api.getAssetCategories()
        ])
        setFolders(folderItems)
        setCategories(categoryItems)
        setFolderState('ready')
      } catch {
        setFolderState('error')
      }
    }

    void loadFolders()
  }, [api, open])

  // Load assets whenever filter inputs change.
  const loadAssets = useCallback(async () => {
    setAssetState('loading')
    try {
      const request: AssetListRequest = {}
      if (selectedFolderId) {
        request.folderId = selectedFolderId
      }
      if (mediaTab !== 'all') {
        request.mediaType = mediaTab
      }
      if (selectedCategoryId) {
        request.categoryId = selectedCategoryId
      }
      if (debouncedKeyword.trim()) {
        request.keyword = debouncedKeyword.trim()
      }
      const items = await api.listAssets(request)
      setAssets(items)
      setAssetState('ready')
    } catch {
      setAssetState('error')
    }
  }, [api, selectedFolderId, selectedCategoryId, mediaTab, debouncedKeyword])

  useEffect(() => {
    if (!open) {
      return
    }
    void loadAssets()
  }, [open, loadAssets])

  if (!open) {
    return null
  }

  function handleInsert(asset: AssetRecord): void {
    const mode = asset.mediaType === 'image' ? insertMode : toInsertType(asset.mediaType)
    onInsertAsset({
      id: asset.id,
      url: assetDisplayUrl(asset),
      type: toInsertType(asset.mediaType),
      name: assetDisplayName(asset),
      mode
    })
  }

  return (
    <div
      className="nopan nodrag nowheel pointer-events-auto absolute right-0 top-0 z-30 flex h-full w-[320px] flex-col border-l border-border-primary bg-bg-panel text-text-base shadow-pop"
      aria-label="画布资产库面板"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-secondary px-3 py-2.5">
        <h2 className="text-[14px] font-semibold text-text-base">资产库</h2>
        <button
          type="button"
          aria-label="关闭资产面板"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-input hover:text-text-base"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            aria-label="搜索资产"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索资产..."
            className="min-h-8 w-full rounded-md border border-border-input bg-bg-input py-1.5 pl-8 pr-3 text-[13px] text-text-base outline-none transition-colors placeholder:text-text-muted focus:border-border-primary focus:shadow-card"
          />
        </div>
      </div>

      {/* Media tabs */}
      <div className="flex gap-1 px-3 pt-2.5">
        {MEDIA_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMediaTab(tab.key)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
              mediaTab === tab.key
                ? 'bg-brand text-bg-base'
                : 'text-text-secondary hover:bg-bg-input hover:text-text-base'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-3 pt-2.5">
        <div className="flex gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCategoryId(null)}
            className={cn(
              'shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
              selectedCategoryId === null
                ? 'bg-bg-input text-text-base'
                : 'text-text-secondary hover:bg-bg-input hover:text-text-base'
            )}
          >
            全部分类
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-label={`分类 ${category.name}`}
              onClick={() => {
                setSelectedCategoryId(category.id)
                setMediaTab('image')
              }}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                selectedCategoryId === category.id
                  ? 'bg-brand text-bg-base'
                  : 'text-text-secondary hover:bg-bg-input hover:text-text-base'
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {mediaTab === 'image' && (
        <div className="px-3 pt-2.5">
          <div className="grid grid-cols-4 gap-1 rounded-md border border-border-secondary bg-bg-card p-1">
            {IMAGE_INSERT_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setInsertMode(mode.key)}
                aria-label={`插入为${mode.label}`}
                className={cn(
                  'rounded px-1.5 py-1 text-[11px] font-medium transition-colors',
                  insertMode === mode.key
                    ? 'bg-brand text-bg-base'
                    : 'text-text-secondary hover:bg-bg-input hover:text-text-base'
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Folder toggle */}
      <div className="px-3 pt-2.5">
        <button
          type="button"
          onClick={() => setShowFolders((current) => !current)}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-input"
        >
          <span className="flex items-center gap-1.5">
            <Folder className="h-3.5 w-3.5 text-brand" />
            {selectedFolderId
              ? folders.find((folder) => folder.id === selectedFolderId)?.name ?? '文件夹'
              : '全部文件夹'}
          </span>
          <span className="text-text-muted">{showFolders ? '收起' : '展开'}</span>
        </button>

        {showFolders && (
          <div className="mt-1 max-h-[140px] overflow-y-auto rounded-lg border border-border-secondary bg-bg-card p-1 shadow-card">
            {folderState === 'loading' && (
              <p className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                加载中...
              </p>
            )}
            {folderState === 'error' && (
              <p className="px-2 py-1.5 text-[12px] text-semantic-negative">文件夹加载失败</p>
            )}
            {folderState === 'ready' && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[12px] transition-colors',
                    selectedFolderId === null
                      ? 'bg-bg-input font-medium text-text-base'
                      : 'text-text-secondary hover:bg-bg-input'
                  )}
                >
                  <Folder className="h-3 w-3 shrink-0 text-brand" />
                  根目录
                </button>
                {orderedFolders.map(({ folder, depth }) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={cn(
                      'flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-[12px] transition-colors',
                      selectedFolderId === folder.id
                        ? 'bg-bg-input font-medium text-text-base'
                        : 'text-text-secondary hover:bg-bg-input'
                    )}
                    style={{ paddingLeft: `${8 + depth * 12}px` }}
                  >
                    <Folder className="h-3 w-3 shrink-0 text-brand" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Asset grid */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2.5">
        {assetState === 'loading' && (
          <div className="flex flex-1 items-center justify-center">
            <p className="flex items-center gap-1.5 text-[12px] text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              加载中...
            </p>
          </div>
        )}

        {assetState === 'error' && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[12px] text-semantic-negative">资产加载失败</p>
          </div>
        )}

        {assetState === 'ready' && assets.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <Image className="h-6 w-6 text-text-muted" />
            <p className="text-[12px] text-text-secondary">暂无资产</p>
          </div>
        )}

        {assetState === 'ready' && assets.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((asset) => {
              const label = assetLabel(asset)
              const displayName = assetDisplayName(asset)

              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleInsert(asset)}
                  aria-label={`插入资产 ${displayName}`}
                  className="group flex flex-col gap-1.5 rounded-lg border border-border-secondary bg-bg-card p-2 text-left shadow-card transition-all duration-200 ease-luxury hover:border-border-primary hover:bg-bg-hover hover:shadow-float"
                >
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border-input bg-bg-input">
                    {asset.mediaType === 'image' ? (
                      <img
                        src={assetDisplayUrl(asset)}
                        alt={label}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : asset.mediaType === 'video' ? (
                      <Video className="h-6 w-6 text-text-muted" />
                    ) : asset.mediaType === 'audio' ? (
                      <Music className="h-6 w-6 text-text-muted" />
                    ) : (
                      <Image className="h-6 w-6 text-text-muted" />
                    )}
                  </div>
                  <span className="block truncate text-[11px] font-medium text-text-base">{displayName}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer count */}
      <div className="border-t border-border-secondary px-3 py-2">
        <p className="text-[11px] text-text-muted">{assets.length} 个资产</p>
      </div>
    </div>
  )
}
