// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { composeFinalPrompt } from '../shared/composed-prompt'
import type { GraphSnapshot } from '../shared/composed-prompt'
import { ConnectedInputsPanel } from '../desktop/src/renderer/src/canvas/components/ConnectedInputsPanel'
import { buildConnectedInputsView } from '../desktop/src/renderer/src/canvas/lib/connected-inputs'
import {
  createCanvasStore,
  type CanvasStoreEdge,
  type CanvasStoreNode
} from '../desktop/src/renderer/src/canvas/store/canvas.store'

const nodes: CanvasStoreNode[] = [
  { id: 'text-late', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Late beat', content: 'second beat' } },
  { id: 'text-early', type: 'text', position: { x: 0, y: 120 }, data: { label: 'Early beat', content: 'first beat' } },
  {
    id: 'image-ref',
    type: 'image',
    position: { x: 0, y: 240 },
    data: {
      label: 'Reference image',
      promptOverride: '',
      modelId: 'stub-image',
      orientation: 'landscape',
      assetId: 'asset-image-1',
      status: 'done'
    }
  },
  {
    id: 'target-video',
    type: 'video',
    position: { x: 360, y: 0 },
    data: {
      label: 'Video target',
      promptOverride: 'final motion cue',
      modelId: 'stub-video',
      orientation: 'landscape',
      durationSeconds: 5,
      firstFrameAssetId: null,
      lastFrameAssetId: null,
      assetId: null,
      status: 'idle'
    }
  }
]

const edges: CanvasStoreEdge[] = [
  { id: 'late', source: 'text-late', target: 'target-video', data: { edgeType: 'promptOrder', createdAt: 20 } },
  { id: 'early', source: 'text-early', target: 'target-video', data: { edgeType: 'promptOrder', createdAt: 10 } },
  { id: 'image', source: 'image-ref', target: 'target-video', data: { edgeType: 'imageRole', createdAt: 15 } }
]

function toGraphSnapshot(): GraphSnapshot {
  return {
    nodes: nodes.map(({ id, type, data }) => ({ id, type, data })),
    edges: edges.map(({ id, source, target, data }) => ({ id, source, target, data }))
  }
}

afterEach(() => {
  cleanup()
})

describe('M2 ConnectedInputsPanel', () => {
  it('builds ordered upstream text and a byte-equivalent final prompt preview', () => {
    const view = buildConnectedInputsView({ nodes, edges }, 'target-video')
    const shared = composeFinalPrompt(toGraphSnapshot(), 'target-video')

    expect(view.items.map((item) => item.content)).toEqual(['first beat', 'second beat'])
    expect(view.finalPrompt).toBe(shared.composedPrompt)
    expect(view.referenceImages).toEqual(shared.referenceImages)
  })

  it('renders upstream text cards and final prompt preview', () => {
    render(<ConnectedInputsPanel nodes={nodes} edges={edges} nodeId="target-video" />)
    const shared = composeFinalPrompt(toGraphSnapshot(), 'target-video')

    expect(screen.getByText('Connected inputs')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('Early beat')).toBeInTheDocument()
    expect(screen.getByText('first beat')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('Late beat')).toBeInTheDocument()
    expect(screen.getByText('second beat')).toBeInTheDocument()
    expect(screen.getByLabelText('Final prompt preview').textContent).toBe(shared.composedPrompt)
  })

  it('does not mount when there are no upstream text nodes', () => {
    const { container } = render(<ConnectedInputsPanel nodes={nodes} edges={[]} nodeId="target-video" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('subscribes to canvas store updates when graph props are omitted', () => {
    const store = createCanvasStore({
      idFactory: (() => {
        const ids = ['text-live', 'target-live']
        let index = 0
        return () => ids[index++] ?? `node-${index}`
      })(),
      edgeIdFactory: (source, target) => `edge-${source}-${target}`,
      clock: () => 30
    })
    const text = store.getState().addNode('text', { x: 0, y: 0 }, { label: 'Live text', content: 'before update' })
    const target = store
      .getState()
      .addNode('video', { x: 320, y: 0 }, { label: 'Live video', promptOverride: 'self prompt' })
    store.getState().addEdge(text, target)

    render(<ConnectedInputsPanel store={store} nodeId={target} />)

    expect(screen.getByText('before update')).toBeInTheDocument()

    act(() => {
      store.getState().updateNodeData(text, { content: 'after update' })
    })

    expect(screen.getByText('after update')).toBeInTheDocument()
    expect(screen.getByLabelText('Final prompt preview').textContent).toContain('after update')
  })
})
