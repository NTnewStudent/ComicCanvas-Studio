/**
 * KnowledgeStore — ingest, chunk, retrieve, delete, and rebuild scoped documents.
 * @see docs/api-contracts/knowledge-context.md
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeIngestRequest,
  KnowledgeQuery,
  KnowledgeScope
} from '../../../../shared/knowledge'
import type { KnowledgeRepository } from '../db/repositories/knowledge.repo'
import { lexicalRetrieve } from './context-builder'

export interface KnowledgeStore {
  ingest(request: KnowledgeIngestRequest): KnowledgeDocument
  retrieve(query: KnowledgeQuery): KnowledgeChunk[]
  delete(documentId: string): { documentId: string; deleted: true }
  rebuild(projectId: string): { projectId: string; rebuilt: true; documentCount: number }
}

function chunkText(text: string, documentId: string, sourceRef: string): KnowledgeChunk[] {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  return paragraphs.map((paragraph, index) => ({
    id: `${documentId}-chunk-${index}`,
    documentId,
    ordinal: index,
    text: paragraph,
    citation: {
      sourceRef,
      range: `${index + 1}`
    },
    metadata: {}
  }))
}

function scopeMatches(scope: KnowledgeScope, candidate: KnowledgeScope): boolean {
  if (scope.projectId !== candidate.projectId) {
    return false
  }
  if (scope.workspaceId && candidate.workspaceId && scope.workspaceId !== candidate.workspaceId) {
    return false
  }
  if (scope.userApprovedSourceIds.length === 0) {
    return true
  }
  return scope.userApprovedSourceIds.includes(candidate.projectId)
    || scope.userApprovedSourceIds.includes(candidate.workspaceId ?? '')
}

/**
 * Creates the scoped knowledge store service.
 * @param options - Repository and clock dependencies.
 * @returns Knowledge store API.
 */
export function createKnowledgeStore(options: {
  repo: KnowledgeRepository
  clock?: () => number
  idFactory?: () => string
}): KnowledgeStore {
  const clock = options.clock ?? Date.now
  const idFactory = options.idFactory ?? (() => randomUUID())

  return {
    ingest(request) {
      let text = request.sourceRef
      if (request.sourceType === 'file' || request.sourceType === 'document') {
        text = readFileSync(request.sourceRef, 'utf8')
      }

      const document: KnowledgeDocument = {
        id: idFactory(),
        sourceType: request.sourceType,
        sourceRef: request.sourceRef,
        scope: request.scope,
        status: 'indexed',
        createdAt: clock(),
        updatedAt: clock()
      }

      const chunks = chunkText(text, document.id, request.sourceRef)
      options.repo.saveDocument(document, chunks)
      return document
    },
    retrieve(query) {
      const documents = options.repo.listDocuments().filter((document) => {
        return document.status === 'indexed' && scopeMatches(query.scope, document.scope)
      })

      const chunks = documents.flatMap((document) => options.repo.listChunks(document.id))
      const ranked = lexicalRetrieve(
        query.query,
        chunks.map((chunk) => ({
          id: chunk.id,
          text: chunk.text,
          citation: chunk.citation
        })),
        query.limit
      )

      return ranked.map((entry) => {
        const source = chunks.find((chunk) => chunk.id === entry.id)
        return source ?? {
          id: entry.id,
          documentId: 'unknown',
          ordinal: 0,
          text: entry.text,
          score: entry.score,
          citation: entry.citation,
          metadata: {}
        }
      })
    },
    delete(documentId) {
      options.repo.markDeleted(documentId, clock())
      return { documentId, deleted: true }
    },
    rebuild(projectId) {
      const active = options.repo.listDocuments().filter((document) => {
        return document.scope.projectId === projectId && document.status !== 'deleted'
      })
      return { projectId, rebuilt: true, documentCount: active.length }
    }
  }
}
