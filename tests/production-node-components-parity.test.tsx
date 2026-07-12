// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  AudioNodeData,
  CharacterNodeData,
  MjImageNodeData,
  MuxAudioVideoNodeData,
  SceneNodeData,
  SuperResolutionNodeData,
  VideoComposeNodeData
} from '../shared/nodes'
import { AudioNode } from '../desktop/src/renderer/src/canvas/nodes/AudioNode'
import { CharacterNode } from '../desktop/src/renderer/src/canvas/nodes/CharacterNode'
import { NodeEditorProvider } from '../desktop/src/renderer/src/canvas/components/NodeEditorContext'
import { MjImageNode } from '../desktop/src/renderer/src/canvas/nodes/MjImageNode'
import { MuxAudioVideoNode } from '../desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode'
import { SceneNode } from '../desktop/src/renderer/src/canvas/nodes/SceneNode'
import { SuperResolutionNode } from '../desktop/src/renderer/src/canvas/nodes/SuperResolutionNode'
import { VideoComposeNode } from '../desktop/src/renderer/src/canvas/nodes/VideoComposeNode'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

function renderInFlow(element: React.ReactElement): void {
  render(<ReactFlowProvider>{element}</ReactFlowProvider>)
}

afterEach(() => {
  cleanup()
})

describe('Task 27 production node components parity', () => {
  it('registers concrete production components instead of the generic migrated wrapper', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    for (const component of [
      'CharacterNode',
      'SceneNode',
      'AudioNode',
      'VideoComposeNode',
      'SuperResolutionNode',
      'MuxAudioVideoNode',
      'MjImageNode'
    ]) {
      expect(source).toContain(`./nodes/${component}`)
    }

    expect(source).not.toContain("import { MigratedNode }")
    expect(source).not.toContain('createMigratedNodeWrapper')
    expect(source).toContain('character: CharacterNode')
    expect(source).toContain('scene: SceneNode')
    expect(source).toContain('audio: AudioNode')
    expect(source).toContain('videoCompose: VideoComposeNode')
    expect(source).toContain('superResolution: SuperResolutionNode')
    expect(source).toContain('muxAudioVideo: MuxAudioVideoNode')
    expect(source).toContain('mjImage: MjImageNode')
  })

  it('renders character and scene as asset-backed semantic context nodes', () => {
    const onCharacterChange = vi.fn()
    const onSceneChange = vi.fn()

    renderInFlow(
      <>
        <NodeEditorProvider selectedNodeIds={['character-1']}>
          <CharacterNode
            id="character-1"
            selected
            data={{
              label: 'Mika',
              description: 'brave pilot with blue coat',
              assetId: 'asset-character',
              url: 'cc-asset://asset/asset-character',
              tags: ['lead']
            } satisfies CharacterNodeData}
            onChange={onCharacterChange}
          />
        </NodeEditorProvider>
        <NodeEditorProvider selectedNodeIds={['scene-1']}>
          <SceneNode
            id="scene-1"
            selected
            data={{
              label: 'Rain Alley',
              description: 'neon street after rain',
              assetId: 'asset-scene',
              url: 'cc-asset://asset/asset-scene',
              category: 'exterior'
            } satisfies SceneNodeData}
            onChange={onSceneChange}
          />
        </NodeEditorProvider>
      </>
    )

    expect(screen.getByRole('group', { name: '角色节点 Mika' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '场景节点 Rain Alley' })).toBeInTheDocument()
    expect(screen.getByText('brave pilot with blue coat', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('neon street after rain', { selector: 'strong' })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: '角色描述' }), {
      target: { value: 'older detective in graphite coat' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: '场景描述' }), {
      target: { value: 'quiet station platform at dawn' }
    })

    expect(onCharacterChange).toHaveBeenLastCalledWith('character-1', { description: 'older detective in graphite coat' })
    expect(onSceneChange).toHaveBeenLastCalledWith('scene-1', { description: 'quiet station platform at dawn' })
  })

  it('renders media and post-production tool nodes with specific controls', () => {
    const onAudioChange = vi.fn()
    const onComposeChange = vi.fn()
    const onSuperChange = vi.fn()
    const onMuxChange = vi.fn()

    renderInFlow(
      <>
        <NodeEditorProvider selectedNodeIds={['audio-1']}><AudioNode
          id="audio-1"
          selected
          data={{ label: 'Theme', assetId: 'asset-audio', url: 'cc-asset://asset/asset-audio', durationSeconds: 42, status: 'idle' } satisfies AudioNodeData}
          onChange={onAudioChange}
        /></NodeEditorProvider>
        <NodeEditorProvider selectedNodeIds={['compose-1']}><VideoComposeNode
          id="compose-1"
          selected
          data={{ label: 'Compose', inputOrder: ['video-1'], transitionName: 'cut', modelId: 'compose-local', assetId: null, status: 'idle' } satisfies VideoComposeNodeData}
          onChange={onComposeChange}
        /></NodeEditorProvider>
        <NodeEditorProvider selectedNodeIds={['super-1']}><SuperResolutionNode
          id="super-1"
          selected
          data={{ label: 'Upscale', scene: 'aigc', resolution: '1080p', fps: 30, assetId: null, status: 'idle' } satisfies SuperResolutionNodeData}
          onChange={onSuperChange}
        /></NodeEditorProvider>
        <NodeEditorProvider selectedNodeIds={['mux-1']}><MuxAudioVideoNode
          id="mux-1"
          selected
          data={{ label: 'Mux', modelId: 'mux-local', assetId: null, status: 'idle' } satisfies MuxAudioVideoNodeData}
          onChange={onMuxChange}
        /></NodeEditorProvider>
      </>
    )

    expect(screen.getByRole('group', { name: '音频节点 Theme' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '视频合成节点 Compose' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '视频超分节点 Upscale' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '音视频合成节点 Mux' })).toBeInTheDocument()
    expect(screen.getByText('42s')).toBeInTheDocument()
    expect(screen.getByText('video-1')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: '转场' }), { target: { value: 'crossfade' } })
    fireEvent.change(screen.getByRole('combobox', { name: '目标分辨率' }), { target: { value: '4k' } })
    fireEvent.change(screen.getByRole('textbox', { name: '音视频合成模型' }), { target: { value: 'mux-fast' } })

    expect(onComposeChange).toHaveBeenLastCalledWith('compose-1', { transitionName: 'crossfade' })
    expect(onSuperChange).toHaveBeenLastCalledWith('super-1', { resolution: '4k' })
    expect(onMuxChange).toHaveBeenLastCalledWith('mux-1', { modelId: 'mux-fast' })
  })

  it('renders MJ image as a four-result image generator with selection state', () => {
    const onChange = vi.fn()

    renderInFlow(
      <NodeEditorProvider selectedNodeIds={['mj-1']}><MjImageNode
        id="mj-1"
        selected
        data={{
          label: 'MJ Sheet',
          prompt: 'cinematic rainy alley',
          modelId: 'mj-v6',
          ratio: '16:9',
          urls: ['cc-asset://asset/mj-1', 'cc-asset://asset/mj-2'],
          selectedIndex: 1,
          assetId: null,
          status: 'done'
        } satisfies MjImageNodeData}
        onChange={onChange}
      /></NodeEditorProvider>
    )

    expect(screen.getByRole('group', { name: 'MJ Image node MJ Sheet' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'MJ Prompt' })).toHaveValue('cinematic rainy alley')
    expect(screen.getByRole('button', { name: '选择 MJ 结果 2' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '选择 MJ 结果 1' }))

    expect(onChange).toHaveBeenLastCalledWith('mj-1', { selectedIndex: 0, url: 'cc-asset://asset/mj-1' })
  })
})
