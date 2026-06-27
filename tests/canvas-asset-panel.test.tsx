// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CanvasAssetPanel } from '../desktop/src/renderer/src/canvas/components/CanvasAssetPanel'
import type { AssetCategory, AssetFolder, AssetRecord } from '../shared/assets'

const category: AssetCategory = {
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

const asset: AssetRecord = {
  id: 'asset-hero',
  displayName: '主角参考',
  mediaType: 'image',
  status: 'ready',
  relativePath: 'imported/image/hero.png',
  safeUrl: 'cc-asset://asset/asset-hero',
  metadata: { width: 1024, height: 1024, orientation: 'square' },
  categoryIds: ['category-role'],
  createdAt: 2,
  updatedAt: 2
}

const emptyFolders: AssetFolder[] = []

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('CanvasAssetPanel categorized insertion', () => {
  it('filters categorized images and inserts them with the selected canvas mode', async () => {
    const uploadedAsset: AssetRecord = {
      ...asset,
      url: 'https://assets.example.com/asset-hero.png',
      s3Key: 'assets/2026-06/asset-hero.png'
    }
    const listAssets = vi.fn().mockResolvedValue([uploadedAsset])
    window.comicCanvas = {
      getAssetFolders: vi.fn().mockResolvedValue(emptyFolders),
      getAssetCategories: vi.fn().mockResolvedValue([category]),
      listAssets
    } as unknown as Window['comicCanvas']
    const onInsertAsset = vi.fn()

    render(<CanvasAssetPanel open onClose={vi.fn()} onInsertAsset={onInsertAsset} />)

    fireEvent.click(await screen.findByRole('button', { name: '分类 角色' }))
    await waitFor(() => expect(listAssets).toHaveBeenLastCalledWith({ categoryId: 'category-role', mediaType: 'image' }))

    fireEvent.click(screen.getByRole('button', { name: '插入为角色' }))
    fireEvent.click(screen.getByRole('button', { name: '插入资产 主角参考' }))

    expect(onInsertAsset).toHaveBeenCalledWith({
      id: 'asset-hero',
      url: 'https://assets.example.com/asset-hero.png',
      type: 'image',
      name: '主角参考',
      mode: 'character'
    })
  })
})
