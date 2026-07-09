/**
 * Knowledge and context IPC handlers.
 * @see docs/api-contracts/knowledge-context.md
 */

import type { ContextBuildInput } from '../../../../shared/knowledge'
import type { KnowledgeIngestRequest, KnowledgeQuery } from '../../../../shared/knowledge'
import { z } from 'zod'

import { buildAgentContext } from '../knowledge/context-builder'
import type { KnowledgeStore } from '../knowledge/store'
import type { KnowledgeRepository } from '../db/repositories/knowledge.repo'
import type { IpcRegistrar } from './types'

const knowledgeScopeSchema = z.object({
  projectId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  userApprovedSourceIds: z.array(z.string())
})

const knowledgeIngestRequestSchema = z.object({
  sourceType: z.enum(['file', 'asset', 'note', 'document']),
  sourceRef: z.string().min(1),
  scope: knowledgeScopeSchema,
  metadata: z.record(z.string(), z.unknown()).optional()
})

const knowledgeQuerySchema = z.object({
  query: z.string(),
  scope: knowledgeScopeSchema,
  limit: z.number().int().positive(),
  retrievalMode: z.enum(['lexical', 'embedding', 'hybrid'])
})

const knowledgeDeleteRequestSchema = z.object({
  documentId: z.string().min(1)
})

const knowledgeRebuildRequestSchema = z.object({
  projectId: z.string().min(1)
})

const contextBuildInputSchema = z.object({
  agentId: z.string().min(1),
  userMessage: z.string(),
  scope: knowledgeScopeSchema,
  selectedNodeIds: z.array(z.string()),
  selectedAssetIds: z.array(z.string()),
  tokenBudget: z.number().int().positive()
})

/**
 * Registers knowledge and context IPC handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Knowledge store and repository dependencies.
 * @see docs/api-contracts/knowledge-context.md
 */
export function registerKnowledgeHandlers(
  ipcMain: IpcRegistrar,
  options: { store: KnowledgeStore; repo: KnowledgeRepository },
): void {
  ipcMain.handle('knowledge.ingest', (_event, request) => {
    return options.store.ingest(knowledgeIngestRequestSchema.parse(request) as KnowledgeIngestRequest)
  })
  ipcMain.handle('knowledge.retrieve', (_event, request) => {
    return options.store.retrieve(knowledgeQuerySchema.parse(request) as KnowledgeQuery)
  })
  ipcMain.handle('knowledge.delete', (_event, request) => {
    return options.store.delete(knowledgeDeleteRequestSchema.parse(request).documentId)
  })
  ipcMain.handle('knowledge.rebuild', (_event, request) => {
    return options.store.rebuild(knowledgeRebuildRequestSchema.parse(request).projectId)
  })

  ipcMain.handle('context.build', (_event, request) => {
    const parsedRequest = contextBuildInputSchema.parse(request) as ContextBuildInput
    const built = buildAgentContext({
      agentId: parsedRequest.agentId,
      policy: {
        includeCanvasGraph: true,
        includeSelectedAssets: parsedRequest.selectedAssetIds.length > 0,
        includeRecentMessages: true,
        includeKnowledge: true,
        maxContextTokens: parsedRequest.tokenBudget
      },
      workflowId: parsedRequest.scope.projectId,
      recentMessages: [],
      knowledgeChunks: options.store.retrieve({
        query: parsedRequest.userMessage,
        scope: parsedRequest.scope,
        limit: 5,
        retrievalMode: 'lexical'
      }).map((chunk) => ({
        id: chunk.id,
        text: chunk.text,
        citation: chunk.citation,
        ...(chunk.score !== undefined ? { score: chunk.score } : {})
      })),
      tokenBudget: parsedRequest.tokenBudget
    })
    options.repo.saveContextPack(built.pack)
    return built.pack
  })
}
