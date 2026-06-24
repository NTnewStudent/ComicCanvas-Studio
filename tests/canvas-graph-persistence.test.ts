import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { CanvasGraphSnapshot } from '../shared/graph'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createWorkflowRepository } from '../desktop/src/main/db/repositories/workflow.repo'
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler'

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
      expect(firstSaveResult).toEqual({ graphVersion: 'version-0' })

      const latest = createFakeIpcMain()
      registerCanvasHandlers(latest.ipcMain, {
        workflows,
        clock: () => 200,
        idFactory: () => 'version-1',
        currentUserId: 'test-user'
      })
      const saveResult = await latest.handlers.get('canvas.saveGraph')?.({}, { projectId: 'project-1', graph })
      expect(saveResult).toEqual({ graphVersion: 'version-1' })

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
})
