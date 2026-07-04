// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'

import { AssetPanel, type AssetLibraryApi } from '../desktop/src/renderer/src/assets/AssetPanel'
import type { AssetCategory, AssetFolder, AssetMediaType, AssetRecord } from '../shared/assets'

const rootFolder: AssetFolder = {
  id: 'folder-scenes',
  name: 'Scenes',
  parentId: null,
  type: 'mixed',
  relativePath: 'scenes',
  createdAt: 1,
  updatedAt: 1
}

const childFolder: AssetFolder = {
  id: 'folder-shots',
  name: 'Shots',
  parentId: 'folder-scenes',
  type: 'image',
  relativePath: 'scenes/shots',
  createdAt: 2,
  updatedAt: 2
}

const frameAsset: AssetRecord = {
  id: 'asset-frame',
  mediaType: 'image',
  status: 'ready',
  relativePath: 'generated/image/frame.png',
  safeUrl: 'cc-asset://asset/asset-frame',
  metadata: { width: 1280, height: 720, orientation: 'landscape', mimeType: 'image/png' },
  folderId: 'folder-shots',
  createdAt: 3,
  updatedAt: 3
}

function makeAsset(id: string, mediaType: AssetMediaType, createdAt: number, categoryIds?: string[]): AssetRecord {
  return {
    id,
    mediaType,
    status: 'ready',
    relativePath: `imported/${mediaType}/${id}`,
    safeUrl: `cc-asset://asset/${id}`,
    metadata: {},
    ...(categoryIds ? { categoryIds } : {}),
    createdAt,
    updatedAt: createdAt
  }
}

const roleCategory: AssetCategory = {
  id: 'category-role',
  name: '角色',
  slug: 'role',
  kind: 'image',
  color: '#22c55e',
  icon: 'user-round',
  sortOrder: 10,
  builtIn: true,
  enabled: true,
  createdAt: 1,
  updatedAt: 1
}

const customCategory: AssetCategory = {
  id: 'category-custom',
  name: '主角图',
  slug: 'category-category-custom',
  kind: 'image',
  color: '#22c55e',
  icon: 'image',
  sortOrder: 101,
  builtIn: false,
  enabled: true,
  createdAt: 4,
  updatedAt: 4
}

function createApi(overrides: Partial<AssetLibraryApi> = {}): AssetLibraryApi {
  return {
    listAssets: vi.fn().mockResolvedValue([frameAsset]),
    importAsset: vi.fn().mockResolvedValue({
      ...frameAsset,
      id: 'asset-uploaded',
      relativePath: 'imported/image/asset-uploaded.png',
      folderId: 'folder-shots',
      categoryIds: ['category-role']
    }),
    getAssetFolders: vi.fn().mockResolvedValue([rootFolder, childFolder]),
    createAssetFolder: vi.fn().mockResolvedValue({ ...childFolder, id: 'folder-reference', name: 'References', relativePath: 'scenes/shots/references' }),
    moveAsset: vi.fn().mockResolvedValue({ ...frameAsset, folderId: 'folder-scenes' }),
    renameAsset: vi.fn().mockResolvedValue({ ...frameAsset, displayName: '主角定稿', updatedAt: 5 }),
    trashAsset: vi.fn().mockResolvedValue({ assetId: 'asset-frame', status: 'rejected', blockingReferences: [] }),
    deleteAssetFolder: vi.fn().mockResolvedValue({ folderId: 'folder-shots', status: 'deleted', affectedAssetIds: ['asset-frame'], tombstonedAssetIds: [], blockingReferences: [] }),
    getAssetCategories: vi.fn().mockResolvedValue([roleCategory]),
    createAssetCategory: vi.fn().mockResolvedValue(customCategory),
    updateAssetCategory: vi.fn().mockResolvedValue({ ...roleCategory, enabled: false }),
    assignAssetCategory: vi.fn().mockResolvedValue({ assetId: 'asset-frame', categoryId: 'category-role', assigned: true }),
    removeAssetCategory: vi.fn().mockResolvedValue({ assetId: 'asset-frame', categoryId: 'category-role', removed: true }),
    ...overrides
  }
}

function mockOf<T extends (...args: never[]) => unknown>(fn: T): Mock {
  return fn as unknown as Mock
}

function renderAssetPanel(api: AssetLibraryApi, initialEntry = '/assets'): void {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AssetPanel api={api} />
    </MemoryRouter>
  )
}

function LocationProbe(): JSX.Element {
  const location = useLocation()
  return <output aria-label="当前位置">{`${location.pathname}${location.search}`}</output>
}

function renderAssetPanelWithLocation(api: AssetLibraryApi, initialEntry = '/assets'): void {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AssetPanel api={api} />
      <LocationProbe />
    </MemoryRouter>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('M5 AssetPanel folder UI', () => {
  it('renders nested folders, creates child folders, moves assets, and deletes the selected folder', async () => {
    const api = createApi()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAssetPanel(api)

    expect(await screen.findByRole('button', { name: 'Scenes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '全部资产' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Shots' }))
    await waitFor(() => expect(mockOf(api.listAssets)).toHaveBeenLastCalledWith({ folderId: 'folder-shots' }))
    expect(await screen.findByText('asset-frame')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: '新文件夹名称' }), { target: { value: 'References' } })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() =>
      expect(mockOf(api.createAssetFolder)).toHaveBeenCalledWith(expect.objectContaining({ name: 'References', parentId: 'folder-shots', type: 'mixed' }))
    )
    expect(screen.getByText('已创建 References')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: '移动 Frame 1280x720' }), { target: { value: 'folder-scenes' } })
    await waitFor(() => expect(mockOf(api.moveAsset)).toHaveBeenCalledWith({ assetId: 'asset-frame', folderId: 'folder-scenes' }))

    fireEvent.click(screen.getByRole('button', { name: '回收 Frame 1280x720' }))
    await waitFor(() => expect(mockOf(api.trashAsset)).toHaveBeenCalledWith({ assetId: 'asset-frame', mode: 'safe' }))

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    await waitFor(() => expect(mockOf(api.deleteAssetFolder)).toHaveBeenCalledWith({ folderId: 'folder-shots', mode: 'force-tombstone' }))
  })

  it('filters image assets by category and creates user-defined categories', async () => {
    const api = createApi()
    renderAssetPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: '分类 角色' }))
    await waitFor(() => expect(mockOf(api.listAssets)).toHaveBeenLastCalledWith({ categoryId: 'category-role' }))

    fireEvent.change(screen.getByRole('textbox', { name: '新分类名称' }), { target: { value: '主角图' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(() =>
      expect(mockOf(api.createAssetCategory)).toHaveBeenCalledWith(expect.objectContaining({ name: '主角图' }))
    )
    expect(screen.getByText('已创建分类 主角图')).toBeInTheDocument()
  })

  it('imports selected files with the active folder and category context', async () => {
    const api = createApi()
    renderAssetPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: 'Shots' }))
    fireEvent.click(await screen.findByRole('button', { name: '分类 角色' }))

    const file = new File(['fake png bytes'], 'hero.png', { type: 'image/png' })
    Object.defineProperty(file, 'path', { value: '/tmp/hero.png' })

    fireEvent.change(screen.getByLabelText('选择资产文件'), { target: { files: [file] } })

    await waitFor(() =>
      expect(mockOf(api.importAsset)).toHaveBeenCalledWith({
        sourcePath: '/tmp/hero.png',
        mediaType: 'image',
        folderId: 'folder-shots',
        categoryIds: ['category-role']
      })
    )
    expect(screen.getByText('已导入 1 个资产')).toBeInTheDocument()
  })

  it('imports paths selected from the desktop file picker', async () => {
    const api = createApi({
      pickAssetImportFiles: vi.fn().mockResolvedValue({ paths: ['/tmp/hero.png'] })
    })
    renderAssetPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: 'Shots' }))
    fireEvent.click(await screen.findByRole('button', { name: '分类 角色' }))
    fireEvent.click(screen.getByRole('button', { name: '上传' }))

    await waitFor(() =>
      expect(mockOf(api.importAsset)).toHaveBeenCalledWith({
        sourcePath: '/tmp/hero.png',
        mediaType: 'image',
        folderId: 'folder-shots',
        categoryIds: ['category-role']
      })
    )
    expect(screen.getByText('已导入 1 个资产')).toBeInTheDocument()
  })

  it('shows multi-file upload progress, busy state, success refresh, and readable failure feedback', async () => {
    let importCalls = 0
    const firstImport = {
      resolve: null as ((asset: AssetRecord) => void) | null
    }
    const api = createApi({
      importAsset: vi.fn(async ({ sourcePath }) => {
        importCalls += 1
        if (sourcePath.endsWith('hero.png')) {
          return await new Promise<AssetRecord>((resolve) => {
            firstImport.resolve = resolve
          })
        }
        if (sourcePath.endsWith('broken.png')) {
          throw new Error('bad file')
        }
        return {
          ...frameAsset,
          id: `asset-uploaded-${importCalls}`,
          relativePath: `imported/image/asset-uploaded-${importCalls}.png`,
          safeUrl: `cc-asset://asset/asset-uploaded-${importCalls}`
        }
      })
    })
    renderAssetPanel(api)

    const first = new File(['first'], 'hero.png', { type: 'image/png' })
    Object.defineProperty(first, 'path', { value: '/tmp/hero.png' })
    const second = new File(['second'], 'broken.png', { type: 'image/png' })
    Object.defineProperty(second, 'path', { value: '/tmp/broken.png' })

    fireEvent.change(screen.getByLabelText('选择资产文件'), { target: { files: [first, second] } })

    expect(await screen.findByText('正在导入 1/2: hero.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导入中' })).toBeDisabled()
    firstImport.resolve?.({
      ...frameAsset,
      id: 'asset-uploaded-1',
      relativePath: 'imported/image/asset-uploaded-1.png',
      safeUrl: 'cc-asset://asset/asset-uploaded-1'
    })
    await waitFor(() => expect(screen.getByText('导入完成 2/2')).toBeInTheDocument())
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('导入完成，broken.png 失败。')).toBeInTheDocument()
    expect(screen.getByText('asset-uploaded-1')).toBeInTheDocument()
  })

  it('syncs the active asset type tab into the URL query', async () => {
    const api = createApi()
    renderAssetPanelWithLocation(api, '/assets?type=invalid')

    expect(await screen.findByText('asset-frame')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /视频/ }))

    await waitFor(() => expect(screen.getByLabelText('当前位置')).toHaveTextContent('/assets?type=video'))
  })

  it('syncs search, sort, and date filters into the URL while filtering visible assets', async () => {
    const now = Date.now()
    const api = createApi({
      listAssets: vi.fn().mockResolvedValue([
        makeAsset('asset-hero.png', 'image', now),
        makeAsset('asset-city.png', 'image', now - 10 * 24 * 60 * 60 * 1000)
      ])
    })
    renderAssetPanelWithLocation(api)

    expect(await screen.findByText('asset-hero.png')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索资产' }), { target: { value: 'hero' } })
    fireEvent.change(screen.getByRole('combobox', { name: '日期筛选' }), { target: { value: '7d' } })
    fireEvent.click(screen.getByRole('button', { name: '最新优先 ⇅' }))

    await waitFor(() => expect(screen.getByLabelText('当前位置')).toHaveTextContent('/assets?q=hero&sort=oldest&date=7d'))
    expect(screen.getByText('asset-hero.png')).toBeInTheDocument()
    expect(screen.queryByText('asset-city.png')).not.toBeInTheDocument()
  })

  it('switches between responsive grid and list asset shells', async () => {
    const now = Date.now()
    const api = createApi({
      listAssets: vi.fn().mockResolvedValue([
        {
          ...makeAsset('asset-first.png', 'image', now),
          url: 'https://assets.example.com/asset-first.png',
          s3Key: 'assets/2026-06/asset-first.png'
        },
        makeAsset('asset-second.mp4', 'video', now - 1)
      ])
    })
    renderAssetPanel(api)

    const cloudImage = await screen.findByRole('img', { name: 'Asset First' })
    expect(cloudImage).toHaveAttribute('src', 'https://assets.example.com/asset-first.png')
    expect(cloudImage).toHaveClass('object-contain')
    fireEvent.click(screen.getByRole('button', { name: '列表视图' }))

    expect(screen.getByText('asset-first.png')).toBeInTheDocument()
    expect(screen.getByText('Asset First')).toBeInTheDocument()
    expect(screen.getByText('asset-second.mp4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '网格视图' })).toBeInTheDocument()
  })

  it('keeps asset image containers fixed while media adapts inside them', async () => {
    const now = Date.now()
    const api = createApi({
      listAssets: vi.fn().mockResolvedValue([
        {
          ...makeAsset('asset-landscape.png', 'image', now),
          metadata: { width: 1600, height: 900, orientation: 'landscape' }
        },
        {
          ...makeAsset('asset-portrait.png', 'image', now - 1),
          metadata: { width: 900, height: 1600, orientation: 'portrait' }
        }
      ])
    })
    renderAssetPanel(api)

    const landscapeImage = await screen.findByRole('img', { name: 'Asset Landscape 1600x900' })
    expect(landscapeImage.closest('article')).toHaveClass('aspect-square')
    expect(landscapeImage.closest('article')).toHaveClass('bg-bg-card', 'border-border-secondary', 'shadow-card')
    expect(landscapeImage).toHaveClass('object-contain')

    fireEvent.click(screen.getByRole('img', { name: 'Asset Portrait 900x1600' }))
    const dialog = screen.getByRole('dialog', { name: 'Asset Portrait 900x1600' })
    expect(dialog).toHaveClass('max-w-3xl', 'bg-bg-panel', 'shadow-pop')
    expect(within(dialog).getByRole('img', { name: 'Asset Portrait 900x1600' })).toHaveClass('object-contain')
  })

  it('renders loading, error, and empty states for the asset page shell', async () => {
    const loadingApi = createApi({
      listAssets: vi.fn(() => new Promise<AssetRecord[]>(() => {}))
    })
    const { unmount } = render(
      <MemoryRouter initialEntries={['/assets']}>
        <AssetPanel api={loadingApi} />
      </MemoryRouter>
    )
    expect(document.querySelectorAll('.cc-skeleton').length).toBeGreaterThan(0)
    unmount()

    const errorApi = createApi({
      listAssets: vi.fn().mockRejectedValue(new Error('boom'))
    })
    renderAssetPanel(errorApi)
    expect(await screen.findAllByText('资产加载失败。')).toHaveLength(2)
    cleanup()

    const emptyApi = createApi({
      listAssets: vi.fn().mockResolvedValue([])
    })
    renderAssetPanel(emptyApi)
    expect(await screen.findByText('暂无资产')).toBeInTheDocument()
    expect(screen.getByText('在左侧创建文件夹后导入资产')).toBeInTheDocument()
  })

  it('shows type counts including role-category images as the character tab', async () => {
    const now = Date.now()
    const api = createApi({
      listAssets: vi.fn().mockResolvedValue([
        makeAsset('asset-role.png', 'image', now, ['category-role']),
        makeAsset('asset-image.png', 'image', now),
        makeAsset('asset-video.mp4', 'video', now),
        makeAsset('asset-audio.mp3', 'audio', now)
      ])
    })
    renderAssetPanel(api)

    expect(await screen.findByRole('button', { name: '全部 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '图片 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '视频 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '音频 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '角色 1' })).toBeInTheDocument()
  })

  it('filters assets by date range from the filter bar', async () => {
    const now = Date.now()
    const old = now - 45 * 24 * 60 * 60 * 1000
    const api = createApi({
      listAssets: vi.fn().mockResolvedValue([
        makeAsset('asset-recent.png', 'image', now),
        makeAsset('asset-old.png', 'image', old)
      ])
    })
    renderAssetPanel(api)

    expect(await screen.findByText('asset-old.png')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: '日期筛选' }), { target: { value: '7d' } })

    expect(screen.getByText('asset-recent.png')).toBeInTheDocument()
    expect(screen.queryByText('asset-old.png')).not.toBeInTheDocument()
  })

  it('supports batch mode selection and safe batch delete reset', async () => {
    const now = Date.now()
    const api = createApi({
      listAssets: vi.fn().mockResolvedValue([
        makeAsset('asset-first.png', 'image', now),
        makeAsset('asset-second.png', 'image', now - 1)
      ]),
      trashAsset: vi.fn().mockResolvedValue({ assetId: 'asset-first.png', status: 'trashed', blockingReferences: [] })
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAssetPanel(api)

    expect(await screen.findByText('asset-first.png')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '批量' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '选择 Asset First' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '选择 Asset Second' }))
    fireEvent.click(screen.getByRole('button', { name: '删除 2 项' }))

    await waitFor(() => expect(mockOf(api.trashAsset)).toHaveBeenCalledTimes(2))
    expect(mockOf(api.trashAsset)).toHaveBeenNthCalledWith(1, { assetId: 'asset-first.png', mode: 'safe' })
    expect(mockOf(api.trashAsset)).toHaveBeenNthCalledWith(2, { assetId: 'asset-second.png', mode: 'safe' })
    expect(screen.getByText('已回收 2 个资产')).toBeInTheDocument()
    expect(screen.queryByText('asset-first.png')).not.toBeInTheDocument()
    expect(screen.queryByText('asset-second.png')).not.toBeInTheDocument()
  })

  it('renames an asset from the preview modal without changing the asset URL', async () => {
    const api = createApi()
    renderAssetPanel(api)

    fireEvent.click(await screen.findByRole('img', { name: 'Frame 1280x720' }))
    fireEvent.change(screen.getByRole('textbox', { name: '资产名称' }), { target: { value: '主角定稿' } })
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }))

    await waitFor(() =>
      expect(mockOf(api.renameAsset)).toHaveBeenCalledWith({ assetId: 'asset-frame', displayName: '主角定稿' })
    )
    expect(screen.getByText('已重命名为 主角定稿')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: '主角定稿' })[0]).toHaveAttribute('src', 'cc-asset://asset/asset-frame')
  })

  it('shows preview metadata and non-image fallback thumbnails', async () => {
    const api = createApi({
      listAssets: vi.fn().mockResolvedValue([
        {
          ...frameAsset,
          metadata: { ...frameAsset.metadata, sizeBytes: 2048 }
        },
        makeAsset('asset-narration.mp3', 'audio', Date.now())
      ])
    })
    renderAssetPanel(api)

    expect(await screen.findByText('🎧')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('img', { name: 'Frame 1280x720' }))

    const dialog = screen.getByRole('dialog', { name: 'Frame 1280x720' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('image/png')).toBeInTheDocument()
    expect(within(dialog).getByText('1280 x 720')).toBeInTheDocument()
    expect(within(dialog).getByText('2.0 KB')).toBeInTheDocument()
    expect(within(dialog).getByText('landscape')).toBeInTheDocument()
  })

  it('assigns and removes image categories from the preview modal', async () => {
    const api = createApi({
      listAssets: vi.fn().mockResolvedValue([{ ...frameAsset, categoryIds: ['category-role'] }]),
      getAssetCategories: vi.fn().mockResolvedValue([roleCategory, customCategory]),
      assignAssetCategory: vi.fn().mockResolvedValue({ assetId: 'asset-frame', categoryId: 'category-custom', assigned: true }),
      removeAssetCategory: vi.fn().mockResolvedValue({ assetId: 'asset-frame', categoryId: 'category-role', removed: true })
    })
    renderAssetPanel(api)

    fireEvent.click(await screen.findByRole('img', { name: 'Frame 1280x720' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '分类 角色' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '分类 主角图' }))
    fireEvent.click(screen.getByRole('button', { name: '保存分类' }))

    await waitFor(() => expect(mockOf(api.removeAssetCategory)).toHaveBeenCalledWith({ assetId: 'asset-frame', categoryId: 'category-role' }))
    expect(mockOf(api.assignAssetCategory)).toHaveBeenCalledWith({ assetId: 'asset-frame', categoryId: 'category-custom' })
    expect(screen.getByText('已更新资产分类')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '分类 主角图' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '分类 角色' })).not.toBeChecked()
  })

  it('edits and disables custom image categories from the sidebar', async () => {
    const api = createApi({
      getAssetCategories: vi.fn().mockResolvedValue([roleCategory, customCategory]),
      updateAssetCategory: vi.fn()
        .mockResolvedValueOnce({ ...customCategory, color: '#ef4444', icon: 'sparkles', updatedAt: 5 })
        .mockResolvedValueOnce({ ...customCategory, enabled: false, updatedAt: 6 })
    })
    renderAssetPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: '分类 主角图' }))
    fireEvent.change(screen.getByRole('textbox', { name: '分类颜色' }), { target: { value: '#ef4444' } })
    fireEvent.change(screen.getByRole('combobox', { name: '分类图标' }), { target: { value: 'sparkles' } })
    fireEvent.click(screen.getByRole('button', { name: '保存分类设置' }))

    await waitFor(() =>
      expect(mockOf(api.updateAssetCategory)).toHaveBeenCalledWith({
        categoryId: 'category-custom',
        color: '#ef4444',
        icon: 'sparkles'
      })
    )
    expect(screen.getByText('已更新分类 主角图')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '删除分类 主角图' }))

    await waitFor(() =>
      expect(mockOf(api.updateAssetCategory)).toHaveBeenCalledWith({
        categoryId: 'category-custom',
        enabled: false
      })
    )
    expect(screen.getByText('已删除分类 主角图')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '分类 主角图' })).not.toBeInTheDocument()
  })
})
