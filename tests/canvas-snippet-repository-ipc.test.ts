import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createCanvasSnippetRepository } from '../desktop/src/main/db/repositories/canvas-snippet.repo'
import { registerCanvasSnippetHandlers } from '../desktop/src/main/ipc/canvas-snippet.handler'
import type { IpcInvokeChannel } from '../shared/ipc'
import type { CanvasSnippetView } from '../shared/snippets'

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

const snippetGraph = {
  nodes: [
    {
      id: 'text-1',
      type: 'text' as const,
      position: { x: 0, y: 0 },
      data: { label: 'Prompt', content: 'rainy cyberpunk alley' },
    },
    {
      id: 'image-1',
      type: 'image' as const,
      position: { x: 320, y: 40 },
      data: {
        label: 'Image',
        promptOverride: 'rainy cyberpunk alley',
        modelId: 'stub-image',
        orientation: 'landscape',
        assetId: null,
        status: 'idle' as const,
      },
    },
  ],
  edges: [
    {
      id: 'edge-text-image',
      source: 'text-1',
      target: 'image-1',
      data: { edgeType: 'promptOrder' as const, createdAt: 1_783_800_000_000 },
    },
  ],
}

async function withSnippets(
  run: (dependencies: {
    handlers: Map<string, Handler>
    repo: ReturnType<typeof createCanvasSnippetRepository>
  }) => Promise<void> | void
): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-snippets-'))
  const dbPath = join(tempDir, 'snippets.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    const repo = createCanvasSnippetRepository(db)
    const { ipcMain, handlers } = createFakeIpcMain()
    registerCanvasSnippetHandlers(ipcMain, {
      snippets: repo,
      clock: () => 1_783_800_000_000,
      idFactory: () => 'snippet-generated',
    })
    await run({ handlers, repo })
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('REQ-092 persisted canvas snippets', () => {
  it('registers canvas snippet library IPC handlers', () => {
    const { ipcMain, handlers } = createFakeIpcMain()

    registerCanvasSnippetHandlers(ipcMain)

    expect(Array.from(handlers.keys()).sort()).toEqual([
      'canvasSnippet.delete',
      'canvasSnippet.list',
      'canvasSnippet.save',
    ] satisfies IpcInvokeChannel[])
  })

  it('persists snippets, sanitizes invalid edges, and lists newest snippets first', async () => {
    await withSnippets(async ({ handlers }) => {
      await handlers.get('canvasSnippet.save')?.({}, {
        id: 'snippet-old',
        name: 'Old snippet',
        nodes: snippetGraph.nodes,
        edges: snippetGraph.edges,
      })
      await handlers.get('canvasSnippet.save')?.({}, {
        id: 'snippet-new',
        name: 'New snippet',
        nodes: snippetGraph.nodes,
        edges: [
          ...snippetGraph.edges,
          {
            id: 'edge-invalid',
            source: 'text-1',
            target: 'missing-node',
            data: { edgeType: 'promptOrder', createdAt: 1 },
          },
        ],
      })

      const list = await handlers.get('canvasSnippet.list')?.({}, {}) as CanvasSnippetView[]

      expect(list.map((snippet) => snippet.id)).toEqual(['snippet-new', 'snippet-old'])
      expect(list[0]).toMatchObject({
        id: 'snippet-new',
        schemaVersion: 1,
        name: 'New snippet',
        nodeCount: 2,
        edgeCount: 1,
        nodes: snippetGraph.nodes,
        edges: snippetGraph.edges,
        createdAt: 1_783_800_000_000,
        updatedAt: 1_783_800_000_000,
      })
    })
  })

  it('rejects snippets with fewer than two valid nodes and soft-deletes saved snippets', async () => {
    await withSnippets(async ({ handlers, repo }) => {
      expect(await handlers.get('canvasSnippet.save')?.({}, {
        id: 'snippet-too-small',
        name: 'Too small',
        nodes: [snippetGraph.nodes[0]],
        edges: [],
      })).toEqual({
        errorClass: 'validation_error',
        message: 'Snippet requires at least two valid nodes.',
        retryable: false,
      })

      await handlers.get('canvasSnippet.save')?.({}, {
        id: 'snippet-delete',
        name: 'Delete me',
        nodes: snippetGraph.nodes,
        edges: snippetGraph.edges,
      })

      expect(await handlers.get('canvasSnippet.delete')?.({}, { snippetId: 'snippet-delete' })).toEqual({
        snippetId: 'snippet-delete',
        deleted: true,
      })
      expect(repo.list()).toEqual([])
    })
  })
})
