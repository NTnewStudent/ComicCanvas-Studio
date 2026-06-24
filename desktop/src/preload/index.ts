/**
 * Sandboxed preload bridge for renderer-safe APIs.
 * @see docs/api-contracts/audit-observability.md
 */

import { contextBridge, ipcRenderer } from 'electron'

import type { AssetChangedEvent, IpcEventChannel, IpcEventMap, IpcRequestMap, IpcResponseMap } from '../../../shared/ipc'
import type { JobTerminalEvent } from '../../../shared/jobs'

export interface ComicCanvasApi {
  health(): Promise<{ status: 'ok' | 'degraded' | 'failed'; checkedAt: number }>
  runCanvasNode(input: IpcRequestMap['canvas.runNode']): Promise<IpcResponseMap['canvas.runNode']>
  sendCanvasChat(input: IpcRequestMap['canvas.chatSend']): Promise<IpcResponseMap['canvas.chatSend']>
  getCanvasPlan(input: IpcRequestMap['canvas.chatGetPlan']): Promise<IpcResponseMap['canvas.chatGetPlan']>
  listGateways(): Promise<IpcResponseMap['gateway.list']>
  saveGateway(input: IpcRequestMap['gateway.save']): Promise<IpcResponseMap['gateway.save']>
  deleteGateway(input: IpcRequestMap['gateway.delete']): Promise<IpcResponseMap['gateway.delete']>
  testGateway(input: IpcRequestMap['gateway.test']): Promise<IpcResponseMap['gateway.test']>
  reloadGateways(input: IpcRequestMap['gateway.reload']): Promise<IpcResponseMap['gateway.reload']>
  onJobCompleted(handler: (event: Extract<JobTerminalEvent, { channel: 'job.completed' }>) => void): () => void
  onJobFailed(handler: (event: Extract<JobTerminalEvent, { channel: 'job.failed' }>) => void): () => void
  onAssetChanged(handler: (event: AssetChangedEvent) => void): () => void
  onCanvasPlanReady(handler: (event: IpcEventMap['canvas.planReady']) => void): () => void
}

type SubscribableEventChannel = Extract<IpcEventChannel, 'job.completed' | 'job.failed' | 'asset.changed' | 'canvas.planReady'>

/**
 * Invokes a whitelisted main-process channel from typed preload APIs only.
 * @param channel - The whitelisted channel name.
 * @returns The typed response for the channel.
 * @throws Error when the main process rejects the invoke request.
 * @see docs/api-contracts/audit-observability.md
 * @see docs/api-contracts/gateway-providers.md
 */
function invokeMain<TResponse>(channel: 'app.health'): Promise<TResponse>
function invokeMain<TChannel extends 'canvas.runNode'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.chatSend'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.chatGetPlan'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.save'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.delete'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.test'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.reload'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TResponse>(channel: string, request?: unknown): Promise<TResponse> {
  return ipcRenderer.invoke(channel, request) as Promise<TResponse>
}

/**
 * Subscribes a renderer-safe handler to a whitelisted main-process event channel.
 * @param channel - The whitelisted event channel.
 * @param handler - Typed event payload handler.
 * @returns Unsubscribe callback that removes the exact listener.
 * @throws Error never intentionally; Electron listener registration errors propagate.
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 */
function subscribeMain<TChannel extends SubscribableEventChannel>(
  channel: TChannel,
  handler: (event: IpcEventMap[TChannel]) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: IpcEventMap[TChannel]) => {
    handler(payload)
  }

  ipcRenderer.on(channel, listener)

  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: ComicCanvasApi = {
  /**
   * Checks that the main process IPC bridge is reachable.
   * @returns A health status from the main process.
   * @throws Error when the main process rejects the health request.
   * @see docs/api-contracts/audit-observability.md
   */
  health: () => invokeMain<{ status: 'ok' | 'degraded' | 'failed'; checkedAt: number }>('app.health'),
  /**
   * Enqueues generation for a renderer canvas node.
   * @param input - Target canvas node identifier.
   * @returns Pending generation job ticket.
   * @throws Error when the main process rejects the run request.
   * @see docs/api-contracts/canvas-plan.md
   */
  runCanvasNode: (input) => invokeMain('canvas.runNode', input),
  /**
   * Sends a natural-language canvas chat request to the orchestrator runtime.
   * @param input - Canvas chat message and optional target agent.
   * @returns Pending agent job ticket and persisted chat message ID.
   * @throws Error when the main process rejects the chat request.
   * @see docs/api-contracts/canvas-plan.md
   */
  sendCanvasChat: (input) => invokeMain('canvas.chatSend', input),
  /**
   * Retrieves the CanvasPlan produced for a completed chat message.
   * @param input - Message lookup request.
   * @returns The available CanvasPlan or a safe clarify plan.
   * @throws Error when the main process rejects the plan lookup request.
   * @see docs/api-contracts/canvas-plan.md
   */
  getCanvasPlan: (input) => invokeMain('canvas.chatGetPlan', input),
  /**
   * Lists configured gateway providers.
   * @returns Gateway configuration views.
   * @throws Error when the main process rejects the gateway list request.
   * @see docs/api-contracts/gateway-providers.md
   */
  listGateways: () => invokeMain('gateway.list', {}),
  /**
   * Saves a gateway provider configuration.
   * @param input - Gateway configuration input.
   * @returns Saved gateway view.
   * @throws Error when the main process rejects the gateway save request.
   * @see docs/api-contracts/gateway-providers.md
   */
  saveGateway: (input) => invokeMain('gateway.save', input),
  /**
   * Deletes a gateway provider configuration.
   * @param input - Gateway deletion request.
   * @returns Deletion confirmation.
   * @throws Error when the main process rejects the gateway delete request.
   * @see docs/api-contracts/gateway-providers.md
   */
  deleteGateway: (input) => invokeMain('gateway.delete', input),
  /**
   * Enqueues a gateway test job.
   * @param input - Gateway test request.
   * @returns Gateway test job ticket.
   * @throws Error when the main process rejects the gateway test request.
   * @see docs/api-contracts/gateway-providers.md
   */
  testGateway: (input) => invokeMain('gateway.test', input),
  /**
   * Hot-reloads configured gateway providers for future jobs.
   * @param input - Optional gateway selection for targeted reload.
   * @returns Reloaded gateway IDs.
   * @throws Error when the main process rejects the gateway reload request.
   * @see docs/api-contracts/gateway-providers.md
   */
  reloadGateways: (input) => invokeMain('gateway.reload', input),
  /**
   * Subscribes to completed job terminal events.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/jobs.md
   */
  onJobCompleted: (handler) => subscribeMain('job.completed', handler),
  /**
   * Subscribes to failed job terminal events.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/jobs.md
   */
  onJobFailed: (handler) => subscribeMain('job.failed', handler),
  /**
   * Subscribes to asset library change events.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/assets-files.md
   */
  onAssetChanged: (handler) => subscribeMain('asset.changed', handler)
  ,
  /**
   * Subscribes to CanvasPlan readiness events after async orchestration completes.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/canvas-plan.md
   */
  onCanvasPlanReady: (handler) => subscribeMain('canvas.planReady', handler)
}

contextBridge.exposeInMainWorld('comicCanvas', api)
