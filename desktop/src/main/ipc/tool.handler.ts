/**
 * Tool management IPC handlers.
 * @see docs/api-contracts/tools-plugins.md
 */

import type { IpcRequestMap } from '../../../../shared/ipc'
import type { ToolActor, ToolDescriptor, ToolError } from '../../../../shared/tools'
import type { ToolRuntime } from '../tools/runtime'
import type { IpcRegistrar } from './types'

export interface ToolHandlerOptions {
  runtime: ToolRuntime
  currentUserId: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function includeDisabled(request: unknown): boolean {
  return isObject(request) && request.includeDisabled === true
}

function toolId(request: unknown): string {
  return isObject(request) && typeof request.toolId === 'string' ? request.toolId : ''
}

function invokeRequest(request: unknown): IpcRequestMap['tool.invoke'] {
  if (!isObject(request)) {
    return { toolId: '', input: {}, traceId: 'trace-tool-missing-request' }
  }

  return {
    toolId: typeof request.toolId === 'string' ? request.toolId : '',
    input: 'input' in request ? request.input : {},
    traceId: typeof request.traceId === 'string' ? request.traceId : 'trace-tool-missing'
  }
}

function actorForUser(currentUserId: string): ToolActor {
  return { type: 'user', id: currentUserId }
}

function isToolDescriptor(result: ToolDescriptor | ToolError): result is ToolDescriptor {
  return 'id' in result
}

function requireToolDescriptor(result: ToolDescriptor | ToolError): ToolDescriptor {
  if (isToolDescriptor(result)) {
    return result
  }

  // Settings toggle failures are programmer/configuration errors and should fail the invoke visibly.
  throw new Error(result.message)
}

/**
 * Registers tool management invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Tool runtime and current user context.
 * @returns void.
 * @throws Error when handler registration fails or a requested tool toggle cannot resolve a descriptor.
 * @see docs/api-contracts/tools-plugins.md
 */
export function registerToolHandlers(ipcMain: IpcRegistrar, options: ToolHandlerOptions): void {
  ipcMain.handle('tool.list', (_event, request) => options.runtime.list(includeDisabled(request)))
  ipcMain.handle('tool.invoke', async (_event, request) => {
    const parsed = invokeRequest(request)
    const result = await options.runtime.invoke({
      toolId: parsed.toolId,
      input: parsed.input,
      traceId: parsed.traceId,
      actor: actorForUser(options.currentUserId)
    })

    return result.record
  })
  ipcMain.handle('tool.enable', (_event, request) => requireToolDescriptor(options.runtime.enable(toolId(request))))
  ipcMain.handle('tool.disable', (_event, request) => requireToolDescriptor(options.runtime.disable(toolId(request))))
}
