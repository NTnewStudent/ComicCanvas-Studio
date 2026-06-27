import { describe, expect, it } from 'vitest'

import type { JobCreateInput } from '../shared/jobs'
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler'

type Handler = (_event: unknown, request: unknown) => unknown

function createFakeIpcMain(): { handlers: Map<string, Handler>; ipcMain: { handle(channel: string, handler: Handler): void } } {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      },
    },
  }
}

describe('REQ-096 migrated node run dispatch', () => {
  it('enqueues audio nodes as typed audio jobs with media metadata', () => {
    const enqueued: JobCreateInput[] = []
    const { ipcMain, handlers } = createFakeIpcMain()

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      graphStore: {
        getGraph: () => ({
          nodes: [
            {
              id: 'audio-1',
              type: 'audio',
              position: { x: 0, y: 0 },
              data: {
                label: 'Narration',
                assetId: 'asset-audio-1',
                url: 'cc-asset://asset/asset-audio-1',
                durationSeconds: 12,
                status: 'idle',
              },
            },
          ],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: 'job-audio-1', status: 'pending', createdAt: 1 }
        },
      },
    })

    expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'audio-1' })).toEqual({
      jobId: 'job-audio-1',
      status: 'pending',
      createdAt: 1,
    })
    expect(enqueued).toEqual([
      {
        type: 'canvas.generateAudio',
        targetId: 'audio-1',
        payload: {
          nodeId: 'audio-1',
          nodeType: 'audio',
          inputs: [
            {
              nodeId: 'audio-1',
              role: 'audio',
              assetId: 'asset-audio-1',
              url: 'cc-asset://asset/asset-audio-1',
            },
          ],
          parameters: { durationSeconds: 12 },
        },
        requestedBy: { type: 'user', id: 'user-1' },
      },
    ])
  })

  it('enqueues mjImage as a multi-result image job with semantic prompt context', () => {
    const enqueued: JobCreateInput[] = []
    const { ipcMain, handlers } = createFakeIpcMain()

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      graphStore: {
        getGraph: () => ({
          nodes: [
            {
              id: 'character-1',
              type: 'character',
              position: { x: 0, y: 0 },
              data: { label: 'Mika', description: 'blue coat, brave pilot', assetId: 'asset-character' },
            },
            {
              id: 'scene-1',
              type: 'scene',
              position: { x: 0, y: 160 },
              data: { label: 'Hangar', description: 'rainy neon aircraft hangar', assetId: 'asset-scene' },
            },
            {
              id: 'mj-1',
              type: 'mjImage',
              position: { x: 260, y: 80 },
              data: {
                label: 'MJ keyframe',
                prompt: 'dramatic key art',
                modelId: 'mj-v6',
                ratio: '16:9',
                status: 'idle',
                assetId: null,
              },
            },
          ],
          edges: [
            { id: 'edge-character', source: 'character-1', target: 'mj-1', data: { edgeType: 'promptOrder', createdAt: 1 } },
            { id: 'edge-scene', source: 'scene-1', target: 'mj-1', data: { edgeType: 'promptOrder', createdAt: 2 } },
          ],
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: 'job-mj-1', status: 'pending', createdAt: 1 }
        },
      },
    })

    expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'mj-1' })).toEqual({
      jobId: 'job-mj-1',
      status: 'pending',
      createdAt: 1,
    })
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0]).toMatchObject({
      type: 'canvas.generateImage',
      targetId: 'mj-1',
      requestedBy: { type: 'user', id: 'user-1' },
      payload: {
        nodeId: 'mj-1',
        nodeType: 'mjImage',
        prompt: '参考图像：\nCharacter Mika: blue coat, brave pilot\nScene Hangar: rainy neon aircraft hangar\nMJ Image MJ keyframe: dramatic key art',
        modelKey: 'mj-v6',
        parameters: { ratio: '16:9', resultMode: 'multiImage' },
        references: [
          { assetId: 'asset-character', role: 'reference', mediaType: 'image' },
          { assetId: 'asset-scene', role: 'reference', mediaType: 'image' },
        ],
      },
    })
  })

  it('enqueues composition, super-resolution, and mux nodes with typed payloads', () => {
    const enqueued: JobCreateInput[] = []
    const { ipcMain, handlers } = createFakeIpcMain()

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      graphStore: {
        getGraph: () => ({
          nodes: [
            {
              id: 'video-a',
              type: 'video',
              position: { x: 0, y: 0 },
              data: {
                label: 'Shot A',
                promptOverride: 'opening shot',
                modelId: 'stub-video',
                orientation: 'landscape',
                durationSeconds: 4,
                firstFrameAssetId: null,
                lastFrameAssetId: null,
                assetId: 'asset-video-a',
                url: 'cc-asset://asset/asset-video-a',
                status: 'done',
              },
            },
            {
              id: 'video-b',
              type: 'video',
              position: { x: 0, y: 180 },
              data: {
                label: 'Shot B',
                promptOverride: 'closing shot',
                modelId: 'stub-video',
                orientation: 'landscape',
                durationSeconds: 5,
                firstFrameAssetId: null,
                lastFrameAssetId: null,
                assetId: 'asset-video-b',
                url: 'cc-asset://asset/asset-video-b',
                status: 'done',
              },
            },
            {
              id: 'audio-1',
              type: 'audio',
              position: { x: 0, y: 360 },
              data: { label: 'Narration', assetId: 'asset-audio-1', url: 'cc-asset://asset/asset-audio-1', durationSeconds: 9, status: 'done' },
            },
            {
              id: 'compose-1',
              type: 'videoCompose',
              position: { x: 280, y: 60 },
              data: { label: 'Compose', inputOrder: ['video-b', 'video-a'], transitionName: 'crossfade', modelId: 'compose-local', status: 'idle' },
            },
            {
              id: 'sr-1',
              type: 'superResolution',
              position: { x: 560, y: 60 },
              data: { label: 'Upscale', scene: 'aigc', resolution: '4k', fps: 24, status: 'idle' },
            },
            {
              id: 'mux-1',
              type: 'muxAudioVideo',
              position: { x: 840, y: 60 },
              data: { label: 'Mux', modelId: 'mux-local', status: 'idle' },
            },
          ],
          edges: [
            { id: 'edge-va-compose', source: 'video-a', target: 'compose-1', data: { edgeType: 'default', createdAt: 1 } },
            { id: 'edge-vb-compose', source: 'video-b', target: 'compose-1', data: { edgeType: 'default', createdAt: 2 } },
            { id: 'edge-compose-sr', source: 'compose-1', target: 'sr-1', data: { edgeType: 'default', createdAt: 3 } },
            { id: 'edge-video-mux', source: 'video-a', target: 'mux-1', data: { edgeType: 'default', createdAt: 4 } },
            { id: 'edge-audio-mux', source: 'audio-1', target: 'mux-1', data: { edgeType: 'default', createdAt: 5 } },
          ],
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: `job-${enqueued.length}`, status: 'pending', createdAt: enqueued.length }
        },
      },
    })

    expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'compose-1' })).toMatchObject({ jobId: 'job-1' })
    expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'sr-1' })).toMatchObject({ jobId: 'job-2' })
    expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'mux-1' })).toMatchObject({ jobId: 'job-3' })

    expect(enqueued[0]).toMatchObject({
      type: 'canvas.composeVideo',
      targetId: 'compose-1',
      payload: {
        nodeId: 'compose-1',
        nodeType: 'videoCompose',
        modelKey: 'compose-local',
        inputs: [
          { nodeId: 'video-b', assetId: 'asset-video-b', role: 'video', url: 'cc-asset://asset/asset-video-b' },
          { nodeId: 'video-a', assetId: 'asset-video-a', role: 'video', url: 'cc-asset://asset/asset-video-a' },
        ],
        parameters: { transitionName: 'crossfade' },
      },
    })
    expect(enqueued[1]).toMatchObject({
      type: 'canvas.upscaleVideo',
      targetId: 'sr-1',
      payload: {
        nodeId: 'sr-1',
        nodeType: 'superResolution',
        inputs: [{ nodeId: 'compose-1', role: 'video' }],
        parameters: { scene: 'aigc', resolution: '4k', fps: 24 },
      },
    })
    expect(enqueued[2]).toMatchObject({
      type: 'canvas.muxAudioVideo',
      targetId: 'mux-1',
      payload: {
        nodeId: 'mux-1',
        nodeType: 'muxAudioVideo',
        modelKey: 'mux-local',
        inputs: [
          { nodeId: 'video-a', assetId: 'asset-video-a', role: 'video', url: 'cc-asset://asset/asset-video-a' },
          { nodeId: 'audio-1', assetId: 'asset-audio-1', role: 'audio', url: 'cc-asset://asset/asset-audio-1' },
        ],
      },
    })
  })
})
