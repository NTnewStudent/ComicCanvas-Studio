/**
 * Canvas snippet repository for reusable local canvas subgraphs.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { CanvasGraphEdge, CanvasGraphNode } from '../../../../../shared/graph'
import {
  sanitizeCanvasSnippet,
  validateCanvasSnippet,
  type CanvasSnippetListRequest,
  type CanvasSnippetSaveInput,
  type CanvasSnippetView,
} from '../../../../../shared/snippets'
import { decodeJson, encodeJson } from './json'

interface CanvasSnippetRow {
  id: string
  schema_version: number
  name: string
  description: string | null
  scope: CanvasSnippetView['scope']
  owner_id: string
  tags_json: string
  thumbnail_url: string | null
  nodes_json: string
  edges_json: string
  node_count: number
  edge_count: number
  created_at: number
  updated_at: number
}

export interface CanvasSnippetRepository {
  list(filter?: CanvasSnippetListRequest): CanvasSnippetView[]
  getById(snippetId: string): CanvasSnippetView | null
  save(input: CanvasSnippetSaveInput, timestamp: number, idFactory?: () => string): CanvasSnippetView
  delete(snippetId: string, timestamp: number, currentUserId?: string): 'deleted' | 'not-found' | 'permission-denied'
}

function snippetFromRow(row: CanvasSnippetRow): CanvasSnippetView {
  const tags = decodeJson<unknown>(row.tags_json)
  const snippetTags = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : []
  return {
    id: row.id,
    schemaVersion: 1,
    name: row.name,
    scope: row.scope === 'public' ? 'public' : 'my',
    ownerId: row.owner_id,
    ownedByCurrentUser: row.owner_id === 'user-local',
    nodeCount: row.node_count,
    edgeCount: row.edge_count,
    nodes: decodeJson<CanvasGraphNode[]>(row.nodes_json) ?? [],
    edges: decodeJson<CanvasGraphEdge[]>(row.edges_json) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.description !== null ? { description: row.description } : {}),
    ...(snippetTags.length > 0 ? { tags: snippetTags } : {}),
    ...(row.thumbnail_url !== null ? { thumbnailUrl: row.thumbnail_url } : {}),
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
  const selectByScope = db.prepare(`
    SELECT * FROM canvas_snippets
    WHERE deleted_at IS NULL AND scope = ?
    ORDER BY updated_at DESC, created_at DESC, id ASC
  `)
  const selectById = db.prepare('SELECT * FROM canvas_snippets WHERE id = ? AND deleted_at IS NULL')
  const upsertSnippet = db.prepare(`
    INSERT INTO canvas_snippets (
      id, schema_version, name, description, scope, owner_id, tags_json, thumbnail_url,
      nodes_json, edges_json, node_count, edge_count, created_at, updated_at
    )
    VALUES (
      @id, 1, @name, @description, @scope, @ownerId, @tagsJson, @thumbnailUrl,
      @nodesJson, @edgesJson, @nodeCount, @edgeCount, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      schema_version = 1,
      name = excluded.name,
      description = excluded.description,
      scope = excluded.scope,
      owner_id = excluded.owner_id,
      tags_json = excluded.tags_json,
      thumbnail_url = excluded.thumbnail_url,
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
    list(filter = {}) {
      const scope = filter.scope === 'public' || filter.scope === 'my' ? filter.scope : null
      const rows = scope ? selectByScope.all(scope) : selectAll.all()
      return (rows as CanvasSnippetRow[]).map(snippetFromRow)
    },
    getById(snippetId) {
      const row = selectById.get(snippetId) as CanvasSnippetRow | undefined
      return row ? snippetFromRow(row) : null
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
        description: snippet.description ?? null,
        scope: snippet.scope ?? 'my',
        ownerId: snippet.ownerId ?? 'user-local',
        tagsJson: encodeJson(snippet.tags ?? []),
        thumbnailUrl: snippet.thumbnailUrl ?? null,
        nodesJson: encodeJson(snippet.nodes),
        edgesJson: encodeJson(snippet.edges),
        nodeCount: snippet.nodes.length,
        edgeCount: snippet.edges.length,
        createdAt: existing?.created_at ?? timestamp,
        updatedAt: timestamp,
      })

      return snippetFromRow(selectById.get(id) as CanvasSnippetRow)
    },
    delete(snippetId, timestamp, currentUserId = 'user-local') {
      const row = selectById.get(snippetId) as CanvasSnippetRow | undefined
      if (!row) return 'not-found'
      if (row.owner_id !== currentUserId) return 'permission-denied'
      return softDeleteSnippet.run({ snippetId, deletedAt: timestamp }).changes > 0 ? 'deleted' : 'not-found'
    },
  }
}
