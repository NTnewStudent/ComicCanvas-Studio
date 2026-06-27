import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Archive,
  Folder,
  FolderPlus,
  Grid3X3,
  LayoutList,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import type {
  AssetCategory,
  AssetCategoryUpdateRequest,
  AssetFolder,
  AssetFolderCreateRequest,
  AssetFolderDeleteRequest,
  AssetFolderDeleteResponse,
  AssetImportRequest,
  AssetListRequest,
  AssetMediaType,
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
  listAssets: (input?: AssetListRequest) => Promise<AssetRecord[]>
  importAsset: (input: AssetImportRequest) => Promise<AssetRecord>
  getAssetFolders: () => Promise<AssetFolder[]>
  createAssetFolder: (input: AssetFolderCreateRequest) => Promise<AssetFolder>
  moveAsset: (input: AssetMoveRequest) => Promise<AssetRecord>
  renameAsset: (input: { assetId: string; displayName: string }) => Promise<AssetRecord>
  trashAsset: (input: AssetTrashRequest) => Promise<AssetTrashResponse>
  deleteAssetFolder: (input: AssetFolderDeleteRequest) => Promise<AssetFolderDeleteResponse>
  getAssetCategories: (input?: { includeDisabled?: boolean }) => Promise<AssetCategory[]>
  createAssetCategory: (input: { name: string; color?: string; icon?: string; sortOrder?: number }) => Promise<AssetCategory>
  updateAssetCategory: (input: AssetCategoryUpdateRequest) => Promise<AssetCategory>
  assignAssetCategory: (input: { assetId: string; categoryId: string }) => Promise<{ assetId: string; categoryId: string; assigned: true }>
  removeAssetCategory: (input: { assetId: string; categoryId: string }) => Promise<{ assetId: string; categoryId: string; removed: true }>
}

export interface AssetPanelProps {
  api?: AssetLibraryApi
}

type LoadState = 'loading' | 'ready' | 'error'
type ViewMode = 'grid' | 'list'
type AssetTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'character'
type DateFilter = 'all' | 'today' | '7d' | '30d'

interface UploadState {
  busy: boolean
  done: number
  total: number
  currentName: string | null
  failedName: string | null
}

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
  if (asset.displayName) return asset.displayName
  const dimensions =
    asset.metadata.width && asset.metadata.height ? ` ${asset.metadata.width}x${asset.metadata.height}` : ''
  return `${titleize(basename(asset.relativePath))}${dimensions}`
}

function inferMediaTypeFromFile(file: File): AssetMediaType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('text/')) return 'text'
  if (file.type === 'application/pdf') return 'document'

  const name = file.name.toLowerCase()
  if (/\.(png|jpe?g|webp|gif|bmp|svg)$/u.test(name)) return 'image'
  if (/\.(mp4|webm|mov|avi|mkv)$/u.test(name)) return 'video'
  if (/\.(mp3|wav|m4a|aac|flac|ogg)$/u.test(name)) return 'audio'
  if (/\.(txt|md|json|csv)$/u.test(name)) return 'text'
  if (/\.(pdf|docx?)$/u.test(name)) return 'document'
  return 'other'
}

function fileSourcePath(file: File): string | null {
  const fileWithPath = file as File & { path?: unknown }
  return typeof fileWithPath.path === 'string' && fileWithPath.path.length > 0 ? fileWithPath.path : null
}

function folderName(folders: AssetFolder[], folderId: string | null): string {
  if (!folderId) return '全部资产'
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

/** Formats byte count into human-readable size. */
function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDuration(durationMs?: number): string {
  if (!durationMs) return ''
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`
}

/** Filter tab definitions */
const MEDIA_FILTER_TABS: { key: AssetTypeFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'character', label: '角色' },
]

/** Media type icon mapping for non-image assets */
const MEDIA_TYPE_ICONS: Record<AssetMediaType, string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎧',
  text: '📄',
  document: '📋',
  other: '📦',
}

function parseAssetTypeFilter(value: string | null): AssetTypeFilter {
  return value === 'image' || value === 'video' || value === 'audio' || value === 'character'
    ? value
    : 'all'
}

function parseDateFilter(value: string | null): DateFilter {
  return value === 'today' || value === '7d' || value === '30d' ? value : 'all'
}

function matchesDateFilter(asset: AssetRecord, dateFilter: DateFilter, now = Date.now()): boolean {
  if (dateFilter === 'all') return true

  const dayMs = 24 * 60 * 60 * 1000
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const threshold =
    dateFilter === 'today'
      ? startOfToday.getTime()
      : now - (dateFilter === '7d' ? 7 : 30) * dayMs

  return asset.createdAt >= threshold
}

/**
 * Renders the local asset library with hjwall-inspired layout:
 * top capsule filter bar + left folder tree + right asset grid.
 * @param props - Optional API override for component tests.
 * @returns Asset library management panel.
 * @see docs/api-contracts/assets-files.md
 */
export function AssetPanel({ api = defaultApi() }: AssetPanelProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [folders, setFolders] = useState<AssetFolder[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryColorDraft, setCategoryColorDraft] = useState('#22c55e')
  const [categoryIconDraft, setCategoryIconDraft] = useState('image')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [assetState, setAssetState] = useState<LoadState>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchKeyword, setSearchKeyword] = useState(() => searchParams.get('q') ?? '')
  const [mediaFilter, setMediaFilter] = useState<AssetTypeFilter>(() => parseAssetTypeFilter(searchParams.get('type')))
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => parseDateFilter(searchParams.get('date')))
  const [sortDesc, setSortDesc] = useState(() => searchParams.get('sort') !== 'oldest')
  const [previewAsset, setPreviewAsset] = useState<AssetRecord | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [categoryDraftIds, setCategoryDraftIds] = useState<string[]>([])
  const [batchMode, setBatchMode] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [uploadState, setUploadState] = useState<UploadState>({
    busy: false,
    done: 0,
    total: 0,
    currentName: null,
    failedName: null,
  })

  const orderedFolders = useMemo(() => flattenFolders(folders), [folders])
  const selectedFolder = selectedFolderId
    ? folders.find((folder) => folder.id === selectedFolderId) ?? null
    : null
  const selectedCategory = selectedCategoryId
    ? categories.find((category) => category.id === selectedCategoryId) ?? null
    : null
  const selectedAssetIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds])

  const typeCounts = useMemo(() => ({
    all: assets.length,
    image: assets.filter((asset) => asset.mediaType === 'image').length,
    video: assets.filter((asset) => asset.mediaType === 'video').length,
    audio: assets.filter((asset) => asset.mediaType === 'audio').length,
    character: assets.filter((asset) => asset.mediaType === 'image' && asset.categoryIds?.includes('category-role')).length,
  }), [assets])

  const filteredAssets = useMemo(() => {
    let result = assets
    if (mediaFilter === 'character') {
      result = result.filter((a) => a.mediaType === 'image' && a.categoryIds?.includes('category-role'))
    } else if (mediaFilter !== 'all') {
      result = result.filter((a) => a.mediaType === mediaFilter)
    }
    result = result.filter((a) => matchesDateFilter(a, dateFilter))
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase()
      result = result.filter(
        (a) => a.id.toLowerCase().includes(kw) || a.relativePath.toLowerCase().includes(kw),
      )
    }
    return [...result].sort((a, b) =>
      sortDesc ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
    )
  }, [assets, dateFilter, mediaFilter, searchKeyword, sortDesc])

  useEffect(() => {
    const next = new URLSearchParams()
    if (mediaFilter !== 'all') next.set('type', mediaFilter)
    const keyword = searchKeyword.trim()
    if (keyword) next.set('q', keyword)
    if (!sortDesc) next.set('sort', 'oldest')
    if (dateFilter !== 'all') next.set('date', dateFilter)
    setSearchParams(next, { replace: true })
  }, [dateFilter, mediaFilter, searchKeyword, setSearchParams, sortDesc])

  useEffect(() => {
    async function loadLibraryNavigation(): Promise<void> {
      setLoadState('loading')
      try {
        const [folderItems, categoryItems] = await Promise.all([
          api.getAssetFolders(),
          api.getAssetCategories()
        ])
        setFolders(folderItems)
        setCategories(categoryItems)
        setLoadState('ready')
      } catch {
        // Folder load failures stay local so the rest of the renderer remains usable.
        setLoadState('error')
        setMessage('资产文件夹加载失败。')
      }
    }
    void loadLibraryNavigation()
  }, [api])

  useEffect(() => {
    setRenameDraft(previewAsset ? assetLabel(previewAsset) : '')
    setCategoryDraftIds(previewAsset?.categoryIds ?? [])
  }, [previewAsset])

  useEffect(() => {
    if (!selectedCategory) return
    setCategoryColorDraft(selectedCategory.color)
    setCategoryIconDraft(selectedCategory.icon)
  }, [selectedCategory])

  useEffect(() => {
    async function loadAssets(): Promise<void> {
      setAssetState('loading')
      try {
        const request: AssetListRequest = {
          ...(selectedFolderId ? { folderId: selectedFolderId } : {}),
          ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {})
        }
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
  }, [api, selectedFolderId, selectedCategoryId])

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

  async function createCategory(): Promise<void> {
    const name = newCategoryName.trim()
    if (!name) {
      setMessage('分类名称为必填项。')
      return
    }
    try {
      const created = await api.createAssetCategory({ name, color: '#22c55e', icon: 'image', sortOrder: 100 + categories.length })
      setCategories((current) => [...current, created])
      setSelectedCategoryId(created.id)
      setNewCategoryName('')
      setMessage(`已创建分类 ${created.name}`)
    } catch {
      // Category creation failures are recoverable and should keep the typed name visible.
      setMessage('分类创建失败。')
    }
  }

  async function saveSelectedCategory(): Promise<void> {
    if (!selectedCategory) return

    try {
      const updated = await api.updateAssetCategory({
        categoryId: selectedCategory.id,
        color: categoryColorDraft,
        icon: categoryIconDraft,
      })
      setCategories((current) => current.map((category) => (category.id === updated.id ? updated : category)))
      setMessage(`已更新分类 ${updated.name}`)
    } catch {
      // Category setting changes are recoverable and should keep the current draft visible.
      setMessage('分类设置保存失败。')
    }
  }

  async function deleteSelectedCategory(): Promise<void> {
    if (!selectedCategory || selectedCategory.builtIn) return

    try {
      const deleted = await api.updateAssetCategory({ categoryId: selectedCategory.id, enabled: false })
      setCategories((current) => current.filter((category) => category.id !== deleted.id))
      setSelectedCategoryId(null)
      setMessage(`已删除分类 ${deleted.name}`)
    } catch {
      // Category delete is modeled as disabling the category so failed updates are retryable.
      setMessage('分类删除失败。')
    }
  }

  async function importSelectedFiles(files: File[]): Promise<void> {
    if (files.length === 0) return

    setUploadState({
      busy: true,
      done: 0,
      total: files.length,
      currentName: files[0]?.name ?? null,
      failedName: null,
    })

    const imported: AssetRecord[] = []
    let failedName: string | null = null

    for (const [index, file] of files.entries()) {
      setUploadState({
        busy: true,
        done: index,
        total: files.length,
        currentName: file.name,
        failedName,
      })

      const sourcePath = fileSourcePath(file)
      if (!sourcePath) {
        failedName = file.name
        continue
      }

      try {
        const asset = await api.importAsset({
          sourcePath,
          mediaType: inferMediaTypeFromFile(file),
          ...(selectedFolderId ? { folderId: selectedFolderId } : {}),
          ...(selectedCategoryId ? { categoryIds: [selectedCategoryId] } : {}),
        })
        imported.push(asset)
      } catch {
        // Import failures are per-file so a batch can still finish remaining files.
        failedName = file.name
      }
    }

    if (imported.length > 0) {
      setAssets((current) => [...imported, ...current])
    }

    setUploadState({
      busy: false,
      done: files.length,
      total: files.length,
      currentName: null,
      failedName,
    })
    setMessage(failedName ? `导入完成，${failedName} 失败。` : `已导入 ${imported.length} 个资产`)
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

  async function renamePreviewAsset(): Promise<void> {
    if (!previewAsset) return
    const displayName = renameDraft.trim()
    if (!displayName) {
      setMessage('资产名称为必填项。')
      return
    }

    try {
      const renamed = await api.renameAsset({ assetId: previewAsset.id, displayName })
      setAssets((current) => current.map((item) => (item.id === renamed.id ? renamed : item)))
      setPreviewAsset(renamed)
      setMessage(`已重命名为 ${renamed.displayName ?? displayName}`)
    } catch {
      // Rename failures should keep the preview open so users can retry with the same draft.
      setMessage('资产重命名失败。')
    }
  }

  function togglePreviewCategory(categoryId: string): void {
    setCategoryDraftIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    )
  }

  async function savePreviewCategories(): Promise<void> {
    if (!previewAsset) return

    const currentIds = new Set(previewAsset.categoryIds ?? [])
    const draftIds = new Set(categoryDraftIds)
    const addedIds = categoryDraftIds.filter((categoryId) => !currentIds.has(categoryId))
    const removedIds = [...currentIds].filter((categoryId) => !draftIds.has(categoryId))

    try {
      await Promise.all([
        ...addedIds.map((categoryId) => api.assignAssetCategory({ assetId: previewAsset.id, categoryId })),
        ...removedIds.map((categoryId) => api.removeAssetCategory({ assetId: previewAsset.id, categoryId })),
      ])

      const updatedAsset: AssetRecord = { ...previewAsset, categoryIds: categoryDraftIds }
      setAssets((current) => current.map((item) => (item.id === updatedAsset.id ? updatedAsset : item)))
      setPreviewAsset(updatedAsset)
      setMessage('已更新资产分类')
    } catch {
      // Category assignment failures keep the preview open so the user can retry the same draft.
      setMessage('资产分类更新失败。')
    }
  }

  function openPreview(asset: AssetRecord): void {
    setPreviewAsset(asset)
    setRenameDraft(assetLabel(asset))
    setCategoryDraftIds(asset.categoryIds ?? [])
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

  function toggleBatchMode(): void {
    setBatchMode((current) => {
      if (current) {
        setSelectedAssetIds([])
      }
      return !current
    })
  }

  function toggleAssetSelection(assetId: string): void {
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    )
  }

  async function trashSelectedAssets(): Promise<void> {
    if (selectedAssetIds.length === 0) return
    if (!window.confirm(`确定回收 ${selectedAssetIds.length} 个资产？`)) return

    const ids = [...selectedAssetIds]
    const trashedIds: string[] = []
    try {
      for (const assetId of ids) {
        const result = await api.trashAsset({ assetId, mode: 'safe' })
        if (result.status !== 'rejected') {
          trashedIds.push(assetId)
        }
      }
      if (trashedIds.length > 0) {
        const removed = new Set(trashedIds)
        setAssets((current) => current.filter((asset) => !removed.has(asset.id)))
      }
      setSelectedAssetIds([])
      setBatchMode(false)
      setMessage(trashedIds.length === ids.length ? `已回收 ${trashedIds.length} 个资产` : `已回收 ${trashedIds.length} 个资产，部分资产仍被引用。`)
    } catch {
      // Batch deletion must stop visibly when any safe delete call fails.
      setMessage('批量回收失败。')
    }
  }

  async function deleteSelectedFolder(): Promise<void> {
    if (!selectedFolder) return
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
      {/* ── 顶部筛选栏：胶囊类型标签 + 搜索 + 排序（对齐 hjwall AssetFilterBar） ── */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* 左侧：胶囊类型标签 */}
        <div className="flex items-center gap-1 rounded-pill border border-border-secondary bg-bg-card p-1.5">
          {MEDIA_FILTER_TABS.map((tab) => {
            const active = mediaFilter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                  onClick={() => setMediaFilter(tab.key)}
                className={cn(
                  'rounded-pill px-4 py-1.5 text-[13px] font-bold transition',
                  active
                    ? 'bg-brand text-bg-base shadow-md'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
                )}
              >
                <span>{tab.label}</span>
                <span className={cn('ml-1 text-[11px]', active ? 'text-bg-base/80' : 'text-text-muted')}>
                  {typeCounts[tab.key]}
                </span>
              </button>
            )
          })}
        </div>

        {/* 右侧：搜索 + 视图切换 + 排序 */}
        <div className="flex items-center gap-2">
          <input
            ref={uploadInputRef}
            aria-label="选择资产文件"
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? [])
              event.currentTarget.value = ''
              void importSelectedFiles(files)
            }}
          />
          <button
            type="button"
            disabled={uploadState.busy}
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-secondary bg-bg-card px-3.5 text-[13px] font-bold text-text-secondary transition hover:bg-bg-hover hover:text-text-base disabled:cursor-wait disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadState.busy ? '导入中' : '上传'}
          </button>

          {/* 搜索栏 */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              aria-label="搜索资产"
              placeholder="搜索资产…"
              className="h-8 w-48 rounded-lg border border-border-secondary bg-bg-input pl-8 pr-3 text-[13px] text-text-base placeholder:text-text-muted focus:border-border-primary focus:outline-none"
            />
          </div>

          <select
            aria-label="日期筛选"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value as DateFilter)}
            className="h-8 rounded-lg border border-border-secondary bg-bg-card px-2.5 text-[13px] font-bold text-text-secondary outline-none transition hover:bg-bg-hover hover:text-text-base"
          >
            <option value="all">全部日期</option>
            <option value="today">今天</option>
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
          </select>

          {/* 视图切换 */}
          <div className="flex items-center rounded-lg border border-border-secondary bg-bg-card p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="网格视图"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-bg-hover text-text-base'
                  : 'text-text-muted hover:text-text-secondary',
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
                viewMode === 'list'
                  ? 'bg-bg-hover text-text-base'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 排序 */}
          <button
            type="button"
            onClick={() => setSortDesc((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-pill border border-border-secondary bg-bg-card px-3.5 py-1.5 text-[13px] font-bold text-text-secondary transition hover:bg-bg-hover hover:text-text-base"
          >
            <span>{sortDesc ? '最新优先' : '最早优先'}</span>
            <span className="text-xs">⇅</span>
          </button>
        </div>
      </div>

      {/* 状态消息条 */}
      {message && (
        <div className="border-b border-border-secondary px-5 py-2">
          <span className="inline-flex max-w-max rounded-pill border border-border-secondary bg-bg-card px-3 py-1 text-[12px] text-text-secondary">
            {message}
          </span>
        </div>
      )}

      {uploadState.total > 0 && (
        <div className="border-b border-border-secondary px-5 py-2">
          <div className="flex items-center justify-between gap-3 text-[12px] text-text-secondary">
            <span className="truncate">
              {uploadState.busy && uploadState.currentName
                ? `正在导入 ${uploadState.done + 1}/${uploadState.total}: ${uploadState.currentName}`
                : `导入完成 ${uploadState.done}/${uploadState.total}`}
            </span>
            <span className="shrink-0">
              {Math.round((uploadState.done / Math.max(uploadState.total, 1)) * 100)}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-bg-hover">
            <div
              className="h-full rounded-pill bg-brand transition-all"
              style={{ width: `${(uploadState.done / Math.max(uploadState.total, 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── 主体：左侧文件夹树 + 右侧资产网格（对齐 hjwall 布局） ── */}
      <div className="flex min-h-0 flex-1">
        {/* 左侧文件夹树 */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border-secondary bg-bg-surface">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[12px] font-bold uppercase tracking-wider text-text-muted">
              文件夹
            </span>
            <span className="rounded-pill bg-bg-hover px-1.5 py-0.5 text-[11px] text-text-muted">
              {folders.length}
            </span>
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

          <div className="border-t border-border-secondary px-2 py-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[12px] font-bold uppercase tracking-wider text-text-muted">
                图片分类
              </span>
              <span className="rounded-pill bg-bg-hover px-1.5 py-0.5 text-[11px] text-text-muted">
                {categories.length}
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[12px] font-medium transition-colors',
                  selectedCategoryId === null
                    ? 'bg-bg-hover text-text-base'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
                )}
              >
                全部分类
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-label={`分类 ${category.name}`}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[12px] font-medium transition-colors',
                    selectedCategoryId === category.id
                      ? 'bg-bg-hover text-text-base'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="truncate">{category.name}</span>
                  {category.builtIn && (
                    <span className="ml-auto rounded-pill border border-border-secondary px-1.5 py-0.5 text-[10px] text-text-muted">
                      内置
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2 px-1">
              <input
                aria-label="新分类名称"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-border-secondary bg-bg-input px-2.5 text-[12px] text-text-base placeholder:text-text-muted focus:border-border-primary focus:outline-none"
                placeholder="分类名称"
              />
              <button
                type="button"
                onClick={() => void createCategory()}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-brand px-2.5 text-[12px] font-semibold text-bg-base transition-colors hover:bg-brand-hover"
              >
                添加
              </button>
            </div>
            {selectedCategory && (
              <div className="mt-2 space-y-2 rounded-lg border border-border-secondary bg-bg-card p-2">
                <div className="flex items-center gap-2">
                  <input
                    aria-label="分类颜色"
                    value={categoryColorDraft}
                    onChange={(event) => setCategoryColorDraft(event.target.value)}
                    disabled={selectedCategory.builtIn}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border-secondary bg-bg-input px-2.5 text-[12px] text-text-base placeholder:text-text-muted focus:border-border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <select
                    aria-label="分类图标"
                    value={categoryIconDraft}
                    onChange={(event) => setCategoryIconDraft(event.target.value)}
                    disabled={selectedCategory.builtIn}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border-secondary bg-bg-input px-2 text-[12px] text-text-base outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="image">image</option>
                    <option value="user-round">user-round</option>
                    <option value="landmark">landmark</option>
                    <option value="package">package</option>
                    <option value="sparkles">sparkles</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void saveSelectedCategory()}
                    disabled={selectedCategory.builtIn}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-border-secondary bg-bg-card px-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-base disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    保存分类设置
                  </button>
                  <button
                    type="button"
                    aria-label={`删除分类 ${selectedCategory.name}`}
                    onClick={() => void deleteSelectedCategory()}
                    disabled={selectedCategory.builtIn}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-semantic-negative/40 bg-bg-card px-2 text-[12px] font-semibold text-semantic-negative transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    删除分类
                  </button>
                </div>
              </div>
            )}
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {/* 当前文件夹标题 + 资产计数 */}
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-[14px] font-semibold text-text-base">
              {folderName(folders, selectedFolderId)}
            </h2>
            <div className="flex items-center gap-2">
              {batchMode && (
                <button
                  type="button"
                  disabled={selectedAssetIds.length === 0}
                  onClick={() => void trashSelectedAssets()}
                  className="inline-flex h-7 items-center justify-center rounded-pill border border-semantic-negative/40 bg-bg-card px-3 text-[12px] font-semibold text-semantic-negative transition hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-45"
                >
                  删除 {selectedAssetIds.length} 项
                </button>
              )}
              <button
                type="button"
                onClick={toggleBatchMode}
                className={cn(
                  'inline-flex h-7 items-center justify-center rounded-pill border px-3 text-[12px] font-semibold transition',
                  batchMode
                    ? 'border-border-primary bg-bg-hover text-text-base'
                    : 'border-border-secondary bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-base',
                )}
              >
                {batchMode ? '退出批量' : '批量'}
              </button>
              <div className="inline-flex items-center gap-1.5 rounded-pill border border-border-secondary bg-bg-card px-2.5 py-0.5 text-[12px] text-text-muted">
                <Archive className="h-3.5 w-3.5" />
                {filteredAssets.length} 个资产
              </div>
            </div>
          </div>

          {/* 加载态：骨架屏 */}
          {assetState === 'loading' && (
            <div className="grid grid-cols-2 gap-4 px-4 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="cc-skeleton aspect-square w-full rounded-xl" style={{ animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          )}

          {/* 错误态 */}
          {assetState === 'error' && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[13px] text-semantic-negative">资产加载失败。</p>
            </div>
          )}

          {/* 空状态（对齐 hjwall AssetGrid 空状态） */}
          {assetState === 'ready' && filteredAssets.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center py-20 text-text-muted cc-anim-fade-in">
              <span className="mb-2 text-4xl">📁</span>
              <p className="text-sm">
                {searchKeyword ? '未找到匹配的资产' : '暂无资产'}
              </p>
              <p className="text-xs">
                {searchKeyword ? '请尝试其他搜索关键词' : '在左侧创建文件夹后导入资产'}
              </p>
            </div>
          )}

          {/* ── 网格视图（对齐 hjwall AssetGrid 样式） ── */}
          {assetState === 'ready' && filteredAssets.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 gap-4 px-4 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredAssets.map((asset, idx) => {
                const label = assetLabel(asset)
                return (
                  <article
                    key={asset.id}
                    onClick={() => {
                      if (batchMode) {
                        toggleAssetSelection(asset.id)
                        return
                      }
                      openPreview(asset)
                    }}
                    className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl border border-transparent transition-all duration-200 ease-luxury cc-anim-fade-in-up hover:border-brand/30 hover:shadow-float hover:ring-1 hover:ring-white/20"
                    style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                  >
                    {batchMode && (
                      <input
                        type="checkbox"
                        aria-label={`选择 ${label}`}
                        checked={selectedAssetIdSet.has(asset.id)}
                        onChange={() => toggleAssetSelection(asset.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="absolute left-2 top-2 z-30 h-4 w-4 accent-brand"
                      />
                    )}

                    {/* 缩略图 */}
                    <div className="relative z-0 h-full w-full overflow-hidden">
                      {asset.mediaType === 'image' ? (
                        <img
                          src={asset.safeUrl}
                          alt={label}
                          className="h-full w-full object-cover transition-transform duration-300 ease-luxury group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-bg-elevated transition-transform duration-300 ease-luxury group-hover:scale-105">
                          <span className="text-4xl">
                            {MEDIA_TYPE_ICONS[asset.mediaType] ?? MEDIA_TYPE_ICONS.other}
                          </span>
                          {asset.mediaType === 'video' && (
                            <span className="mt-2 text-xs text-text-muted">视频</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hover 遮罩 — 文件名 + 大小（对齐 hjwall AssetCard 底部滑入） */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-full bg-gradient-to-t from-black/80 to-transparent p-3 transition-all duration-300 ease-luxury group-hover:translate-y-0">
                      <p className="truncate text-xs font-normal text-white">{asset.id}</p>
                      <p className="text-[12px] text-white/70">
                        {formatFileSize(asset.metadata.sizeBytes)}
                      </p>
                    </div>

                    {/* Hover 操作按钮（对齐 hjwall AssetCard 右上操作区） */}
                    <div className="absolute right-2 top-2 z-20 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`回收 ${label}`}
                        disabled={batchMode}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`确定回收「${asset.id}」？`)) {
                            void trashAsset(asset)
                          }
                        }}
                        className="rounded-md bg-black/60 p-1.5 text-semantic-negative transition hover:bg-black/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* 移动下拉（底部，hover 时可见） */}
                    <div className="absolute inset-x-0 bottom-0 z-20 hidden group-hover:block">
                      <div className="translate-y-full bg-black/70 p-2 transition-all duration-300 ease-luxury group-hover:translate-y-0">
                        <select
                          aria-label={`移动 ${label}`}
                          value={asset.folderId ?? '__root__'}
                          onChange={(event) =>
                            void moveAsset(
                              asset,
                              event.target.value === '__root__' ? null : event.target.value,
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
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

          {/* ── 列表视图 ── */}
          {assetState === 'ready' && filteredAssets.length > 0 && viewMode === 'list' && (
            <div className="flex flex-col gap-1 px-4 pb-4">
              {filteredAssets.map((asset) => {
                const label = assetLabel(asset)
                return (
                  <div
                    key={asset.id}
                    onClick={() => openPreview(asset)}
                    className="group flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-all duration-200 ease-luxury hover:border-border-secondary hover:bg-bg-card hover:shadow-sm"
                  >
                    {/* 缩略图 */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-secondary bg-bg-input">
                      {asset.mediaType === 'image' ? (
                        <img src={asset.safeUrl} alt={label} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg">
                          {MEDIA_TYPE_ICONS[asset.mediaType] ?? MEDIA_TYPE_ICONS.other}
                        </span>
                      )}
                    </div>

                    {/* 名称 */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text-base">{asset.id}</p>
                      <p className="truncate text-[11px] text-text-muted">{label}</p>
                    </div>

                    {/* 大小 */}
                    <span className="shrink-0 text-[12px] text-text-muted">
                      {formatFileSize(asset.metadata.sizeBytes)}
                    </span>

                    {/* 时间 */}
                    <span className="shrink-0 text-[12px] text-text-muted">
                      {formatDate(asset.createdAt)}
                    </span>

                    {/* 移动 */}
                    <select
                      aria-label={`移动 ${label}`}
                      value={asset.folderId ?? '__root__'}
                      onChange={(event) => {
                        event.stopPropagation()
                        void moveAsset(
                          asset,
                          event.target.value === '__root__' ? null : event.target.value,
                        )
                      }}
                      onClick={(e) => e.stopPropagation()}
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
                      onClick={(e) => {
                        e.stopPropagation()
                        void trashAsset(asset)
                      }}
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

      {/* ── 资产预览弹窗（对齐 hjwall AssetPreviewModal） ── */}
      {previewAsset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="asset-preview-title"
          className="cc-anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="cc-anim-fade-in-up relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-border-secondary bg-bg-elevated shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 预览头部 */}
            <div className="flex items-center justify-between border-b border-border-secondary px-4 py-3">
              <h2 id="asset-preview-title" className="truncate text-sm font-normal text-text-base">
                {assetLabel(previewAsset)}
              </h2>
              <button
                type="button"
                aria-label="关闭预览"
                onClick={() => setPreviewAsset(null)}
                className="rounded-md p-2 text-text-secondary transition hover:bg-bg-card hover:text-text-base"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-border-secondary px-4 py-3">
              <input
                aria-label="资产名称"
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-border-secondary bg-bg-input px-2.5 text-[13px] text-text-base placeholder:text-text-muted focus:border-border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void renamePreviewAsset()}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-[12px] font-semibold text-bg-base transition-colors hover:bg-brand-hover"
              >
                保存名称
              </button>
            </div>

            {previewAsset.mediaType === 'image' && categories.length > 0 && (
              <div className="flex items-center gap-3 border-b border-border-secondary px-4 py-3">
                <span className="shrink-0 text-[12px] font-bold uppercase tracking-wider text-text-muted">
                  图片分类
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-[12px] font-semibold transition',
                        categoryDraftIds.includes(category.id)
                          ? 'border-border-primary bg-bg-hover text-text-base'
                          : 'border-border-secondary bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-base',
                      )}
                    >
                      <input
                        type="checkbox"
                        aria-label={`分类 ${category.name}`}
                        checked={categoryDraftIds.includes(category.id)}
                        onChange={() => togglePreviewCategory(category.id)}
                        className="h-3.5 w-3.5 accent-brand"
                      />
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void savePreviewCategories()}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border-secondary bg-bg-card px-3 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-base"
                >
                  保存分类
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-b border-border-secondary px-4 py-2">
              <span className="rounded-pill border border-border-secondary bg-bg-card px-2.5 py-1 text-[12px] text-text-secondary">
                {previewAsset.mediaType}
              </span>
              {previewAsset.metadata.mimeType && (
                <span className="rounded-pill border border-border-secondary bg-bg-card px-2.5 py-1 text-[12px] text-text-secondary">
                  {previewAsset.metadata.mimeType}
                </span>
              )}
              {previewAsset.metadata.width && previewAsset.metadata.height && (
                <span className="rounded-pill border border-border-secondary bg-bg-card px-2.5 py-1 text-[12px] text-text-secondary">
                  {previewAsset.metadata.width} x {previewAsset.metadata.height}
                </span>
              )}
              {previewAsset.metadata.sizeBytes && (
                <span className="rounded-pill border border-border-secondary bg-bg-card px-2.5 py-1 text-[12px] text-text-secondary">
                  {formatFileSize(previewAsset.metadata.sizeBytes)}
                </span>
              )}
              {previewAsset.metadata.durationMs && (
                <span className="rounded-pill border border-border-secondary bg-bg-card px-2.5 py-1 text-[12px] text-text-secondary">
                  {formatDuration(previewAsset.metadata.durationMs)}
                </span>
              )}
              {previewAsset.metadata.orientation && (
                <span className="rounded-pill border border-border-secondary bg-bg-card px-2.5 py-1 text-[12px] text-text-secondary">
                  {previewAsset.metadata.orientation}
                </span>
              )}
            </div>

            {/* 预览内容 */}
            <div className="flex max-h-[calc(90vh-3.5rem)] items-center justify-center bg-black/50 p-4">
              {previewAsset.mediaType === 'image' ? (
                <img
                  src={previewAsset.safeUrl}
                  alt={assetLabel(previewAsset)}
                  className="max-h-[calc(90vh-5rem)] max-w-full object-contain"
                />
              ) : previewAsset.mediaType === 'video' ? (
                <video
                  key={previewAsset.id}
                  src={previewAsset.safeUrl}
                  controls
                  playsInline
                  className="max-h-[calc(90vh-5rem)] w-full max-w-full rounded-md"
                >
                  您的浏览器不支持视频播放
                </video>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                  <span className="text-5xl">
                    {MEDIA_TYPE_ICONS[previewAsset.mediaType] ?? MEDIA_TYPE_ICONS.other}
                  </span>
                  <p className="text-sm text-text-muted">
                    {previewAsset.mediaType === 'text'
                      ? '文本文件暂不支持预览'
                      : '此类型暂不支持预览'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
