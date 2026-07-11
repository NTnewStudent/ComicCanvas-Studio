/**
 * Knowledge store, scoped retrieval, and context pack contracts.
 * @see docs/api-contracts/knowledge-context.md
 */

export type KnowledgeSourceType = 'file' | 'asset' | 'note' | 'document'

export type KnowledgeStatus = 'pending' | 'indexed' | 'failed' | 'deleted'

export type RetrievalMode = 'lexical' | 'embedding' | 'hybrid'

export interface KnowledgeScope {
  projectId: string
  workspaceId?: string
  userApprovedSourceIds: string[]
}

export interface KnowledgeIngestRequest {
  sourceType: KnowledgeSourceType
  sourceRef: string
  scope: KnowledgeScope
  metadata?: Record<string, unknown>
}

export interface KnowledgeDocument {
  id: string
  sourceType: KnowledgeSourceType
  sourceRef: string
  scope: KnowledgeScope
  status: KnowledgeStatus
  createdAt: number
  updatedAt: number
}

export interface KnowledgeChunk {
  id: string
  documentId: string
  ordinal: number
  text: string
  score?: number
  citation: {
    sourceRef: string
    title?: string
    range?: string
  }
  metadata: Record<string, unknown>
}

export interface KnowledgeQuery {
  query: string
  scope: KnowledgeScope
  limit: number
  retrievalMode: RetrievalMode
}

export interface ContextSource {
  kind: 'policy' | 'userMessage' | 'canvas' | 'asset' | 'knowledge' | 'message' | 'summary'
  refId: string
  priority: number
}

export interface ContextBuildInput {
  agentId: string
  userMessage: string
  scope: KnowledgeScope
  selectedNodeIds: string[]
  selectedAssetIds: string[]
  tokenBudget: number
}

export interface ContextPack {
  id: string
  agentId: string
  sources: ContextSource[]
  omissions: string[]
  warnings: string[]
  redactions: string[]
  tokenEstimate: number
  createdAt: number
}
