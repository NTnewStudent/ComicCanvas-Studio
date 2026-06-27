/**
 * Canvas snippet library contracts shared by renderer, IPC, and repositories.
 * @see docs/api-contracts/canvas-plan.md
 */

import { sanitizeCanvasGraphSnapshot, type CanvasGraphEdge, type CanvasGraphNode } from './graph'

export interface CanvasSnippetSaveInput {
  id?: string
  name: string
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
}

export interface CanvasSnippetView {
  id: string
  schemaVersion: 1
  name: string
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
  deleted: true
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

  return {
    ...input,
    name: input.name.trim() || 'Untitled snippet',
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
