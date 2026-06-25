/**
 * Sandboxed preload bridge for renderer-safe APIs.
 * @see docs/api-contracts/audit-observability.md
 */

import { contextBridge, ipcRenderer } from 'electron'

import type { AssetChangedEvent, IpcEventChannel, IpcEventMap, IpcRequestMap, IpcResponseMap, StorageConfigInput, StorageConnectionTestResult, WorkflowSummaryView } from '../../../shared/ipc'
import type { JobTerminalEvent } from '../../../shared/jobs'

export interface ComicCanvasApi {
  health(): Promise<{ status: 'ok' | 'degraded' | 'failed'; checkedAt: number }>
  runCanvasNode(input: IpcRequestMap['canvas.runNode']): Promise<IpcResponseMap['canvas.runNode']>
  sendCanvasChat(input: IpcRequestMap['canvas.chatSend']): Promise<IpcResponseMap['canvas.chatSend']>
  getCanvasPlan(input: IpcRequestMap['canvas.chatGetPlan']): Promise<IpcResponseMap['canvas.chatGetPlan']>
  listAgents(): Promise<IpcResponseMap['agent.list']>
  saveAgent(input: IpcRequestMap['agent.save']): Promise<IpcResponseMap['agent.save']>
  deleteAgent(input: IpcRequestMap['agent.delete']): Promise<IpcResponseMap['agent.delete']>
  listGateways(): Promise<IpcResponseMap['gateway.list']>
  saveGateway(input: IpcRequestMap['gateway.save']): Promise<IpcResponseMap['gateway.save']>
  deleteGateway(input: IpcRequestMap['gateway.delete']): Promise<IpcResponseMap['gateway.delete']>
  testGateway(input: IpcRequestMap['gateway.test']): Promise<IpcResponseMap['gateway.test']>
  reloadGateways(input: IpcRequestMap['gateway.reload']): Promise<IpcResponseMap['gateway.reload']>
  listTools(): Promise<IpcResponseMap['tool.list']>
  enableTool(input: IpcRequestMap['tool.enable']): Promise<IpcResponseMap['tool.enable']>
  disableTool(input: IpcRequestMap['tool.disable']): Promise<IpcResponseMap['tool.disable']>
  invokeTool(input: IpcRequestMap['tool.invoke']): Promise<IpcResponseMap['tool.invoke']>
  listAssets(input?: IpcRequestMap['asset.list']): Promise<IpcResponseMap['asset.list']>
  moveAsset(input: IpcRequestMap['asset.move']): Promise<IpcResponseMap['asset.move']>
  trashAsset(input: IpcRequestMap['asset.trash']): Promise<IpcResponseMap['asset.trash']>
  getAssetFolders(): Promise<IpcResponseMap['asset.getFolders']>
  createAssetFolder(input: IpcRequestMap['asset.createFolder']): Promise<IpcResponseMap['asset.createFolder']>
  deleteAssetFolder(input: IpcRequestMap['asset.deleteFolder']): Promise<IpcResponseMap['asset.deleteFolder']>
  onJobCompleted(handler: (event: Extract<JobTerminalEvent, { channel: 'job.completed' }>) => void): () => void
  onJobFailed(handler: (event: Extract<JobTerminalEvent, { channel: 'job.failed' }>) => void): () => void
  onAssetChanged(handler: (event: AssetChangedEvent) => void): () => void
  onCanvasPlanReady(handler: (event: IpcEventMap['canvas.planReady']) => void): () => void
  saveGraph(input: IpcRequestMap['canvas.saveGraph']): Promise<IpcResponseMap['canvas.saveGraph']>
  loadGraph(input: IpcRequestMap['canvas.loadGraph']): Promise<IpcResponseMap['canvas.loadGraph']>
  listWorkflows(): Promise<WorkflowSummaryView[]>
  createWorkflow(input: IpcRequestMap['canvas.createWorkflow']): Promise<IpcResponseMap['canvas.createWorkflow']>
  renameWorkflow(input: IpcRequestMap['canvas.renameWorkflow']): Promise<IpcResponseMap['canvas.renameWorkflow']>
  deleteWorkflow(input: IpcRequestMap['canvas.deleteWorkflow']): Promise<IpcResponseMap['canvas.deleteWorkflow']>
  /** Returns the current storage configuration or null. */
  getStorageConfig(): Promise<IpcResponseMap['storage.getConfig']>
  /** Saves a storage configuration. */
  saveStorageConfig(input: StorageConfigInput): Promise<void>
  /** Tests a storage provider connection. */
  testStorageConnection(input: StorageConfigInput): Promise<StorageConnectionTestResult>
}

type SubscribableEventChannel = Extract<IpcEventChannel, 'job.completed' | 'job.failed' | 'asset.changed' | 'canvas.planReady'>

/**
 * Invokes a whitelisted main-process channel from typed preload APIs only.
 * @param channel - The whitelisted channel name.
 * @returns The typed response for the channel.
 * @throws Error when the main process rejects the invoke request.
 * @see docs/api-contracts/audit-observability.md
 * @see docs/api-contracts/gateway-providers.md
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/tools-plugins.md
 * @see docs/api-contracts/assets-files.md
 */
function invokeMain<TResponse>(channel: 'app.health'): Promise<TResponse>
function invokeMain<TChannel extends 'canvas.runNode'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.chatSend'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.chatGetPlan'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.save'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.delete'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.save'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.delete'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.test'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.reload'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'tool.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'tool.enable'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'tool.disable'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'tool.invoke'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.move'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.trash'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.getFolders'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.createFolder'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.deleteFolder'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.saveGraph'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.loadGraph'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.listWorkflows'>(channel: TChannel): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.createWorkflow'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.renameWorkflow'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.deleteWorkflow'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'storage.getConfig'>(channel: TChannel): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'storage.saveConfig'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'storage.testConnection'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
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
   * Lists built-in and custom agent definitions.
   * @returns Agent definitions visible to settings surfaces.
   * @throws Error when the main process rejects the agent list request.
   * @see docs/api-contracts/agents.md
   */
  listAgents: () => invokeMain('agent.list', {}),
  /**
   * Saves a custom user agent definition.
   * @param input - User agent definition to persist.
   * @returns Saved agent definition.
   * @throws Error when the main process rejects the agent save request.
   * @see docs/api-contracts/agents.md
   */
  saveAgent: (input) => invokeMain('agent.save', input),
  /**
   * Deletes a custom user agent definition.
   * @param input - Agent deletion request.
   * @returns Deletion confirmation.
   * @throws Error when the main process rejects the agent delete request.
   * @see docs/api-contracts/agents.md
   */
  deleteAgent: (input) => invokeMain('agent.delete', input),
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
   * Lists built-in and plugin tools visible to settings.
   * @returns Tool descriptors including disabled tools.
   * @throws Error when the main process rejects the tool list request.
   * @see docs/api-contracts/tools-plugins.md
   */
  listTools: () => invokeMain('tool.list', { includeDisabled: true }),
  /**
   * Enables a tool for future invocations.
   * @param input - Tool enable request.
   * @returns Updated tool descriptor.
   * @throws Error when the main process rejects the tool enable request.
   * @see docs/api-contracts/tools-plugins.md
   */
  enableTool: (input) => invokeMain('tool.enable', input),
  /**
   * Disables a tool for future invocations.
   * @param input - Tool disable request.
   * @returns Updated tool descriptor.
   * @throws Error when the main process rejects the tool disable request.
   * @see docs/api-contracts/tools-plugins.md
   */
  disableTool: (input) => invokeMain('tool.disable', input),
  /**
   * Invokes a whitelisted tool through the main-process ToolRuntime.
   * @param input - Tool invocation request.
   * @returns Tool invocation record.
   * @throws Error when the main process rejects the tool invocation request.
   * @see docs/api-contracts/tools-plugins.md
   */
  invokeTool: (input) => invokeMain('tool.invoke', input),
  /**
   * Lists renderer-safe asset records for the local asset library.
   * @param input - Optional folder and media-type filters.
   * @returns Asset records with safe URLs and relative storage paths only.
   * @throws Error when the main process rejects the asset list request.
   * @see docs/api-contracts/assets-files.md
   */
  listAssets: (input = {}) => invokeMain('asset.list', input),
  /**
   * Moves one asset to a folder or back to the library root.
   * @param input - Asset move request.
   * @returns Updated asset record.
   * @throws Error when the main process rejects the asset move request.
   * @see docs/api-contracts/assets-files.md
   */
  moveAsset: (input) => invokeMain('asset.move', input),
  /**
   * Trashes or tombstones an asset with reference-integrity checks.
   * @param input - Asset trash request.
   * @returns Trash result including blocking references for safe mode.
   * @throws Error when the main process rejects the asset trash request.
   * @see docs/api-contracts/assets-files.md
   */
  trashAsset: (input) => invokeMain('asset.trash', input),
  /**
   * Lists active asset folders in path order.
   * @returns Asset folders visible to the renderer library.
   * @throws Error when the main process rejects the folder list request.
   * @see docs/api-contracts/assets-files.md
   */
  getAssetFolders: () => invokeMain('asset.getFolders', {}),
  /**
   * Creates a user asset folder under the selected parent.
   * @param input - Folder creation request.
   * @returns Created folder record.
   * @throws Error when the main process rejects the folder creation request.
   * @see docs/api-contracts/assets-files.md
   */
  createAssetFolder: (input) => invokeMain('asset.createFolder', input),
  /**
   * Deletes a folder tree and preserves referenced assets as tombstones when requested.
   * @param input - Folder deletion request.
   * @returns Folder deletion result.
   * @throws Error when the main process rejects the folder deletion request.
   * @see docs/api-contracts/assets-files.md
   */
  deleteAssetFolder: (input) => invokeMain('asset.deleteFolder', input),
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
  onAssetChanged: (handler) => subscribeMain('asset.changed', handler),
  /**
   * Subscribes to CanvasPlan readiness events after async orchestration completes.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/canvas-plan.md
   */
  onCanvasPlanReady: (handler) => subscribeMain('canvas.planReady', handler),
  /**
   * Persists a canvas graph snapshot for the given project.
   * @param input - Save request including project ID and graph snapshot.
   * @returns New graph version identifier.
   * @throws Error when the main process rejects the save request.
   * @see docs/api-contracts/canvas-plan.md
   */
  saveGraph: (input) => invokeMain('canvas.saveGraph', input),
  /**
   * Loads the latest canvas graph snapshot for the given project.
   * @param input - Load request including project ID.
   * @returns Graph snapshot or default empty graph.
   * @throws Error when the main process rejects the load request.
   * @see docs/api-contracts/canvas-plan.md
   */
  loadGraph: (input) => invokeMain('canvas.loadGraph', input),
  /**
   * Lists all available workflows with summary information.
   * @returns Workflow summaries including name, node count, and update time.
   * @throws Error when the main process rejects the list request.
   * @see docs/api-contracts/canvas-plan.md
   */
  listWorkflows: () => invokeMain('canvas.listWorkflows'),
  /**
   * Creates a new workflow with the given name.
   * @param input - Workflow creation request with name.
   * @returns Created workflow ID and name.
   * @throws Error when the main process rejects the create request.
   * @see docs/api-contracts/canvas-plan.md
   */
  createWorkflow: (input) => invokeMain('canvas.createWorkflow', input),
  /**
   * Renames an existing workflow.
   * @param input - Rename request with workflow ID and new name.
   * @returns Updated workflow ID and name.
   * @throws Error when the main process rejects the rename request.
   * @see docs/api-contracts/canvas-plan.md
   */
  renameWorkflow: (input) => invokeMain('canvas.renameWorkflow', input),
  /**
   * Soft-deletes a workflow.
   * @param input - Deletion request with workflow ID.
   * @returns Deletion confirmation.
   * @throws Error when the main process rejects the delete request.
   * @see docs/api-contracts/canvas-plan.md
   */
  deleteWorkflow: (input) => invokeMain('canvas.deleteWorkflow', input),
  /**
   * Returns the current storage configuration or null if not yet configured.
   * @returns Storage configuration or null.
   * @throws Error when the main process rejects the config request.
   * @see docs/api-contracts/storage-config.md
   */
  getStorageConfig: () => invokeMain('storage.getConfig'),
  /**
   * Saves a storage provider configuration.
   * @param input - Storage configuration to persist.
   * @throws Error when the main process rejects the save request.
   * @see docs/api-contracts/storage-config.md
   */
  saveStorageConfig: (input) => invokeMain('storage.saveConfig', input),
  /**
   * Tests a storage provider connection with the given configuration.
   * @param input - Storage configuration to test.
   * @returns Connection test result with ok flag and optional error.
   * @throws Error when the main process rejects the test request.
   * @see docs/api-contracts/storage-config.md
   */
  testStorageConnection: (input) => invokeMain('storage.testConnection', input)
}

contextBridge.exposeInMainWorld('comicCanvas', api)
