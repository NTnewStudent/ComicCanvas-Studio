import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { CanvasGraphSnapshot } from '../shared/graph'
import type { NodeType } from '../shared/nodes'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo'
import { createWorkflowRepository } from '../desktop/src/main/db/repositories/workflow.repo'
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler'

type Handler = (_event: unknown, request: unknown) => unknown

interface WorkflowImportResult {
  workflowId: string
  graphVersion: string
  dropped: string[]
}

function createFakeIpcMain(): { handlers: Map<string, Handler>; ipcMain: { handle(channel: string, handler: Handler): void } } {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      }
    }
  }
}

function expectWorkflowImportResult(value: unknown): WorkflowImportResult {
  if (
    typeof value === 'object' &&
    value !== null &&
    'workflowId' in value &&
    'graphVersion' in value &&
    'dropped' in value &&
    typeof value.workflowId === 'string' &&
    typeof value.graphVersion === 'string' &&
    Array.isArray(value.dropped)
  ) {
    return value as WorkflowImportResult
  }
  throw new Error('expected workflow import result')
}

function defaultGraphForTest(): CanvasGraphSnapshot {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
}

const firstGraph: CanvasGraphSnapshot = {
  nodes: [{ id: 'text-old', type: 'text', position: { x: -20, y: 5 }, data: { label: 'Old Prompt', content: 'old city' } }],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
}

const graph: CanvasGraphSnapshot = {
  nodes: [
    { id: 'text-1', type: 'text', position: { x: 10, y: 20 }, data: { label: 'Prompt', content: 'moon city' } },
    {
      id: 'image-1',
      type: 'image',
      position: { x: 360, y: 80 },
      data: {
        label: 'Image',
        promptOverride: '',
        modelId: 'stub-image',
        orientation: 'landscape',
        assetId: null,
        status: 'idle'
      }
    }
  ],
  edges: [
    { id: 'edge-valid', source: 'text-1', target: 'image-1', data: { edgeType: 'promptOrder', createdAt: 10 } },
    { id: 'edge-invalid', source: 'image-1', target: 'text-1', data: { edgeType: 'default', createdAt: 11 } }
  ],
  viewport: { x: 42, y: -12, zoom: 0.75 }
}

const migratedGraph: CanvasGraphSnapshot = {
  nodes: [
    { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'rainy neon alley' } },
    { id: 'character-1', type: 'character', position: { x: 220, y: 0 }, data: { label: 'Detective', description: 'calm lead character', assetId: 'asset-character', tags: ['lead'] } },
    { id: 'scene-1', type: 'scene', position: { x: 220, y: 180 }, data: { label: 'Alley', description: 'wet cyberpunk alley', assetId: null, category: 'exterior' } },
    { id: 'audio-1', type: 'audio', position: { x: 220, y: 360 }, data: { label: 'Rain ambience', assetId: 'asset-audio', url: 'comiccanvas://asset/audio', durationSeconds: 12, status: 'idle' } },
    {
      id: 'image-config-1',
      type: 'imageConfigV2',
      position: { x: 470, y: 0 },
      data: {
        label: 'Image config',
        promptOverride: '',
        modelId: 'stub-image',
        orientation: 'landscape',
        assetId: null,
        status: 'idle',
        prompt: 'cinematic key art',
        ratio: '16:9',
        stylePresetId: 'industrial-ink'
      }
    },
    {
      id: 'mj-1',
      type: 'mjImage',
      position: { x: 720, y: 0 },
      data: {
        label: 'MJ sheet',
        prompt: 'four expressive keyframes',
        modelId: 'mj',
        ratio: '16:9',
        urls: ['comiccanvas://asset/mj-1', 'comiccanvas://asset/mj-2'],
        selectedIndex: 1,
        assetId: 'asset-mj-2',
        status: 'done'
      }
    },
    {
      id: 'video-config-1',
      type: 'videoConfigV2',
      position: { x: 970, y: 0 },
      data: {
        label: 'Video config',
        promptOverride: '',
        modelId: 'stub-video',
        orientation: 'landscape',
        durationSeconds: 6,
        firstFrameAssetId: null,
        lastFrameAssetId: null,
        assetId: null,
        status: 'idle',
        prompt: 'slow tracking shot',
        ratio: '16:9',
        duration: 6,
        resolution: '1080p'
      }
    },
    {
      id: 'video-1',
      type: 'video',
      position: { x: 1220, y: 0 },
      data: {
        label: 'Video',
        promptOverride: '',
        modelId: 'stub-video',
        orientation: 'landscape',
        durationSeconds: 6,
        firstFrameAssetId: null,
        lastFrameAssetId: null,
        assetId: 'asset-video',
        status: 'done'
      }
    },
    { id: 'compose-1', type: 'videoCompose', position: { x: 1470, y: 0 }, data: { label: 'Compose', inputOrder: ['video-1'], transitionName: 'cut', modelId: 'compose', assetId: null, status: 'idle' } },
    { id: 'super-1', type: 'superResolution', position: { x: 1470, y: 180 }, data: { label: 'Upscale', scene: 'aigc', resolution: '4k', fps: 24, assetId: null, status: 'idle' } },
    { id: 'mux-1', type: 'muxAudioVideo', position: { x: 1720, y: 0 }, data: { label: 'Mux', modelId: 'mux', assetId: null, status: 'idle' } },
    {
      id: 'legacy-1',
      type: 'legacyNode' as NodeType,
      position: { x: 1720, y: 180 },
      data: { label: 'Legacy unsupported node', status: 'idle' }
    }
  ],
  edges: [
    { id: 'edge-text-character', source: 'text-1', target: 'character-1', data: { edgeType: 'promptOrder', createdAt: 10 } },
    { id: 'edge-character-image-config', source: 'character-1', target: 'image-config-1', data: { edgeType: 'default', createdAt: 11 } },
    { id: 'edge-image-config-mj', source: 'image-config-1', target: 'mj-1', data: { edgeType: 'default', createdAt: 12 } },
    { id: 'edge-mj-video-config', source: 'mj-1', target: 'video-config-1', data: { edgeType: 'imageRole', imageRole: 'reference', createdAt: 13 } },
    { id: 'edge-video-config-video', source: 'video-config-1', target: 'video-1', data: { edgeType: 'default', createdAt: 14 } },
    { id: 'edge-video-compose', source: 'video-1', target: 'compose-1', data: { edgeType: 'default', createdAt: 15 } },
    { id: 'edge-video-super', source: 'video-1', target: 'super-1', data: { edgeType: 'default', createdAt: 16 } },
    { id: 'edge-video-mux', source: 'video-1', target: 'mux-1', data: { edgeType: 'default', createdAt: 17 } },
    { id: 'edge-audio-mux', source: 'audio-1', target: 'mux-1', data: { edgeType: 'default', createdAt: 18 } },
    { id: 'edge-legacy-mux', source: 'legacy-1', target: 'mux-1', data: { edgeType: 'default', createdAt: 19 } },
    { id: 'edge-scene-legacy', source: 'scene-1', target: 'legacy-1', data: { edgeType: 'default', createdAt: 20 } }
  ],
  viewport: { x: -120, y: 60, zoom: 0.5 }
}

describe('M2 canvas graph save/load IPC', () => {
  it('persists the latest graph version, survives handler recreation, and drops invalid edges', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-graph-'))
    const dbPath = join(tempDir, 'graph.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({ id: 'project-1', name: 'Project 1', createdAt: 100, updatedAt: 100 })

      const first = createFakeIpcMain()
      registerCanvasHandlers(first.ipcMain, {
        workflows,
        clock: () => 150,
        idFactory: () => 'version-0',
        currentUserId: 'test-user'
      })

      const firstSaveResult = await first.handlers.get('canvas.saveGraph')?.({}, { projectId: 'project-1', graph: firstGraph })
      expect(firstSaveResult).toMatchObject({ graphVersion: 'version-0', warnings: [] })

      const latest = createFakeIpcMain()
      registerCanvasHandlers(latest.ipcMain, {
        workflows,
        clock: () => 200,
        idFactory: () => 'version-1',
        currentUserId: 'test-user'
      })
      const saveResult = await latest.handlers.get('canvas.saveGraph')?.({}, { projectId: 'project-1', graph })
      expect(saveResult).toMatchObject({
        graphVersion: 'version-1',
        warnings: [{ code: 'invalid_edge', severity: 'warning' }]
      })

      const second = createFakeIpcMain()
      registerCanvasHandlers(second.ipcMain, { workflows, clock: () => 300, idFactory: () => 'version-2' })
      const loaded = await second.handlers.get('canvas.loadGraph')?.({}, { projectId: 'project-1' })

      expect(loaded).toEqual({
        nodes: graph.nodes,
        edges: [graph.edges[0]],
        viewport: graph.viewport
      })

      const workflowRow = db.prepare('SELECT updated_at FROM workflows WHERE id = ?').get('project-1') as { updated_at: number }
      expect(workflowRow.updated_at).toBe(200)
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('round trips migrated hjwall node data and removes unknown node types with their edges', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-migrated-graph-'))
    const dbPath = join(tempDir, 'graph.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({ id: 'project-migrated', name: 'Migrated nodes', createdAt: 100, updatedAt: 100 })

      const ipc = createFakeIpcMain()
      registerCanvasHandlers(ipc.ipcMain, {
        workflows,
        clock: () => 220,
        idFactory: () => 'version-migrated',
        currentUserId: 'test-user'
      })

      const saveResult = await ipc.handlers.get('canvas.saveGraph')?.({}, { projectId: 'project-migrated', graph: migratedGraph }) as {
        graphVersion: string
        warnings: Array<{ code: string; severity: string }>
      }
      expect(saveResult.graphVersion).toBe('version-migrated')
      expect(saveResult.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'unsupported_node_type', severity: 'warning' }),
        expect.objectContaining({ code: 'invalid_edge', severity: 'warning' })
      ]))

      const loaded = await ipc.handlers.get('canvas.loadGraph')?.({}, { projectId: 'project-migrated' }) as CanvasGraphSnapshot

      expect(loaded.nodes.map((node) => node.type)).toEqual([
        'text',
        'character',
        'scene',
        'audio',
        'imageConfigV2',
        'mjImage',
        'videoConfigV2',
        'video',
        'videoCompose',
        'superResolution',
        'muxAudioVideo'
      ])
      expect(loaded.nodes.find((node) => node.id === 'mj-1')?.data).toEqual(migratedGraph.nodes.find((node) => node.id === 'mj-1')?.data)
      expect(loaded.nodes.find((node) => node.id === 'video-config-1')?.data).toEqual(migratedGraph.nodes.find((node) => node.id === 'video-config-1')?.data)
      expect(loaded.edges.map((edge) => edge.id)).toEqual([
        'edge-text-character',
        'edge-character-image-config',
        'edge-image-config-mj',
        'edge-mj-video-config',
        'edge-video-config-video',
        'edge-video-compose',
        'edge-video-super',
        'edge-video-mux',
        'edge-audio-mux'
      ])
      expect(loaded.viewport).toEqual(migratedGraph.viewport)
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('exports sanitized workflow JSON and imports it as a new workflow without absolute asset paths', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-json-'))
    const dbPath = join(tempDir, 'workflow-json.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({ id: 'project-export', name: 'Export me', createdAt: 100, updatedAt: 100 })

      const ipc = createFakeIpcMain()
      let now = 300
      registerCanvasHandlers(ipc.ipcMain, {
        workflows,
        clock: () => now++,
        idFactory: () => `version-${now}`,
        currentUserId: 'test-user'
      })

      await ipc.handlers.get('canvas.saveGraph')?.({}, { projectId: 'project-export', graph: migratedGraph })

      const exported = await ipc.handlers.get('canvas.exportWorkflow')?.({}, { workflowId: 'project-export' }) as {
        schemaVersion: 1
        name: string
        graph: CanvasGraphSnapshot
      }

      expect(exported).toMatchObject({
        schemaVersion: 1,
        name: 'Export me'
      })
      expect(exported.graph.nodes.map((node) => node.type)).not.toContain('legacyNode')
      expect(JSON.stringify(exported)).not.toMatch(/([A-Za-z]:\\|file:\/\/|\/Users\/|\/tmp\/|apiKey|secret|sk-[A-Za-z0-9_-]{4,})/u)

      const imported = expectWorkflowImportResult(await ipc.handlers.get('canvas.importWorkflow')?.({}, {
        name: 'Imported copy',
        json: JSON.stringify({
          ...exported,
          graph: {
            ...exported.graph,
            nodes: [
              ...exported.graph.nodes,
              {
                id: 'legacy-import',
                type: 'legacyNode',
                position: { x: 0, y: 0 },
                data: { label: 'Drop me' }
              }
            ],
            edges: [
              ...exported.graph.edges,
              { id: 'edge-import-invalid', source: 'legacy-import', target: 'text-1', data: { edgeType: 'default', createdAt: 1 } }
            ]
          }
        })
      }))

      expect(imported.workflowId).toMatch(/^wf-import-/u)
      expect(imported.graphVersion).toMatch(/^version-/u)
      expect(imported.dropped).toEqual(expect.arrayContaining([
        'node:legacy-import:unsupported_type',
        'edge:edge-import-invalid:invalid_connection'
      ]))

      const loaded = await ipc.handlers.get('canvas.loadGraph')?.({}, { projectId: imported.workflowId }) as CanvasGraphSnapshot
      expect(loaded.nodes.map((node) => node.type)).toEqual(exported.graph.nodes.map((node) => node.type))
      expect(loaded.edges.map((edge) => edge.id)).toEqual(exported.graph.edges.map((edge) => edge.id))
      expect(workflows.getSummary(imported.workflowId)).toMatchObject({
        scope: 'draft',
        published: false
      })

      const invalidJson = await ipc.handlers.get('canvas.importWorkflow')?.({}, { json: '{bad json' })
      expect(invalidJson).toEqual({
        errorClass: 'invalid_workflow_json',
        message: 'Workflow import JSON is invalid.',
        retryable: false
      })

      const invalidSchema = await ipc.handlers.get('canvas.importWorkflow')?.({}, {
        json: JSON.stringify({ schemaVersion: 2, name: 'Bad schema', graph: defaultGraphForTest() })
      })
      expect(invalidSchema).toEqual({
        errorClass: 'invalid_workflow_json',
        message: 'Workflow import JSON is invalid.',
        retryable: false
      })

      const absolutePath = await ipc.handlers.get('canvas.importWorkflow')?.({}, {
        json: JSON.stringify({
          schemaVersion: 1,
          name: 'Unsafe',
          graph: {
            nodes: [{
              id: 'image-abs',
              type: 'image',
              position: { x: 0, y: 0 },
              data: {
                label: 'Unsafe image',
                promptOverride: '',
                modelId: 'stub-image',
                orientation: 'landscape',
                assetId: null,
                status: 'idle',
                url: 'C:\\\\Users\\\\demo\\\\image.png'
              }
            }],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 }
          }
        })
      })
      expect(absolutePath).toEqual({
        errorClass: 'unsafe_workflow_json',
        message: 'Workflow import JSON cannot contain absolute file paths.',
        retryable: false
      })

      const secretPayload = await ipc.handlers.get('canvas.importWorkflow')?.({}, {
        json: JSON.stringify({
          schemaVersion: 1,
          name: 'Unsafe secret',
          graph: {
            nodes: [{
              id: 'text-secret',
              type: 'text',
              position: { x: 0, y: 0 },
              data: { label: 'Secret', content: 'use sk-live-secret in prompt', apiKey: 'sk-live-secret' }
            }],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 }
          }
        })
      })
      expect(secretPayload).toEqual({
        errorClass: 'unsafe_workflow_json',
        message: 'Workflow import JSON cannot contain secrets.',
        retryable: false
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('lists workflow versions with debug metadata and restores one as a new latest graph version', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-restore-'))
    const dbPath = join(tempDir, 'workflow-restore.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({ id: 'project-restore', name: 'Restore me', createdAt: 100, updatedAt: 100 })

      const ipc = createFakeIpcMain()
      let now = 400
      let id = 0
      registerCanvasHandlers(ipc.ipcMain, {
        workflows,
        clock: () => now++,
        idFactory: () => `version-restore-${id++}`,
        currentUserId: 'test-user'
      })

      await ipc.handlers.get('canvas.saveGraph')?.({}, { projectId: 'project-restore', graph: firstGraph })
      await ipc.handlers.get('canvas.saveGraph')?.({}, { projectId: 'project-restore', graph: migratedGraph })

      const versions = await ipc.handlers.get('canvas.listWorkflowVersions')?.({}, {
        workflowId: 'project-restore',
        limit: 10
      }) as Array<{
        id: string
        checksum: string
        nodeCount: number
        edgeCount: number
        warningSummary: { unsupportedNodes: number; invalidEdges: number }
      }>

      expect(versions).toHaveLength(2)
      expect(versions[0]).toMatchObject({
        id: 'version-restore-1',
        nodeCount: 11,
        edgeCount: 9,
        warningSummary: { unsupportedNodes: 1, invalidEdges: 2 }
      })
      expect(versions[0]?.checksum).toMatch(/^[a-f0-9]{64}$/u)

      const restored = await ipc.handlers.get('canvas.restoreWorkflowVersion')?.({}, {
        workflowId: 'project-restore',
        versionId: 'version-restore-0'
      })

      expect(restored).toMatchObject({
        workflowId: 'project-restore',
        graphVersion: 'version-restore-2',
        restoredFromVersionId: 'version-restore-0',
        warningSummary: { unsupportedNodes: 0, invalidEdges: 0 }
      })

      const loaded = await ipc.handlers.get('canvas.loadGraph')?.({}, { projectId: 'project-restore' }) as CanvasGraphSnapshot
      expect(loaded).toEqual(firstGraph)
      expect(workflows.listVersions('project-restore')[0]).toMatchObject({
        id: 'version-restore-2',
        restoreSourceVersionId: 'version-restore-0'
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('syncs saved canvas asset references so safe delete is blocked', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-graph-asset-references-'))
    const dbPath = join(tempDir, 'graph-asset-references.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      const assets = createAssetRepository(db)
      workflows.create({ id: 'project-references', name: 'References', createdAt: 100, updatedAt: 100 })
      assets.create({
        id: 'asset-character',
        mediaType: 'image',
        status: 'ready',
        relativePath: 'imported/image/character.png',
        safeUrl: 'cc-asset://asset/asset-character',
        metadata: { width: 512, height: 512, orientation: 'square' },
        createdAt: 100,
        updatedAt: 100
      })

      const ipc = createFakeIpcMain()
      registerCanvasHandlers(ipc.ipcMain, {
        workflows,
        assets,
        clock: () => 240,
        idFactory: () => 'version-references',
        currentUserId: 'test-user'
      })

      await ipc.handlers.get('canvas.saveGraph')?.({}, {
        projectId: 'project-references',
        graph: {
          nodes: [{
            id: 'character-node',
            type: 'character',
            position: { x: 0, y: 0 },
            data: { label: 'Hero', description: '', assetId: 'asset-character', url: 'cc-asset://asset/asset-character', tags: [] }
          }],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      })

      expect(assets.trashAsset({ assetId: 'asset-character', mode: 'safe' }, 250)).toMatchObject({
        status: 'rejected',
        blockingReferences: [{ assetId: 'asset-character', refType: 'node', refId: 'character-node' }]
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('persists lenient draft validation warnings and blocks strict run validation', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-graph-validation-'))
    const dbPath = join(tempDir, 'graph-validation.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({ id: 'project-validation', name: 'Validation', createdAt: 100, updatedAt: 100 })
      const invalidReferenceGraph: CanvasGraphSnapshot = {
        nodes: [
          {
            id: 'image-invalid',
            type: 'image',
            position: { x: 0, y: 0 },
            data: {
              label: 'Invalid image',
              promptOverride: 'missing refs',
              modelId: 'missing-model',
              orientation: 'landscape',
              assetId: 'asset-missing',
              status: 'idle',
              stylePresetId: 'style-missing'
            }
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
      const enqueued: unknown[] = []
      const ipc = createFakeIpcMain()
      registerCanvasHandlers(ipc.ipcMain, {
        workflows,
        assets: createAssetRepository(db),
        styles: {
          list: () => [],
          getProjectDefault: () => null
        },
        graphStore: {
          getGraph: () => invalidReferenceGraph
        },
        queue: {
          enqueue(input) {
            enqueued.push(input)
            return { jobId: 'job-should-not-run', status: 'pending', createdAt: 1 }
          }
        },
        availableModelIds: ['stub-image'],
        clock: () => 260,
        idFactory: () => 'version-validation',
        currentUserId: 'test-user'
      })

      const saved = await ipc.handlers.get('canvas.saveGraph')?.({}, {
        projectId: 'project-validation',
        graph: invalidReferenceGraph
      }) as { graphVersion: string; warnings: Array<{ code: string }> }

      expect(saved.graphVersion).toBe('version-validation')
      expect(saved.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
        'unavailable_model',
        'unavailable_style',
        'unavailable_asset'
      ]))
      expect(workflows.listVersions('project-validation')[0]).toMatchObject({
        id: 'version-validation',
        warningSummary: {
          unavailableModels: 1,
          unavailableStyles: 1,
          unavailableAssets: 1
        }
      })

      const strictValidation = await ipc.handlers.get('canvas.validateGraph')?.({}, {
        workflowId: 'project-validation',
        graph: invalidReferenceGraph,
        mode: 'strict'
      }) as { valid: boolean; issues: Array<{ severity: string }> }

      expect(strictValidation.valid).toBe(false)
      expect(strictValidation.issues.every((issue) => issue.severity === 'error')).toBe(true)

      const runResult = await ipc.handlers.get('canvas.runNode')?.({}, {
        workflowId: 'project-validation',
        nodeId: 'image-invalid'
      })

      expect(runResult).toMatchObject({
        errorClass: 'workflow_validation_failed',
        retryable: false
      })
      expect(enqueued).toEqual([])
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
