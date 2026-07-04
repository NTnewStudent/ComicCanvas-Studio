/**
 * Canvas snippet library contracts shared by renderer, IPC, and repositories.
 * @see docs/api-contracts/canvas-plan.md
 */

import { sanitizeCanvasGraphSnapshot, type CanvasGraphEdge, type CanvasGraphNode } from './graph'

export type CanvasSnippetScope = 'my' | 'public'

export interface CanvasSnippetSaveInput {
  id?: string
  name: string
  description?: string
  scope?: CanvasSnippetScope
  ownerId?: string
  tags?: string[]
  thumbnailUrl?: string
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
}

export interface CanvasSnippetListRequest {
  scope?: CanvasSnippetScope | 'all'
}

export interface CanvasSnippetGetRequest {
  snippetId: string
}

export interface CanvasSnippetView {
  id: string
  schemaVersion: 1
  name: string
  description?: string
  scope: CanvasSnippetScope
  ownerId: string
  ownedByCurrentUser: boolean
  tags?: string[]
  thumbnailUrl?: string
  nodeCount: number
  edgeCount: number
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
  createdAt: number
  updatedAt: number
}

export interface CanvasSnippetDeleteRequest {
  snippetId: string
}

export interface CanvasSnippetDeleteResponse {
  snippetId: string
  deleted: boolean
  errorClass?: 'not_found' | 'permission_denied'
  message?: string
  retryable?: false
}

export interface CanvasSnippetValidationError {
  errorClass: 'validation_error'
  message: string
  retryable: false
}

export type CanvasSnippetSaveResponse = CanvasSnippetView | CanvasSnippetValidationError

export function sanitizeCanvasSnippet(input: CanvasSnippetSaveInput): CanvasSnippetSaveInput {
  const graph = sanitizeCanvasGraphSnapshot({
    nodes: input.nodes,
    edges: input.edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  })
  const tags = input.tags?.filter((tag) => tag.trim().length > 0).map((tag) => tag.trim())

  return {
    ...input,
    name: input.name.trim() || 'Untitled snippet',
    scope: input.scope === 'public' ? 'public' : 'my',
    ownerId: typeof input.ownerId === 'string' && input.ownerId.trim().length > 0 ? input.ownerId.trim() : 'user-local',
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(typeof input.description === 'string' ? { description: input.description.trim() } : {}),
    ...(typeof input.thumbnailUrl === 'string' && input.thumbnailUrl.trim().length > 0 ? { thumbnailUrl: input.thumbnailUrl.trim() } : {}),
    nodes: graph.nodes,
    edges: graph.edges,
  }
}

export function validateCanvasSnippet(input: CanvasSnippetSaveInput): CanvasSnippetValidationError | null {
  if (sanitizeCanvasSnippet(input).nodes.length < 2) {
    return {
      errorClass: 'validation_error',
      message: 'Snippet requires at least two valid nodes.',
      retryable: false,
    }
  }

  return null
}
