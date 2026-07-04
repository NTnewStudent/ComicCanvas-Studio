import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createWorkflowRepository } from '../desktop/src/main/db/repositories/workflow.repo'
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler'
import type { CanvasGraphSnapshot } from '../shared/graph'
import type { NodeType } from '../shared/nodes'

type Handler = (_event: unknown, request: unknown) => unknown

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

const graph: CanvasGraphSnapshot = {
  nodes: [
    {
      id: 'image-cover',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        label: 'Cover',
        promptOverride: '',
        modelId: 'stub-image',
        orientation: 'landscape',
        assetId: 'asset-cover',
        status: 'done',
        url: 'cc-asset://asset/asset-cover'
      }
    },
    {
      id: 'video-running',
      type: 'video',
      position: { x: 320, y: 0 },
      data: {
        label: 'Video',
        promptOverride: '',
        modelId: 'stub-video',
        orientation: 'landscape',
        durationSeconds: 3,
        firstFrameAssetId: null,
        lastFrameAssetId: null,
        assetId: null,
        status: 'running'
      }
    },
    {
      id: 'legacy',
      type: 'legacyNode' as NodeType,
      position: { x: 640, y: 0 },
      data: { label: 'Legacy' }
    }
  ],
  edges: [
    { id: 'edge-ok', source: 'image-cover', target: 'video-running', data: { edgeType: 'imageRole', imageRole: 'reference', createdAt: 1 } },
    { id: 'edge-bad', source: 'legacy', target: 'video-running', data: { edgeType: 'default', createdAt: 2 } }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
}

describe('Phase A workflow project repository', () => {
  it('returns hjwall parity project metadata from latest workflow graph', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-project-'))
    const dbPath = join(tempDir, 'workflow-project.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({
        id: 'workflow-1',
        name: 'Storyboard',
        coverAssetId: 'asset-manual-cover',
        archived: false,
        createdAt: 1_784_100_000_000,
        updatedAt: 1_784_100_000_000
      })
      workflows.addVersion({
        id: 'version-1',
        workflowId: 'workflow-1',
        graph,
        createdAt: 1_784_100_000_100,
        createdBy: 'test'
      })

      expect(workflows.getSummary('workflow-1')).toMatchObject({
        id: 'workflow-1',
        name: 'Storyboard',
        nodeCount: 3,
        edgeCount: 2,
        coverAssetId: 'asset-manual-cover',
        latestRunStatus: 'running',
        defaultStylePresetId: null,
        archived: false,
        warningSummary: {
          unsupportedNodes: 1,
          invalidEdges: 1
        }
      })
      expect(workflows.getSummary('workflow-1')?.versionChecksum).toMatch(/^[a-f0-9]{64}$/u)
      expect(workflows.list()[0]).toMatchObject({
        id: 'workflow-1',
        edgeCount: 2,
        coverAssetId: 'asset-manual-cover',
        latestRunStatus: 'running',
        archived: false
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('lists immutable graph versions with debug metadata and restores by creating a new version', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-versions-'))
    const dbPath = join(tempDir, 'workflow-versions.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({
        id: 'workflow-versions',
        name: 'Versioned storyboard',
        createdAt: 1_784_100_000_000,
        updatedAt: 1_784_100_000_000
      })
      const oldNode = graph.nodes[0]
      if (!oldNode) {
        throw new Error('expected fixture graph node')
      }
      workflows.addVersion({
        id: 'version-old',
        workflowId: 'workflow-versions',
        graph: { nodes: [oldNode], edges: [], viewport: graph.viewport },
        createdAt: 1_784_100_000_100,
        createdBy: 'user-a'
      })
      workflows.addVersion({
        id: 'version-new',
        workflowId: 'workflow-versions',
        graph,
        createdAt: 1_784_100_000_200,
        createdBy: 'user-b'
      })

      expect(workflows.listVersions('workflow-versions')).toMatchObject([
        {
          id: 'version-new',
          createdBy: 'user-b',
          nodeCount: 3,
          edgeCount: 2,
          restoreSourceVersionId: null,
          warningSummary: { unsupportedNodes: 1, invalidEdges: 1 }
        },
        {
          id: 'version-old',
          createdBy: 'user-a',
          nodeCount: 1,
          edgeCount: 0,
          restoreSourceVersionId: null,
          warningSummary: { unsupportedNodes: 0, invalidEdges: 0 }
        }
      ])
      expect(workflows.listVersions('workflow-versions')[0]?.checksum).toMatch(/^[a-f0-9]{64}$/u)

      const restored = workflows.restoreVersion({
        workflowId: 'workflow-versions',
        sourceVersionId: 'version-old',
        restoredVersionId: 'version-restored',
        createdAt: 1_784_100_000_300,
        createdBy: 'user-restore'
      })

      expect(restored).toMatchObject({
        id: 'version-restored',
        workflowId: 'workflow-versions',
        createdBy: 'user-restore',
        restoreSourceVersionId: 'version-old'
      })
      expect(workflows.getLatestVersion('workflow-versions')?.id).toBe('version-restored')
      expect(workflows.listVersions('workflow-versions')[0]).toMatchObject({
        id: 'version-restored',
        createdBy: 'user-restore',
        nodeCount: 1,
        restoreSourceVersionId: 'version-old'
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('repository create() alone leaves no version row (version creation is the caller\'s responsibility)', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-create-'))
    const dbPath = join(tempDir, 'workflow-create.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({
        id: 'workflow-fresh',
        name: 'Fresh workflow',
        createdAt: 1_784_200_000_000,
        updatedAt: 1_784_200_000_000
      })

      // Repository-level create() intentionally does not insert a version —
      // callers (IPC handlers, import, copyTemplate) decide when to add one.
      expect(workflows.getLatestVersion('workflow-fresh')).toBeNull()
      expect(workflows.getSummary('workflow-fresh')).toMatchObject({
        id: 'workflow-fresh',
        nodeCount: 0,
        edgeCount: 0
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('canvas.createWorkflow IPC handler inserts an initial version so a fresh workflow is never version-less', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-ipc-create-'))
    const dbPath = join(tempDir, 'workflow-ipc-create.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      const { ipcMain, handlers } = createFakeIpcMain()
      let now = 1_784_400_000_000
      let versionIndex = 0
      registerCanvasHandlers(ipcMain, {
        workflows,
        clock: () => now++,
        idFactory: () => `graph-version-${++versionIndex}`
      })

      const created = handlers.get('canvas.createWorkflow')?.({}, { name: '未命名工作流' }) as { id: string; name: string }

      expect(workflows.getLatestVersion(created.id)).toMatchObject({
        workflowId: created.id,
        graph: { nodes: [], edges: [] }
      })
      expect(workflows.getSummary(created.id)).toMatchObject({
        id: created.id,
        nodeCount: 0,
        edgeCount: 0
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('renames a workflow and soft-deletes it out of list()/getSummary()', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-lifecycle-'))
    const dbPath = join(tempDir, 'workflow-lifecycle.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const workflows = createWorkflowRepository(db)
      workflows.create({
        id: 'workflow-lifecycle',
        name: 'Original name',
        createdAt: 1_784_300_000_000,
        updatedAt: 1_784_300_000_000
      })

      workflows.rename('workflow-lifecycle', 'Renamed workflow')
      expect(workflows.getSummary('workflow-lifecycle')?.name).toBe('Renamed workflow')
      expect(workflows.list().some((summary) => summary.id === 'workflow-lifecycle')).toBe(true)

      workflows.delete('workflow-lifecycle')
      // Soft delete: getSummary()/list() must both stop returning the workflow,
      // matching the `deleted_at IS NULL` filter used by every select statement.
      expect(workflows.getSummary('workflow-lifecycle')).toBeNull()
      expect(workflows.list().some((summary) => summary.id === 'workflow-lifecycle')).toBe(false)
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
