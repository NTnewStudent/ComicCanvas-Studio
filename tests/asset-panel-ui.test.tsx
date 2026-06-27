// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'

import { AssetPanel, type AssetLibraryApi } from '../desktop/src/renderer/src/assets/AssetPanel'
import type { AssetFolder, AssetRecord } from '../shared/assets'

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

function createApi(overrides: Partial<AssetLibraryApi> = {}): AssetLibraryApi {
  return {
    listAssets: vi.fn().mockResolvedValue([frameAsset]),
    getAssetFolders: vi.fn().mockResolvedValue([rootFolder, childFolder]),
    createAssetFolder: vi.fn().mockResolvedValue({ ...childFolder, id: 'folder-reference', name: 'References', relativePath: 'scenes/shots/references' }),
    moveAsset: vi.fn().mockResolvedValue({ ...frameAsset, folderId: 'folder-scenes' }),
    trashAsset: vi.fn().mockResolvedValue({ assetId: 'asset-frame', status: 'rejected', blockingReferences: [] }),
    deleteAssetFolder: vi.fn().mockResolvedValue({ folderId: 'folder-shots', status: 'deleted', affectedAssetIds: ['asset-frame'], tombstonedAssetIds: [], blockingReferences: [] }),
    ...overrides
  }
}

function mockOf<T extends (...args: never[]) => unknown>(fn: T): Mock {
  return fn as unknown as Mock
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('M5 AssetPanel folder UI', () => {
  it('renders nested folders, creates child folders, moves assets, and deletes the selected folder', async () => {
    const api = createApi()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AssetPanel api={api} />)

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
})
