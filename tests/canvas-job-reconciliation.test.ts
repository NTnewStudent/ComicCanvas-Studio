import { describe, expect, it } from 'vitest'

import {
  reconcileCanvasNodesWithJobs,
  type ReconciledCanvasNode,
} from '../desktop/src/renderer/src/canvas/lib/job-reconciliation'
import type { JobRecord } from '../shared/jobs'

const baseNode: ReconciledCanvasNode = {
  id: 'image-node-1',
  type: 'imageConfigV2',
  position: { x: 0, y: 0 },
  data: {
    label: 'Image',
    promptOverride: '',
    modelId: 'stub-image',
    orientation: 'landscape',
    assetId: null,
    status: 'idle',
  },
}

function job(overrides: Partial<JobRecord>): JobRecord {
  return {
    id: 'job-1',
    type: 'canvas.generateImage',
    status: 'completed',
    targetId: 'image-node-1',
    progress: 100,
    result: { kind: 'asset', assetId: 'asset-1' },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('REQ-096 canvas job reconciliation', () => {
  it('marks target nodes done with the generated asset from completed asset jobs', () => {
    const nodes = reconcileCanvasNodesWithJobs([baseNode], [
      job({ result: { kind: 'asset', assetId: 'asset-done' } }),
    ])

    expect(nodes.at(0)?.data).toMatchObject({
      status: 'done',
      assetId: 'asset-done',
    })
  })

  it('marks failed jobs as node errors and pending or processing jobs as pending', () => {
    const failedNode = { ...baseNode, id: 'failed-node' }
    const processingNode = { ...baseNode, id: 'processing-node' }

    const nodes = reconcileCanvasNodesWithJobs([failedNode, processingNode], [
      job({ id: 'failed-job', targetId: 'failed-node', status: 'failed', error: { errorClass: 'provider', message: 'boom', retryable: false } }),
      job({ id: 'processing-job', targetId: 'processing-node', status: 'processing', progress: 30 }),
    ])

    expect(nodes.find((node) => node.id === 'failed-node')?.data).toMatchObject({ status: 'error' })
    expect(nodes.find((node) => node.id === 'processing-node')?.data).toMatchObject({
      status: 'pending',
      assetId: null,
    })
  })

  it('uses the newest job per target and ignores unknown targets or non-asset results', () => {
    const nodes = reconcileCanvasNodesWithJobs([baseNode], [
      job({ id: 'old', updatedAt: 10, result: { kind: 'asset', assetId: 'old-asset' } }),
      job({ id: 'new', updatedAt: 20, result: { kind: 'asset', assetId: 'new-asset' } }),
      job({ id: 'unknown', targetId: 'missing-node', updatedAt: 30, result: { kind: 'asset', assetId: 'wrong-asset' } }),
      job({ id: 'text-result', targetId: 'image-node-1', updatedAt: 5, result: { kind: 'text', text: 'not an asset' } }),
    ])

    expect(nodes).toHaveLength(1)
    expect(nodes.at(0)?.data).toMatchObject({
      status: 'done',
      assetId: 'new-asset',
    })
  })

  it('restores typed migrated jobs from completed report metadata', () => {
    const composeNode: ReconciledCanvasNode = {
      id: 'compose-node',
      type: 'videoCompose',
      position: { x: 0, y: 0 },
      data: {
        label: 'Compose',
        inputOrder: ['video-b', 'video-a'],
        transitionName: 'crossfade',
        modelId: 'compose-local',
        assetId: null,
        status: 'pending',
      },
    }
    const mjNode: ReconciledCanvasNode = {
      id: 'mj-node',
      type: 'mjImage',
      position: { x: 320, y: 0 },
      data: {
        label: 'MJ',
        prompt: 'hero shot',
        modelId: 'mj-v6',
        ratio: '16:9',
        urls: [],
        selectedIndex: 0,
        assetId: null,
        status: 'pending',
      },
    }

    const nodes = reconcileCanvasNodesWithJobs([composeNode, mjNode], [
      job({
        id: 'compose-job',
        type: 'canvas.composeVideo',
        targetId: 'compose-node',
        result: {
          kind: 'report',
          summary: 'composed',
          data: { assetId: 'asset-compose', url: 'cc-asset://asset/asset-compose' },
        },
      }),
      job({
        id: 'mj-job',
        type: 'canvas.generateImage',
        targetId: 'mj-node',
        result: {
          kind: 'report',
          summary: 'multi image',
          data: {
            assetId: 'asset-mj-selected',
            url: 'cc-asset://asset/asset-mj-selected',
            urls: ['cc-asset://asset/mj-1', 'cc-asset://asset/mj-2'],
            selectedIndex: 1,
          },
        },
      }),
    ])

    expect(nodes.find((node) => node.id === 'compose-node')?.data).toMatchObject({
      status: 'done',
      assetId: 'asset-compose',
      url: 'cc-asset://asset/asset-compose',
    })
    expect(nodes.find((node) => node.id === 'mj-node')?.data).toMatchObject({
      status: 'done',
      assetId: 'asset-mj-selected',
      url: 'cc-asset://asset/asset-mj-selected',
      urls: ['cc-asset://asset/mj-1', 'cc-asset://asset/mj-2'],
      selectedIndex: 1,
    })
  })

  it('restores completed audio jobs into audio node status and asset metadata', () => {
    const audioNode: ReconciledCanvasNode = {
      id: 'audio-node',
      type: 'audio',
      position: { x: 0, y: 0 },
      data: {
        label: 'Narration',
        assetId: null,
        durationSeconds: 12,
        status: 'pending',
      },
    }

    const nodes = reconcileCanvasNodesWithJobs([audioNode], [
      job({
        id: 'audio-job',
        type: 'canvas.generateAudio',
        targetId: 'audio-node',
        result: {
          kind: 'report',
          summary: 'audio ready',
          data: { assetId: 'asset-audio-ready', url: 'cc-asset://asset/asset-audio-ready' },
        },
      }),
    ])

    expect(nodes.at(0)?.data).toMatchObject({
      status: 'done',
      assetId: 'asset-audio-ready',
      url: 'cc-asset://asset/asset-audio-ready',
    })
  })
})
