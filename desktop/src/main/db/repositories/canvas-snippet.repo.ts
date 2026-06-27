/**
 * Canvas snippet repository for reusable local canvas subgraphs.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { CanvasGraphEdge, CanvasGraphNode } from '../../../../../shared/graph'
import {
  sanitizeCanvasSnippet,
  validateCanvasSnippet,
  type CanvasSnippetSaveInput,
  type CanvasSnippetView,
} from '../../../../../shared/snippets'
import { decodeJson, encodeJson } from './json'

interface CanvasSnippetRow {
  id: string
  schema_version: number
  name: string
  nodes_json: string
  edges_json: string
  node_count: number
  edge_count: number
  created_at: number
  updated_at: number
}

export interface CanvasSnippetRepository {
  list(): CanvasSnippetView[]
  save(input: CanvasSnippetSaveInput, timestamp: number, idFactory?: () => string): CanvasSnippetView
  delete(snippetId: string, timestamp: number): boolean
}

function snippetFromRow(row: CanvasSnippetRow): CanvasSnippetView {
  return {
    id: row.id,
    schemaVersion: 1,
    name: row.name,
    nodeCount: row.node_count,
    edgeCount: row.edge_count,
    nodes: decodeJson<CanvasGraphNode[]>(row.nodes_json) ?? [],
    edges: decodeJson<CanvasGraphEdge[]>(row.edges_json) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeSnippetId(input: CanvasSnippetSaveInput, idFactory?: () => string): string {
  return input.id ?? idFactory?.() ?? `snippet-${crypto.randomUUID()}`
}

export function createCanvasSnippetRepository(db: BetterSqliteDatabase): CanvasSnippetRepository {
  const selectAll = db.prepare(`
    SELECT * FROM canvas_snippets
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC, created_at DESC, id ASC
  `)
  const selectById = db.prepare('SELECT * FROM canvas_snippets WHERE id = ? AND deleted_at IS NULL')
  const upsertSnippet = db.prepare(`
    INSERT INTO canvas_snippets (
      id, schema_version, name, nodes_json, edges_json, node_count, edge_count, created_at, updated_at
    )
    VALUES (
      @id, 1, @name, @nodesJson, @edgesJson, @nodeCount, @edgeCount, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      schema_version = 1,
      name = excluded.name,
      nodes_json = excluded.nodes_json,
      edges_json = excluded.edges_json,
      node_count = excluded.node_count,
      edge_count = excluded.edge_count,
      updated_at = excluded.updated_at,
      deleted_at = NULL
  `)
  const softDeleteSnippet = db.prepare(`
    UPDATE canvas_snippets
    SET deleted_at = @deletedAt, updated_at = @deletedAt
    WHERE id = @snippetId AND deleted_at IS NULL
  `)

  return {
    list() {
      return (selectAll.all() as CanvasSnippetRow[]).map(snippetFromRow)
    },
    save(input, timestamp, idFactory) {
      const validation = validateCanvasSnippet(input)
      if (validation) {
        throw new Error(validation.message)
      }

      const snippet = sanitizeCanvasSnippet(input)
      const id = normalizeSnippetId(input, idFactory)
      const existing = selectById.get(id) as CanvasSnippetRow | undefined

      upsertSnippet.run({
        id,
        name: snippet.name,
        nodesJson: encodeJson(snippet.nodes),
        edgesJson: encodeJson(snippet.edges),
        nodeCount: snippet.nodes.length,
        edgeCount: snippet.edges.length,
        createdAt: existing?.created_at ?? timestamp,
        updatedAt: timestamp,
      })

      return snippetFromRow(selectById.get(id) as CanvasSnippetRow)
    },
    delete(snippetId, timestamp) {
      return softDeleteSnippet.run({ snippetId, deletedAt: timestamp }).changes > 0
    },
  }
}
