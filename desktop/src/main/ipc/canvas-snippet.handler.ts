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
  currentUserId?: string
}

export function registerCanvasSnippetHandlers(ipcMain: IpcRegistrar, options: CanvasSnippetHandlerOptions = {}): void {
  const clock = options.clock ?? Date.now
  const currentUserId = options.currentUserId ?? 'user-local'

  ipcMain.handle('canvasSnippet.list', (_event, request) => options.snippets?.list(request as IpcRequestMap['canvasSnippet.list']) ?? [])

  ipcMain.handle('canvasSnippet.get', (_event, request) => {
    const input = request as IpcRequestMap['canvasSnippet.get']
    const snippet = options.snippets?.getById(input.snippetId) ?? null
    return snippet ?? {
      errorClass: 'not_found' as const,
      message: 'Snippet not found.',
      retryable: false as const,
    }
  })

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
      scope: input.scope ?? 'my',
      ownerId: input.ownerId ?? currentUserId,
      ownedByCurrentUser: (input.ownerId ?? currentUserId) === currentUserId,
      ...(input.description ? { description: input.description } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      ...(input.thumbnailUrl ? { thumbnailUrl: input.thumbnailUrl } : {}),
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
    const result = options.snippets?.delete(input.snippetId, clock(), currentUserId) ?? 'deleted'
    if (result === 'deleted') {
      return { snippetId: input.snippetId, deleted: true as const }
    }

    return {
      snippetId: input.snippetId,
      deleted: false as const,
      errorClass: result === 'permission-denied' ? 'permission_denied' as const : 'not_found' as const,
      message: result === 'permission-denied' ? 'Only owned snippets can be deleted.' : 'Snippet not found.',
      retryable: false as const,
    }
  })
}
