/**
 * Knowledge repository for documents, chunks, and context packs.
 * @see docs/api-contracts/knowledge-context.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { ContextPack, KnowledgeChunk, KnowledgeDocument, KnowledgeScope } from '../../../../../shared/knowledge'
import { decodeJson, encodeJson } from './json'

interface KnowledgeDocumentRow {
  id: string
  source_type: string
  source_ref: string
  scope_json: string
  status: string
  metadata_json: string
  created_at: number
  updated_at: number
  deleted_at: number | null
}

interface KnowledgeChunkRow {
  id: string
  document_id: string
  ordinal: number
  text: string
  metadata_json: string
  created_at: number
}

export interface KnowledgeRepository {
  saveDocument(document: KnowledgeDocument, chunks: KnowledgeChunk[]): void
  listDocuments(): KnowledgeDocument[]
  listChunks(documentId: string): KnowledgeChunk[]
  markDeleted(documentId: string, clock: number): void
  saveContextPack(pack: ContextPack): void
  getContextPack(id: string): ContextPack | null
}

function rowToDocument(row: KnowledgeDocumentRow): KnowledgeDocument {
  return {
    id: row.id,
    sourceType: row.source_type as KnowledgeDocument['sourceType'],
    sourceRef: row.source_ref,
    scope: decodeJson<KnowledgeScope>(row.scope_json) ?? { projectId: 'default', userApprovedSourceIds: [] },
    status: row.status as KnowledgeDocument['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToChunk(row: KnowledgeChunkRow): KnowledgeChunk {
  const metadata = decodeJson<Record<string, unknown> & { citation?: KnowledgeChunk['citation'] }>(row.metadata_json) ?? {}
  const citation = metadata.citation ?? { sourceRef: row.document_id }
  const { citation: _citation, ...rest } = metadata
  return {
    id: row.id,
    documentId: row.document_id,
    ordinal: row.ordinal,
    text: row.text,
    citation,
    metadata: rest
  }
}

/**
 * Creates the knowledge repository boundary.
 * @param db - Open SQLite database handle.
 * @returns Knowledge repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/knowledge-context.md
 */
export function createKnowledgeRepository(db: BetterSqliteDatabase): KnowledgeRepository {
  const upsertDocument = db.prepare(`
    INSERT INTO knowledge_documents (id, source_type, source_ref, scope_json, status, metadata_json, created_at, updated_at, deleted_at)
    VALUES (@id, @sourceType, @sourceRef, @scopeJson, @status, @metadataJson, @createdAt, @updatedAt, NULL)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at,
      deleted_at = NULL
  `)
  const selectDocuments = db.prepare(`
    SELECT * FROM knowledge_documents WHERE deleted_at IS NULL ORDER BY updated_at DESC
  `)
  const markDeletedStmt = db.prepare(`
    UPDATE knowledge_documents SET status = 'deleted', deleted_at = @deletedAt, updated_at = @updatedAt WHERE id = @id
  `)
  const deleteChunks = db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?')
  const insertChunk = db.prepare(`
    INSERT INTO knowledge_chunks (id, document_id, ordinal, text, metadata_json, created_at)
    VALUES (@id, @documentId, @ordinal, @text, @metadataJson, @createdAt)
  `)
  const selectChunks = db.prepare(`
    SELECT * FROM knowledge_chunks WHERE document_id = ? ORDER BY ordinal ASC
  `)
  const upsertContextPack = db.prepare(`
    INSERT INTO context_packs (id, agent_run_id, summary_json, source_refs_json, redactions_json, created_at)
    VALUES (@id, @agentRunId, @summaryJson, @sourceRefsJson, @redactionsJson, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      summary_json = excluded.summary_json,
      source_refs_json = excluded.source_refs_json,
      redactions_json = excluded.redactions_json
  `)
  const selectContextPack = db.prepare('SELECT * FROM context_packs WHERE id = ?')

  return {
    saveDocument(document, chunks) {
      upsertDocument.run({
        id: document.id,
        sourceType: document.sourceType,
        sourceRef: document.sourceRef,
        scopeJson: encodeJson(document.scope),
        status: document.status,
        metadataJson: encodeJson({}),
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      })
      deleteChunks.run(document.id)
      for (const chunk of chunks) {
        insertChunk.run({
          id: chunk.id,
          documentId: chunk.documentId,
          ordinal: chunk.ordinal,
          text: chunk.text,
          metadataJson: encodeJson({ ...chunk.metadata, citation: chunk.citation }),
          createdAt: document.updatedAt
        })
      }
    },
    listDocuments() {
      return (selectDocuments.all() as KnowledgeDocumentRow[]).map(rowToDocument)
    },
    listChunks(documentId) {
      return (selectChunks.all(documentId) as KnowledgeChunkRow[]).map(rowToChunk)
    },
    markDeleted(documentId, clock) {
      markDeletedStmt.run({ id: documentId, deletedAt: clock, updatedAt: clock })
      deleteChunks.run(documentId)
    },
    saveContextPack(pack) {
      upsertContextPack.run({
        id: pack.id,
        agentRunId: pack.agentId,
        summaryJson: encodeJson({ agentId: pack.agentId }),
        sourceRefsJson: encodeJson(pack.sources),
        redactionsJson: encodeJson(pack.redactions),
        createdAt: pack.createdAt
      })
    },
    getContextPack(id) {
      const row = selectContextPack.get(id) as {
        id: string
        agent_run_id: string | null
        summary_json: string
        source_refs_json: string
        redactions_json: string
        created_at: number
      } | undefined
      if (!row) {
        return null
      }
      const summary = decodeJson<{ agentId?: string }>(row.summary_json) ?? {}
      return {
        id: row.id,
        agentId: summary.agentId ?? row.agent_run_id ?? 'unknown',
        sources: decodeJson(row.source_refs_json) ?? [],
        redactions: decodeJson<string[]>(row.redactions_json) ?? [],
        createdAt: row.created_at
      }
    }
  }
}
