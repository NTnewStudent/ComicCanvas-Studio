// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AudioNodeData } from '../shared/nodes'
import { MediaInputControls } from '../desktop/src/renderer/src/canvas/components/MediaInputControls'
import { NodeAssetPickerModal } from '../desktop/src/renderer/src/canvas/components/NodeAssetPickerModal'
import { AudioNode } from '../desktop/src/renderer/src/canvas/nodes/AudioNode'

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

const audioOptions = [
  { assetId: 'asset-audio-a', label: 'Voice take', safeUrl: 'cc-asset://asset/asset-audio-a' },
  { assetId: 'asset-audio-b', label: 'Room tone', safeUrl: 'cc-asset://asset/asset-audio-b' }
]

describe('Task 39 node asset picker and media input controls parity', () => {
  it('supports audio asset picker options and compact rendering', () => {
    const onSelect = vi.fn()

    render(
      <NodeAssetPickerModal
        mediaType="audio"
        options={audioOptions}
        compact
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: '选择音频资产' })).toBeInTheDocument()
    expect(screen.getByTestId('audio-asset-option-asset-audio-a')).toHaveAttribute('src', 'cc-asset://asset/asset-audio-a')
    expect(screen.getByTestId('node-asset-picker-grid')).toHaveAttribute('data-compact', 'true')

    fireEvent.click(screen.getByRole('button', { name: '选择音频资产 Voice take' }))
    expect(onSelect).toHaveBeenCalledWith(audioOptions[0])
  })

  it('selects, clears, and gates external URL binding from shared media controls', () => {
    const onSelect = vi.fn()
    const onClear = vi.fn()

    render(
      <MediaInputControls
        mediaType="image"
        label="主图素材"
        selectedAssetId="asset-image-a"
        selectedSafeUrl="cc-asset://asset/asset-image-a"
        options={[{ assetId: 'asset-image-b', label: 'Rain alley', safeUrl: 'cc-asset://asset/asset-image-b' }]}
        compact
        onSelect={onSelect}
        onClear={onClear}
      />
    )

    expect(screen.getByText('asset-image-a')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '选择主图素材' }))
    fireEvent.click(screen.getByRole('button', { name: '选择图片资产 Rain alley' }))
    expect(onSelect).toHaveBeenCalledWith({
      assetId: 'asset-image-b',
      label: 'Rain alley',
      safeUrl: 'cc-asset://asset/asset-image-b'
    })

    fireEvent.click(screen.getByRole('button', { name: '清除主图素材' }))
    expect(onClear).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '使用外部 URL 作为主图素材' }))
    expect(screen.getByRole('dialog', { name: '外部 URL 暂不可用 主图素材' })).toBeInTheDocument()
    expect(screen.getByText('本地画布暂不把外部 URL 直接绑定为节点素材。')).toBeInTheDocument()
    expect(screen.getByText('请先导入资产库，系统会生成 cc-asset:// 安全地址后再绑定。')).toBeInTheDocument()
  })

  it('binds and clears audio assets from AudioNode through the shared media controls', () => {
    const onChange = vi.fn()

    render(
      <ReactFlowProvider>
        <AudioNode
          id="audio-1"
          selected
          data={{
            label: 'Theme',
            assetId: 'asset-audio-current',
            url: 'cc-asset://asset/asset-audio-current',
            durationSeconds: 42,
            status: 'idle',
            referenceRole: 'music'
          } satisfies AudioNodeData}
          assetOptions={audioOptions}
          onChange={onChange}
        />
      </ReactFlowProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: '选择音频素材' }))
    fireEvent.click(screen.getByRole('button', { name: '选择音频资产 Voice take' }))
    expect(onChange).toHaveBeenCalledWith('audio-1', {
      assetId: 'asset-audio-a',
      url: 'cc-asset://asset/asset-audio-a',
      status: 'idle'
    })

    fireEvent.click(screen.getByRole('button', { name: '清除音频素材' }))
    expect(onChange).toHaveBeenCalledWith('audio-1', { assetId: null, url: '' })
  })
})
