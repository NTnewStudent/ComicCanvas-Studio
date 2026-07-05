/**
 * Knowledge and context IPC handlers.
 * @see docs/api-contracts/knowledge-context.md
 */

import type { ContextBuildInput } from '../../../../shared/knowledge'
import { buildAgentContext } from '../knowledge/context-builder'
import type { KnowledgeStore } from '../knowledge/store'
import type { KnowledgeRepository } from '../db/repositories/knowledge.repo'
import type { IpcRegistrar } from './types'

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
  ipcMain.handle('knowledge.ingest', (_event, request) => options.store.ingest(request))
  ipcMain.handle('knowledge.retrieve', (_event, request) => options.store.retrieve(request))
  ipcMain.handle('knowledge.delete', (_event, request) => options.store.delete(request.documentId))
  ipcMain.handle('knowledge.rebuild', (_event, request) => options.store.rebuild(request.projectId))

  ipcMain.handle('context.build', (_event, request: ContextBuildInput) => {
    const built = buildAgentContext({
      agentId: request.agentId,
      policy: {
        includeCanvasGraph: true,
        includeSelectedAssets: request.selectedAssetIds.length > 0,
        includeRecentMessages: true,
        includeKnowledge: true,
        maxContextTokens: request.tokenBudget
      },
      workflowId: request.scope.projectId,
      recentMessages: [],
      knowledgeChunks: options.store.retrieve({
        query: request.userMessage,
        scope: request.scope,
        limit: 5,
        retrievalMode: 'lexical'
      }).map((chunk) => ({
        id: chunk.id,
        text: chunk.text,
        citation: chunk.citation,
        score: chunk.score
      })),
      tokenBudget: request.tokenBudget
    })
    options.repo.saveContextPack(built.pack)
    return built.pack
  })
}
