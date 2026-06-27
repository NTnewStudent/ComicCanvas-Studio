/**
 * Canvas snippet library IPC handlers.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { IpcRequestMap, IpcResponseMap } from '../../../../shared/ipc'
import { sanitizeCanvasSnippet, validateCanvasSnippet } from '../../../../shared/snippets'
import type { CanvasSnippetRepository } from '../db/repositories/canvas-snippet.repo'
import type { IpcRegistrar } from './types'

export interface CanvasSnippetHandlerOptions {
  snippets?: CanvasSnippetRepository
  clock?: () => number
  idFactory?: () => string
}

export function registerCanvasSnippetHandlers(ipcMain: IpcRegistrar, options: CanvasSnippetHandlerOptions = {}): void {
  const clock = options.clock ?? Date.now

  ipcMain.handle('canvasSnippet.list', () => options.snippets?.list() ?? [])

  ipcMain.handle('canvasSnippet.save', (_event, request) => {
    const input = sanitizeCanvasSnippet(request as IpcRequestMap['canvasSnippet.save'])
    const validation = validateCanvasSnippet(input)

    if (validation) {
      return validation
    }

    return options.snippets?.save(input, clock(), options.idFactory) ?? {
      id: input.id ?? options.idFactory?.() ?? 'snippet-preview',
      schemaVersion: 1,
      name: input.name,
      nodeCount: input.nodes.length,
      edgeCount: input.edges.length,
      nodes: input.nodes,
      edges: input.edges,
      createdAt: clock(),
      updatedAt: clock(),
    }
  })

  ipcMain.handle('canvasSnippet.delete', (_event, request) => {
    const input = request as IpcRequestMap['canvasSnippet.delete']
    options.snippets?.delete(input.snippetId, clock())
    return { snippetId: input.snippetId, deleted: true as const }
  })
}
