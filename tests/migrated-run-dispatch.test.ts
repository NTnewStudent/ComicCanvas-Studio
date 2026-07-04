import { describe, expect, it } from 'vitest'

import type { JobCreateInput } from '../shared/jobs'
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler'
import type { AssetRepository } from '../desktop/src/main/db/repositories/asset.repo'

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
  it('enqueues text nodes as typed text polish jobs with current content', async () => {
    const enqueued: JobCreateInput[] = []
    const { ipcMain, handlers } = createFakeIpcMain()

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      graphStore: {
        getGraph: () => ({
          nodes: [
            {
              id: 'text-1',
              type: 'text',
              position: { x: 0, y: 0 },
              data: {
                label: 'Opening beat',
                content: 'rough line',
                polishModelId: 'text-polish-local',
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
          return { jobId: 'job-text-polish-1', status: 'pending', createdAt: 1 }
        },
      },
    })

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'text-1' })).resolves.toEqual({
      jobId: 'job-text-polish-1',
      status: 'pending',
      createdAt: 1,
    })
    expect(enqueued).toEqual([
      {
        type: 'canvas.polishText',
        targetId: 'text-1',
        payload: {
          nodeId: 'text-1',
          nodeType: 'text',
          content: 'rough line',
          modelKey: 'text-polish-local',
        },
        requestedBy: { type: 'user', id: 'user-1' },
      },
    ])
  })

  it('enqueues audio nodes as typed audio jobs with media metadata', async () => {
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

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'audio-1' })).resolves.toEqual({
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

  it('enqueues videoConfigV2 as a video job with uploaded first-frame cloud URL', async () => {
    const enqueued: JobCreateInput[] = []
    const uploaded: string[] = []
    const { ipcMain, handlers } = createFakeIpcMain()

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      assets: {
        getById(assetId: string) {
          return {
            id: assetId,
            mediaType: 'image',
            status: 'ready',
            relativePath: `generated/image/${assetId}.png`,
            safeUrl: `cc-asset://asset/${assetId}`,
            metadata: { mimeType: 'image/png' },
            createdAt: 1,
            updatedAt: 1,
          }
        },
      } as Pick<AssetRepository, 'getById'> as AssetRepository,
      assetUrlResolver: {
        async resolveAssetUrl(asset) {
          uploaded.push(asset.id)
          return { url: `https://cdn.example.test/assets/${asset.id}.png`, source: 'cloud' }
        },
      },
      graphStore: {
        getGraph: () => ({
          nodes: [
            {
              id: 'image-result-1',
              type: 'image',
              position: { x: 0, y: 0 },
              data: {
                label: 'Generated key frame',
                assetId: 'asset-image-generated',
                url: 'cc-asset://asset/asset-image-generated',
                status: 'done',
              },
            },
            {
              id: 'video-config-1',
              type: 'videoConfigV2',
              position: { x: 320, y: 0 },
              data: {
                label: 'Animate key frame',
                promptOverride: 'slow camera push',
                modelId: 'stub-video',
                durationSeconds: 4,
                resolution: '1080p',
                status: 'idle',
                assetId: null,
              },
            },
          ],
          edges: [
            { id: 'edge-first-frame', source: 'image-result-1', target: 'video-config-1', data: { edgeType: 'imageRole', imageRole: 'first_frame', createdAt: 1 } },
          ],
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: 'job-video-config-1', status: 'pending', createdAt: 1 }
        },
      },
    })

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'video-config-1' })).resolves.toEqual({
      jobId: 'job-video-config-1',
      status: 'pending',
      createdAt: 1,
    })
    expect(uploaded).toEqual(['asset-image-generated'])
    expect(enqueued[0]).toMatchObject({
      type: 'canvas.generateVideo',
      targetId: 'video-config-1',
      requestedBy: { type: 'user', id: 'user-1' },
      payload: {
        nodeId: 'video-config-1',
        nodeType: 'videoConfigV2',
        prompt: '参考图像：\nslow camera push',
        modelKey: 'stub-video',
        parameters: { durationSeconds: 4, resolution: '1080p' },
        references: [
          {
            assetId: 'asset-image-generated',
            role: 'first_frame',
            url: 'https://cdn.example.test/assets/asset-image-generated.png',
            mediaType: 'image',
          },
        ],
      },
    })
  })

  it('keeps legacy mjImage compatible without enabling MJ multi-result behavior', async () => {
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

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'mj-1' })).resolves.toEqual({
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
        prompt: '参考图像：\nCharacter Mika: blue coat, brave pilot\nScene Hangar: rainy neon aircraft hangar',
        modelKey: 'mj-v6',
        parameters: { ratio: '16:9' },
        references: [
          { assetId: 'asset-character', role: 'reference', mediaType: 'image' },
          { assetId: 'asset-scene', role: 'reference', mediaType: 'image' },
        ],
      },
    })
    expect(enqueued[0]?.payload.parameters).not.toHaveProperty('resultMode')
  })

  it('enqueues composition, super-resolution, and mux nodes with typed payloads', async () => {
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
            { id: 'edge-vb-sr', source: 'video-b', target: 'sr-1', data: { edgeType: 'default', createdAt: 3 } },
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

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'compose-1' })).resolves.toMatchObject({ jobId: 'job-1' })
    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'sr-1' })).resolves.toMatchObject({ jobId: 'job-2' })
    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'mux-1' })).resolves.toMatchObject({ jobId: 'job-3' })

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
        inputs: [{ nodeId: 'video-b', role: 'video' }],
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

  it('refreshes configured cloud asset URLs before enqueueing runtime references', async () => {
    const enqueued: JobCreateInput[] = []
    const { ipcMain, handlers } = createFakeIpcMain()
    const assets = {
      getById(assetId: string) {
        return {
          id: assetId,
          mediaType: assetId.includes('audio') ? 'audio' : 'video',
          status: 'ready',
          relativePath: `imported/${assetId}.bin`,
          safeUrl: `cc-asset://asset/${assetId}`,
          url: `https://stale.example.test/${assetId}.bin?sig=old`,
          s3Key: `assets/${assetId}.bin`,
          metadata: {},
          createdAt: 1,
          updatedAt: 1,
        }
      },
    } as Pick<AssetRepository, 'getById'> as AssetRepository

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      assets,
      assetUrlResolver: {
        async resolveAssetUrl(asset) {
          return { url: `https://fresh.example.test/${asset.s3Key}`, source: 'cloud' }
        },
      },
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
              id: 'audio-1',
              type: 'audio',
              position: { x: 0, y: 180 },
              data: { label: 'Narration', assetId: 'asset-audio-1', url: 'cc-asset://asset/asset-audio-1', durationSeconds: 9, status: 'done' },
            },
            {
              id: 'mux-1',
              type: 'muxAudioVideo',
              position: { x: 300, y: 80 },
              data: { label: 'Mux', modelId: 'mux-local', status: 'idle' },
            },
          ],
          edges: [
            { id: 'edge-video-mux', source: 'video-a', target: 'mux-1', data: { edgeType: 'default', createdAt: 1 } },
            { id: 'edge-audio-mux', source: 'audio-1', target: 'mux-1', data: { edgeType: 'default', createdAt: 2 } },
          ],
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: 'job-mux-1', status: 'pending', createdAt: 1 }
        },
      },
    })

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'mux-1' })).resolves.toMatchObject({ jobId: 'job-mux-1' })
    expect(enqueued[0]).toMatchObject({
      payload: {
        inputs: [
          { nodeId: 'video-a', assetId: 'asset-video-a', role: 'video', url: 'https://fresh.example.test/assets/asset-video-a.bin' },
          { nodeId: 'audio-1', assetId: 'asset-audio-1', role: 'audio', url: 'https://fresh.example.test/assets/asset-audio-1.bin' },
        ],
      },
    })
  })

  it('enqueues imageConfigV2 nodes through the runtime snapshot with composed prompt, style, and ratio parameters (R4.4)', async () => {
    const enqueued: JobCreateInput[] = []
    const { ipcMain, handlers } = createFakeIpcMain()

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      graphStore: {
        getGraph: () => ({
          nodes: [
            {
              id: 'text-1',
              type: 'text',
              position: { x: 0, y: 0 },
              data: { label: 'Beat', content: 'rainy hero key art' },
            },
            {
              id: 'image-config-1',
              type: 'imageConfigV2',
              position: { x: 260, y: 0 },
              data: {
                label: 'Image Config',
                promptOverride: '',
                modelId: 'sd-xl',
                orientation: 'landscape',
                ratio: '16:9',
                status: 'idle',
              },
            },
          ],
          edges: [
            { id: 'edge-1', source: 'text-1', target: 'image-config-1', data: { edgeType: 'promptOrder', createdAt: 1 } },
          ],
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: 'job-image-config-1', status: 'pending', createdAt: 1 }
        },
      },
    })

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'image-config-1' })).resolves.toEqual({
      jobId: 'job-image-config-1',
      status: 'pending',
      createdAt: 1,
    })
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0]).toMatchObject({
      type: 'canvas.generateImage',
      targetId: 'image-config-1',
      requestedBy: { type: 'user', id: 'user-1' },
      payload: {
        nodeId: 'image-config-1',
        nodeType: 'imageConfigV2',
        prompt: 'rainy hero key art',
        modelKey: 'sd-xl',
        parameters: { orientation: 'landscape', ratio: '16:9' },
      },
    })
  })

  it('enqueues videoConfigV2 nodes through the runtime snapshot with duration/resolution parameters (R4.4)', async () => {
    const enqueued: JobCreateInput[] = []
    const { ipcMain, handlers } = createFakeIpcMain()

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      graphStore: {
        getGraph: () => ({
          nodes: [
            {
              id: 'video-config-1',
              type: 'videoConfigV2',
              position: { x: 0, y: 0 },
              data: {
                label: 'Video Config',
                promptOverride: 'slow push through rainy alley',
                modelId: 'stub-video',
                orientation: 'landscape',
                ratio: '16:9',
                duration: 8,
                resolution: '720p',
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
          return { jobId: 'job-video-config-1', status: 'pending', createdAt: 1 }
        },
      },
    })

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'video-config-1' })).resolves.toEqual({
      jobId: 'job-video-config-1',
      status: 'pending',
      createdAt: 1,
    })
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0]).toMatchObject({
      type: 'canvas.generateVideo',
      targetId: 'video-config-1',
      requestedBy: { type: 'user', id: 'user-1' },
      payload: {
        nodeId: 'video-config-1',
        nodeType: 'videoConfigV2',
        prompt: 'slow push through rainy alley',
        modelKey: 'stub-video',
        parameters: { orientation: 'landscape', ratio: '16:9', duration: 8, resolution: '720p' },
      },
    })
  })
})
