/**
 * Agent settings IPC handlers.
 * @see docs/api-contracts/agents.md
 */

import type { AgentDefinition } from '../../../../shared/agents'
import type { AgentRegistry } from '../agent/registry'
import type { IpcRegistrar } from './types'

export interface AgentHandlerOptions {
  registry: AgentRegistry
}

function includeDisabled(request: unknown): boolean {
  return typeof request === 'object' && request !== null && 'includeDisabled' in request && request.includeDisabled === true
}

function agentId(request: unknown): string {
  return typeof request === 'object' && request !== null && 'agentId' in request ? String(request.agentId) : ''
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
}
