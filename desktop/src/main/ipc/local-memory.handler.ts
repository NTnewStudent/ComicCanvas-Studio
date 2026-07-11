/** Explicit local-memory write IPC boundary. */

import { z } from 'zod'

import type { LocalMemoryRepository, LocalMemoryScope } from '../db/repositories/local-memory.repo'
import type { AgentArtifactRepository } from '../db/repositories/agent-artifact.repo'
import type { AgentRunRepository } from '../db/repositories/agent-run.repo'
import type { IpcRegistrar } from './types'

export interface LocalMemoryHandlerOptions {
  memories: Pick<LocalMemoryRepository, 'save'>
  artifacts?: Pick<AgentArtifactRepository, 'getById'>
  runs?: Pick<AgentRunRepository, 'getById'>
  currentUserId: string
  clock: () => number
  idFactory: () => string
}

const scopeSchema = z.enum(['user', 'workflow', 'agentRole'])
const saveSchema = z.object({
  scope: scopeSchema,
  content: z.string().trim().min(1).max(4000),
  workflowId: z.string().trim().min(1).max(256).optional(),
  agentRoleId: z.string().trim().min(1).max(256).optional()
}).strict()
const suggestionSchema = z.object({ artifactId: z.string().trim().min(1).max(256), confirmed: z.boolean() }).strict()

function suggestionPayload(value: unknown): { scope: LocalMemoryScope; content: string } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  if ((source.scope !== 'user' && source.scope !== 'workflow' && source.scope !== 'agentRole') || typeof source.content !== 'string' || source.content.trim().length === 0) return null
  return { scope: source.scope, content: source.content.trim() }
}

/** Registers explicit local-memory save and confirmation handlers. */
export function registerLocalMemoryHandlers(ipcMain: IpcRegistrar, options: LocalMemoryHandlerOptions): void {
  ipcMain.handle('memory.save', (_event, request) => {
    const parsed = saveSchema.safeParse(request)
    if (!parsed.success) return { errorClass: 'memory_invalid_request', message: 'Invalid local memory request.', retryable: false }
    const now = options.clock()
    const scope: LocalMemoryScope = parsed.data.scope
    const memory = {
      id: options.idFactory(), scope, content: parsed.data.content, createdAt: now, updatedAt: now,
      ...(scope === 'user' ? { userId: options.currentUserId } : {}),
      ...(scope === 'workflow' && parsed.data.workflowId ? { workflowId: parsed.data.workflowId } : {}),
      ...(scope === 'agentRole' && parsed.data.agentRoleId ? { agentRoleId: parsed.data.agentRoleId } : {})
    }
    options.memories.save(memory)
    return memory
  })
  ipcMain.handle('memory.confirmSuggestion', (_event, request) => {
    const parsed = suggestionSchema.safeParse(request)
    if (!parsed.success) return { errorClass: 'memory_invalid_request', message: 'Invalid memory confirmation.', retryable: false }
    if (!parsed.data.confirmed) return { errorClass: 'memory_confirmation_required', message: 'Memory suggestion requires user confirmation.', retryable: false }
    const artifact = options.artifacts?.getById(parsed.data.artifactId)
    if (!artifact || artifact.kind !== 'memorySuggestion') return { errorClass: 'memory_suggestion_unavailable', message: 'Memory suggestion could not be verified.', retryable: false }
    const suggestion = suggestionPayload(artifact.payload)
    const run = options.runs?.getById(artifact.runId)
    if (!suggestion || !run) return { errorClass: 'memory_suggestion_unavailable', message: 'Memory suggestion could not be verified.', retryable: false }
    const now = options.clock()
    const memory = {
      id: options.idFactory(), scope: suggestion.scope, content: suggestion.content, createdAt: now, updatedAt: now,
      ...(suggestion.scope === 'user' ? { userId: options.currentUserId } : {}),
      ...(suggestion.scope === 'workflow' ? { workflowId: run.workflowId } : {}),
      ...(suggestion.scope === 'agentRole' ? { agentRoleId: run.agentId } : {})
    }
    options.memories.save(memory)
    return memory
  })
}
