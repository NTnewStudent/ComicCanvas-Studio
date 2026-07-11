/**
 * Agent settings IPC handlers.
 * @see docs/api-contracts/agents.md
 */

import { z } from 'zod'

import type {
  AgentDefinition,
  AgentIpcValidationError,
  AgentRunRequest,
  AgentToolApprovalInput,
  SpawnSubAgentInput,
  SpawnSubAgentResult
} from '../../../../shared/agents'
import { CANONICAL_AGENT_ROLE_IDS } from '../../../../shared/agents'
import type { OrchestratorRuntime } from '../agent/orchestrator'
import type { AgentRegistry } from '../agent/registry'
import type { IpcRegistrar } from './types'

export interface AgentHandlerOptions {
  registry: AgentRegistry
  runtime?: Pick<OrchestratorRuntime, 'agentRun' | 'approveTool' | 'denyTool' | 'getRun'>
  spawnSubAgent?: (input: SpawnSubAgentInput) => Promise<SpawnSubAgentResult> | SpawnSubAgentResult
}

const boundedIdentifierSchema = z.string().trim().min(1).max(256)

const agentToolApprovalInputSchema = z.object({
  runId: boundedIdentifierSchema,
  callId: boundedIdentifierSchema,
  approvedBy: boundedIdentifierSchema,
  scope: z.enum(['once', 'run', 'session']).optional()
}).strict()

const agentToolDenialInputSchema = z.object({
  runId: boundedIdentifierSchema,
  callId: boundedIdentifierSchema,
  deniedBy: boundedIdentifierSchema
}).strict()

const spawnSubAgentInputSchema = z.object({
  roleId: z.enum(CANONICAL_AGENT_ROLE_IDS),
  task: z.string().trim().min(1).max(4000)
}).strict()

function invalidAgentRequest(action: 'approveTool' | 'denyTool' | 'spawn'): AgentIpcValidationError {
  return {
    errorClass: 'agent_invalid_request',
    message: `Invalid agent.${action} request.`,
    retryable: false
  }
}

function includeDisabled(request: unknown): boolean {
  return typeof request === 'object' && request !== null && 'includeDisabled' in request && request.includeDisabled === true
}

function agentId(request: unknown): string {
  return typeof request === 'object' && request !== null && 'agentId' in request ? String(request.agentId) : ''
}

function runId(request: unknown): string {
  return typeof request === 'object' && request !== null && 'runId' in request ? String(request.runId) : ''
}

function runtimeUnavailable(): { errorClass: 'agent_runtime_unavailable'; message: string; retryable: false } {
  return {
    errorClass: 'agent_runtime_unavailable',
    message: 'Agent runtime is unavailable.',
    retryable: false
  }
}

/**
 * Registers agent settings invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Agent registry dependency.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/agents.md
 */
export function registerAgentHandlers(ipcMain: IpcRegistrar, options: AgentHandlerOptions): void {
  ipcMain.handle('agent.list', (_event, request) => options.registry.list({ includeDisabled: includeDisabled(request) }))
  ipcMain.handle('agent.save', (_event, request) => options.registry.save(request as AgentDefinition))
  ipcMain.handle('agent.delete', (_event, request) => options.registry.delete(agentId(request)))
  ipcMain.handle('agent.run', (_event, request) => options.runtime?.agentRun(request as AgentRunRequest) ?? runtimeUnavailable())
  ipcMain.handle('agent.getRun', (_event, request) => options.runtime?.getRun(runId(request)) ?? runtimeUnavailable())
  ipcMain.handle('agent.approveTool', (_event, request) => {
    const parsed = agentToolApprovalInputSchema.safeParse(request)
    if (!parsed.success) return invalidAgentRequest('approveTool')
    return options.runtime?.approveTool(parsed.data as AgentToolApprovalInput) ?? runtimeUnavailable()
  })
  ipcMain.handle('agent.denyTool', (_event, request) => {
    const parsed = agentToolDenialInputSchema.safeParse(request)
    if (!parsed.success) return invalidAgentRequest('denyTool')
    return options.runtime?.denyTool(parsed.data) ?? runtimeUnavailable()
  })
  ipcMain.handle('agent.spawn', (_event, request) => {
    const parsed = spawnSubAgentInputSchema.safeParse(request)
    if (!parsed.success) return invalidAgentRequest('spawn')
    return options.spawnSubAgent?.(parsed.data) ?? runtimeUnavailable()
  })
}
