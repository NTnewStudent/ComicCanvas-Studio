/**
 * Sandboxed preload bridge for renderer-safe APIs.
 * @see docs/api-contracts/audit-observability.md
 */

import { contextBridge, ipcRenderer } from 'electron'

import type { AssetChangedEvent, IpcEventChannel, IpcEventMap, IpcRequestMap, IpcResponseMap, StorageConfigInput, StorageConnectionTestResult, WorkflowSummaryView } from '../../../shared/ipc'
import type { JobProgressEvent, JobTerminalEvent } from '../../../shared/jobs'

export interface ComicCanvasApi {
  health(): Promise<{ status: 'ok' | 'degraded' | 'failed'; checkedAt: number }>
  runCanvasNode(input: IpcRequestMap['canvas.runNode']): Promise<IpcResponseMap['canvas.runNode']>
  listJobs(input?: IpcRequestMap['job.list']): Promise<IpcResponseMap['job.list']>
  sendCanvasChat(input: IpcRequestMap['canvas.chatSend']): Promise<IpcResponseMap['canvas.chatSend']>
  getCanvasPlan(input: IpcRequestMap['canvas.chatGetPlan']): Promise<IpcResponseMap['canvas.chatGetPlan']>
  listAgents(): Promise<IpcResponseMap['agent.list']>
  saveAgent(input: IpcRequestMap['agent.save']): Promise<IpcResponseMap['agent.save']>
  deleteAgent(input: IpcRequestMap['agent.delete']): Promise<IpcResponseMap['agent.delete']>
  runAgent(input: IpcRequestMap['agent.run']): Promise<IpcResponseMap['agent.run']>
  getAgentRun(input: IpcRequestMap['agent.getRun']): Promise<IpcResponseMap['agent.getRun']>
  approveAgentTool(input: IpcRequestMap['agent.approveTool']): Promise<IpcResponseMap['agent.approveTool']>
  spawnSubAgent(input: IpcRequestMap['agent.spawn']): Promise<IpcResponseMap['agent.spawn']>
  getChatHistory(input: IpcRequestMap['chat.history']): Promise<IpcResponseMap['chat.history']>
  listSkills(input?: IpcRequestMap['skill.list']): Promise<IpcResponseMap['skill.list']>
  getSkillMetadata(input: IpcRequestMap['skill.getMetadata']): Promise<IpcResponseMap['skill.getMetadata']>
  reloadSkills(input?: IpcRequestMap['skill.reload']): Promise<IpcResponseMap['skill.reload']>
  enableSkill(input: IpcRequestMap['skill.enable']): Promise<IpcResponseMap['skill.enable']>
  disableSkill(input: IpcRequestMap['skill.disable']): Promise<IpcResponseMap['skill.disable']>
  listGateways(): Promise<IpcResponseMap['gateway.list']>
  saveGateway(input: IpcRequestMap['gateway.save']): Promise<IpcResponseMap['gateway.save']>
  deleteGateway(input: IpcRequestMap['gateway.delete']): Promise<IpcResponseMap['gateway.delete']>
  testGateway(input: IpcRequestMap['gateway.test']): Promise<IpcResponseMap['gateway.test']>
  reloadGateways(input: IpcRequestMap['gateway.reload']): Promise<IpcResponseMap['gateway.reload']>
  listGatewayModels(input?: IpcRequestMap['gateway.models']): Promise<IpcResponseMap['gateway.models']>
  fetchGatewayModels(input: IpcRequestMap['gateway.fetchModels']): Promise<IpcResponseMap['gateway.fetchModels']>
  listStyles(input?: IpcRequestMap['style.list']): Promise<IpcResponseMap['style.list']>
  saveStyle(input: IpcRequestMap['style.save']): Promise<IpcResponseMap['style.save']>
  deleteStyle(input: IpcRequestMap['style.delete']): Promise<IpcResponseMap['style.delete']>
  setProjectDefaultStyle(input: IpcRequestMap['style.setProjectDefault']): Promise<IpcResponseMap['style.setProjectDefault']>
  getProjectDefaultStyle(input: IpcRequestMap['style.getProjectDefault']): Promise<IpcResponseMap['style.getProjectDefault']>
  listCanvasSnippets(input?: IpcRequestMap['canvasSnippet.list']): Promise<IpcResponseMap['canvasSnippet.list']>
  getCanvasSnippet(input: IpcRequestMap['canvasSnippet.get']): Promise<IpcResponseMap['canvasSnippet.get']>
  saveCanvasSnippet(input: IpcRequestMap['canvasSnippet.save']): Promise<IpcResponseMap['canvasSnippet.save']>
  deleteCanvasSnippet(input: IpcRequestMap['canvasSnippet.delete']): Promise<IpcResponseMap['canvasSnippet.delete']>
  listTools(): Promise<IpcResponseMap['tool.list']>
  enableTool(input: IpcRequestMap['tool.enable']): Promise<IpcResponseMap['tool.enable']>
  disableTool(input: IpcRequestMap['tool.disable']): Promise<IpcResponseMap['tool.disable']>
  invokeTool(input: IpcRequestMap['tool.invoke']): Promise<IpcResponseMap['tool.invoke']>
  listAssets(input?: IpcRequestMap['asset.list']): Promise<IpcResponseMap['asset.list']>
  pickAssetImportFiles(): Promise<IpcResponseMap['asset.pickImportFiles']>
  importAsset(input: IpcRequestMap['asset.import']): Promise<IpcResponseMap['asset.import']>
  moveAsset(input: IpcRequestMap['asset.move']): Promise<IpcResponseMap['asset.move']>
  renameAsset(input: IpcRequestMap['asset.rename']): Promise<IpcResponseMap['asset.rename']>
  trashAsset(input: IpcRequestMap['asset.trash']): Promise<IpcResponseMap['asset.trash']>
  getAssetFolders(): Promise<IpcResponseMap['asset.getFolders']>
  createAssetFolder(input: IpcRequestMap['asset.createFolder']): Promise<IpcResponseMap['asset.createFolder']>
  deleteAssetFolder(input: IpcRequestMap['asset.deleteFolder']): Promise<IpcResponseMap['asset.deleteFolder']>
  getAssetCategories(input?: IpcRequestMap['asset.getCategories']): Promise<IpcResponseMap['asset.getCategories']>
  createAssetCategory(input: IpcRequestMap['asset.createCategory']): Promise<IpcResponseMap['asset.createCategory']>
  updateAssetCategory(input: IpcRequestMap['asset.updateCategory']): Promise<IpcResponseMap['asset.updateCategory']>
  assignAssetCategory(input: IpcRequestMap['asset.assignCategory']): Promise<IpcResponseMap['asset.assignCategory']>
  removeAssetCategory(input: IpcRequestMap['asset.removeCategory']): Promise<IpcResponseMap['asset.removeCategory']>
  onJobCompleted(handler: (event: Extract<JobTerminalEvent, { channel: 'job.completed' }>) => void): () => void
  onJobFailed(handler: (event: Extract<JobTerminalEvent, { channel: 'job.failed' }>) => void): () => void
  onJobProgress(handler: (event: JobProgressEvent) => void): () => void
  onAssetChanged(handler: (event: AssetChangedEvent) => void): () => void
  onCanvasPlanReady(handler: (event: IpcEventMap['canvas.planReady']) => void): () => void
  onAgentResponseReady(handler: (event: IpcEventMap['agent.responseReady']) => void): () => void
  onAgentDelta(handler: (event: IpcEventMap['agent.delta']) => void): () => void
  onAgentToolStarted(handler: (event: IpcEventMap['agent.toolStarted']) => void): () => void
  onAgentToolCompleted(handler: (event: IpcEventMap['agent.toolCompleted']) => void): () => void
  onAgentPermissionRequired(handler: (event: IpcEventMap['agent.permissionRequired']) => void): () => void
  saveGraph(input: IpcRequestMap['canvas.saveGraph']): Promise<IpcResponseMap['canvas.saveGraph']>
  validateGraph(input: IpcRequestMap['canvas.validateGraph']): Promise<IpcResponseMap['canvas.validateGraph']>
  loadGraph(input: IpcRequestMap['canvas.loadGraph']): Promise<IpcResponseMap['canvas.loadGraph']>
  listWorkflows(): Promise<WorkflowSummaryView[]>
  createWorkflow(input: IpcRequestMap['canvas.createWorkflow']): Promise<IpcResponseMap['canvas.createWorkflow']>
  renameWorkflow(input: IpcRequestMap['canvas.renameWorkflow']): Promise<IpcResponseMap['canvas.renameWorkflow']>
  deleteWorkflow(input: IpcRequestMap['canvas.deleteWorkflow']): Promise<IpcResponseMap['canvas.deleteWorkflow']>
  exportWorkflow(input: IpcRequestMap['canvas.exportWorkflow']): Promise<IpcResponseMap['canvas.exportWorkflow']>
  importWorkflow(input: IpcRequestMap['canvas.importWorkflow']): Promise<IpcResponseMap['canvas.importWorkflow']>
  listWorkflowTemplates(input?: IpcRequestMap['canvas.listWorkflowTemplates']): Promise<IpcResponseMap['canvas.listWorkflowTemplates']>
  copyWorkflowTemplate(input: IpcRequestMap['canvas.copyWorkflowTemplate']): Promise<IpcResponseMap['canvas.copyWorkflowTemplate']>
  publishWorkflowTemplate(input: IpcRequestMap['canvas.publishWorkflowTemplate']): Promise<IpcResponseMap['canvas.publishWorkflowTemplate']>
  listWorkflowVersions(input: IpcRequestMap['canvas.listWorkflowVersions']): Promise<IpcResponseMap['canvas.listWorkflowVersions']>
  restoreWorkflowVersion(input: IpcRequestMap['canvas.restoreWorkflowVersion']): Promise<IpcResponseMap['canvas.restoreWorkflowVersion']>
  /** Returns the current storage configuration or null. */
  getStorageConfig(): Promise<IpcResponseMap['storage.getConfig']>
  /** Saves a storage configuration. */
  saveStorageConfig(input: StorageConfigInput): Promise<void>
  /** Tests a storage provider connection. */
  testStorageConnection(input: StorageConfigInput): Promise<StorageConnectionTestResult>
}

type SubscribableEventChannel = Extract<IpcEventChannel, 'job.progress' | 'job.completed' | 'job.failed' | 'asset.changed' | 'canvas.planReady' | 'agent.responseReady' | 'agent.delta' | 'agent.toolStarted' | 'agent.toolCompleted' | 'agent.permissionRequired'>

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
function invokeMain<TChannel extends 'job.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.chatSend'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.chatGetPlan'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.save'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.delete'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.run'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.getRun'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.approveTool'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'agent.spawn'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'chat.history'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'skill.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'skill.getMetadata'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'skill.reload'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'skill.enable'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'skill.disable'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'skill.invoke'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.save'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.delete'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.test'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.reload'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.models'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'gateway.fetchModels'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'style.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'style.save'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'style.delete'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'style.setProjectDefault'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'style.getProjectDefault'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvasSnippet.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvasSnippet.get'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvasSnippet.save'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvasSnippet.delete'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'tool.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'tool.enable'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'tool.disable'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'tool.invoke'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.list'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.pickImportFiles'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.import'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.move'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.rename'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.trash'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.getFolders'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.createFolder'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.deleteFolder'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.getCategories'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.createCategory'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.updateCategory'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.assignCategory'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'asset.removeCategory'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.saveGraph'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.validateGraph'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.loadGraph'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.listWorkflows'>(channel: TChannel): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.createWorkflow'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.renameWorkflow'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.deleteWorkflow'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.exportWorkflow'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.importWorkflow'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.listWorkflowTemplates'>(channel: TChannel, request?: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.copyWorkflowTemplate'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.publishWorkflowTemplate'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.listWorkflowVersions'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
function invokeMain<TChannel extends 'canvas.restoreWorkflowVersion'>(channel: TChannel, request: IpcRequestMap[TChannel]): Promise<IpcResponseMap[TChannel]>
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
   * Lists persisted local jobs for renderer task surfaces.
   * @param input - Optional status, type, target, and limit filters.
   * @returns Durable job records without provider bytes or raw paths.
   * @throws Error when the main process rejects the job list request.
   * @see docs/api-contracts/jobs.md
   */
  listJobs: (input = {}) => invokeMain('job.list', input),
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
   * Starts an asynchronous Agent run.
   * @param input - Agent ID, user message, and optional context override.
   * @returns Pending Agent run ticket.
   * @throws Error when the main process rejects the Agent run request.
   * @see docs/api-contracts/agents.md
   */
  runAgent: (input) => invokeMain('agent.run', input),
  /**
   * Reads the current Agent run status and trace.
   * @param input - Agent run lookup request.
   * @returns Agent run status and trace metadata.
   * @throws Error when the main process rejects the run lookup request.
   * @see docs/api-contracts/agents.md
   */
  getAgentRun: (input) => invokeMain('agent.getRun', input),
  /**
   * Approves a paused Agent tool call.
   * @param input - Pending Agent run call approval.
   * @returns Pending resume job ticket or a safe error.
   * @throws Error when the main process rejects the approval request.
   * @see docs/api-contracts/agents.md
   */
  approveAgentTool: (input) => invokeMain('agent.approveTool', input),
  /**
   * Spawns an isolated sub-agent through the whitelisted Agent IPC contract.
   * @param input - Sub-agent spec and parent depth.
   * @returns Sub-agent terminal result with trace metadata.
   * @throws Error when the main process rejects the spawn request.
   * @see docs/api-contracts/agents.md
   */
  spawnSubAgent: (input) => invokeMain('agent.spawn', input),
  /**
   * Loads persisted chat turns for a workflow session restore.
   * @param input - Workflow scope.
   * @returns Ordered chat turns with persisted blocks.
   * @throws Error when the IPC bridge rejects.
   * @see docs/api-contracts/agents.md
   */
  getChatHistory: (input) => invokeMain('chat.history', input),
  listSkills: (input) => invokeMain('skill.list', input ?? {}),
  getSkillMetadata: (input) => invokeMain('skill.getMetadata', input),
  reloadSkills: (input) => invokeMain('skill.reload', input ?? {}),
  enableSkill: (input) => invokeMain('skill.enable', input),
  disableSkill: (input) => invokeMain('skill.disable', input),
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
   * Lists renderer-safe gateway model catalog and capability flags.
   * @param input - Empty request object reserved for future filters.
   * @returns Model catalog grouped by text/image/video/tool channels.
   * @throws Error when the main process rejects the model catalog request.
   * @see docs/api-contracts/gateway-providers.md
   */
  listGatewayModels: (input = {}) => invokeMain('gateway.models', input),
  /**
   * Fetches model IDs from an OpenAI-compatible gateway `/models` endpoint.
   * @param input - Existing gateway or form-level base URL/auth data.
   * @returns Renderer-safe fetched model records.
   * @throws Error when the main process rejects the model fetch request.
   * @see docs/api-contracts/gateway-providers.md
   */
  fetchGatewayModels: (input) => invokeMain('gateway.fetchModels', input),
  /**
   * Lists style presets visible to renderer style selectors.
   * @param input - Optional disabled preset inclusion flag.
   * @returns Style preset views without secret provider data.
   * @throws Error when the main process rejects the style list request.
   * @see docs/api-contracts/styles.md
   */
  listStyles: (input = {}) => invokeMain('style.list', input),
  /**
   * Saves a style preset through the main-process repository.
   * @param input - Style preset save input.
   * @returns Saved style preset view.
   * @throws Error when the main process rejects the style save request.
   * @see docs/api-contracts/styles.md
   */
  saveStyle: (input) => invokeMain('style.save', input),
  /**
   * Deletes a style preset by identifier.
   * @param input - Style preset deletion request.
   * @returns Deletion confirmation.
   * @throws Error when the main process rejects the style delete request.
   * @see docs/api-contracts/styles.md
   */
  deleteStyle: (input) => invokeMain('style.delete', input),
  /**
   * Sets or clears the project-level default style preset.
   * @param input - Workflow default style request.
   * @returns Updated workflow default style state.
   * @throws Error when the main process rejects the project default request.
   * @see docs/api-contracts/styles.md
   */
  setProjectDefaultStyle: (input) => invokeMain('style.setProjectDefault', input),
  /**
   * Returns the current workflow default style preset identifier.
   * @param input - Workflow lookup request.
   * @returns Current default style ID, or null when unset.
   * @throws Error when the main process rejects the project default lookup.
   * @see docs/api-contracts/styles.md
   */
  getProjectDefaultStyle: (input) => invokeMain('style.getProjectDefault', input),
  /**
   * Lists reusable canvas snippets saved in the local library.
   * @returns Canvas snippet views with sanitized nodes and edges.
   * @throws Error when the main process rejects the snippet list request.
   * @see docs/api-contracts/canvas-plan.md
   */
  listCanvasSnippets: (input = {}) => invokeMain('canvasSnippet.list', input),
  /**
   * Loads one reusable canvas snippet detail fragment.
   * @param input - Snippet lookup request.
   * @returns Snippet detail or safe not-found envelope.
   * @throws Error when the main process rejects the snippet detail request.
   * @see docs/api-contracts/canvas-plan.md
   */
  getCanvasSnippet: (input) => invokeMain('canvasSnippet.get', input),
  /**
   * Saves a reusable canvas snippet through main-process validation.
   * @param input - Snippet save input containing selected nodes and internal edges.
   * @returns Saved snippet view or validation error envelope.
   * @throws Error when the main process rejects the snippet save request.
   * @see docs/api-contracts/canvas-plan.md
   */
  saveCanvasSnippet: (input) => invokeMain('canvasSnippet.save', input),
  /**
   * Deletes a reusable canvas snippet from the active local library.
   * @param input - Snippet deletion request.
   * @returns Deletion confirmation.
   * @throws Error when the main process rejects the snippet delete request.
   * @see docs/api-contracts/canvas-plan.md
   */
  deleteCanvasSnippet: (input) => invokeMain('canvasSnippet.delete', input),
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
   * Opens a main-process file picker and returns absolute local paths for import.
   * @returns Selected local file paths, or an empty list when canceled.
   * @throws Error when the main process rejects the picker request.
   * @see docs/api-contracts/assets-files.md
   */
  pickAssetImportFiles: () => invokeMain('asset.pickImportFiles', {}),
  /**
   * Imports one local file into the managed asset library.
   * @param input - Local source path and classified media type.
   * @returns Renderer-safe asset record for the imported file.
   * @throws Error when the main process rejects the import request.
   * @see docs/api-contracts/assets-files.md
   */
  importAsset: (input) => invokeMain('asset.import', input),
  /**
   * Moves one asset to a folder or back to the library root.
   * @param input - Asset move request.
   * @returns Updated asset record.
   * @throws Error when the main process rejects the asset move request.
   * @see docs/api-contracts/assets-files.md
   */
  moveAsset: (input) => invokeMain('asset.move', input),
  /**
   * Renames an asset display label without changing safe URLs or storage paths.
   * @param input - Asset rename request.
   * @returns Updated asset record.
   * @throws Error when the main process rejects the asset rename request.
   * @see docs/api-contracts/assets-files.md
   */
  renameAsset: (input) => invokeMain('asset.rename', input),
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
   * Lists image asset categories, including built-in starter categories.
   * @param input - Optional disabled-category inclusion flag.
   * @returns Asset category records.
   * @throws Error when the main process rejects the category list request.
   * @see docs/api-contracts/assets-files.md
   */
  getAssetCategories: (input = {}) => invokeMain('asset.getCategories', input),
  /**
   * Creates a user-defined image asset category.
   * @param input - Category creation request.
   * @returns Created category record.
   * @throws Error when the main process rejects the category creation request.
   * @see docs/api-contracts/assets-files.md
   */
  createAssetCategory: (input) => invokeMain('asset.createCategory', input),
  /**
   * Updates an asset category display and enabled state.
   * @param input - Category update request.
   * @returns Updated category record.
   * @throws Error when the main process rejects the category update request.
   * @see docs/api-contracts/assets-files.md
   */
  updateAssetCategory: (input) => invokeMain('asset.updateCategory', input),
  /**
   * Assigns an image asset to a category.
   * @param input - Asset/category assignment request.
   * @returns Assignment acknowledgement.
   * @throws Error when the main process rejects the assignment request.
   * @see docs/api-contracts/assets-files.md
   */
  assignAssetCategory: (input) => invokeMain('asset.assignCategory', input),
  /**
   * Removes an image asset from a category.
   * @param input - Asset/category assignment request.
   * @returns Removal acknowledgement.
   * @throws Error when the main process rejects the removal request.
   * @see docs/api-contracts/assets-files.md
   */
  removeAssetCategory: (input) => invokeMain('asset.removeCategory', input),
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
   * Subscribes to job progress events for visible Agent/tool thinking summaries.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/jobs.md
   * @see docs/api-contracts/agents.md
   */
  onJobProgress: (handler) => subscribeMain('job.progress', handler),
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
   * Subscribes to Agent answer/clarification readiness events after async runs complete.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/agents.md
   */
  onAgentResponseReady: (handler) => subscribeMain('agent.responseReady', handler),
  /**
   * Subscribes to streaming token delta events while the model generates a response.
   * @param handler - Event payload handler receiving incremental text.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/agents.md
   */
  onAgentDelta: (handler) => subscribeMain('agent.delta', handler),
  onAgentToolStarted: (handler) => subscribeMain('agent.toolStarted', handler),
  onAgentToolCompleted: (handler) => subscribeMain('agent.toolCompleted', handler),
  onAgentPermissionRequired: (handler) => subscribeMain('agent.permissionRequired', handler),
  /**
   * Persists a canvas graph snapshot for the given project.
   * @param input - Save request including project ID and graph snapshot.
   * @returns New graph version identifier.
   * @throws Error when the main process rejects the save request.
   * @see docs/api-contracts/canvas-plan.md
   */
  saveGraph: (input) => invokeMain('canvas.saveGraph', input),
  /**
   * Validates a graph in lenient draft-save or strict runtime mode.
   * @param input - Workflow ID, optional graph snapshot, and validation mode.
   * @returns Validation issues and aggregate warning summary.
   * @throws Error when the main process rejects the validation request.
   * @see docs/api-contracts/canvas-plan.md
   */
  validateGraph: (input) => invokeMain('canvas.validateGraph', input),
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
   * Exports one workflow as a sanitized portable JSON payload.
   * @param input - Workflow export request.
   * @returns Schema-versioned workflow export view.
   * @throws Error when the main process rejects the export request.
   * @see docs/api-contracts/canvas-plan.md
   */
  exportWorkflow: (input) => invokeMain('canvas.exportWorkflow', input),
  /**
   * Imports one workflow JSON payload through main-process validation.
   * @param input - Workflow import request.
   * @returns Created workflow identifiers, or a safe validation error.
   * @throws Error when the main process rejects the import request.
   * @see docs/api-contracts/canvas-plan.md
   */
  importWorkflow: (input) => invokeMain('canvas.importWorkflow', input),
  /**
   * Lists published public workflow templates.
   * @returns Published workflow template summaries.
   * @throws Error when the main process rejects the list request.
   * @see docs/api-contracts/canvas-plan.md
   */
  listWorkflowTemplates: (input = {}) => invokeMain('canvas.listWorkflowTemplates', input),
  /**
   * Copies a published workflow template into a private draft workflow.
   * @param input - Template copy request.
   * @returns Created draft workflow ID and graph version.
   * @throws Error when the main process rejects the copy request.
   * @see docs/api-contracts/canvas-plan.md
   */
  copyWorkflowTemplate: (input) => invokeMain('canvas.copyWorkflowTemplate', input),
  /**
   * Publishes a local workflow template after strict graph validation.
   * @param input - Template ID and target visibility.
   * @returns Published template summary or a safe validation error envelope.
   * @throws Error when the main process rejects the publish request.
   * @see docs/api-contracts/canvas-plan.md
   */
  publishWorkflowTemplate: (input) => invokeMain('canvas.publishWorkflowTemplate', input),
  /**
   * Lists immutable graph versions for workflow debug and restore UI.
   * @param input - Workflow ID and optional result limit.
   * @returns Version summaries with checksums and warning counts.
   * @throws Error when the main process rejects the list request.
   * @see docs/api-contracts/canvas-plan.md
   */
  listWorkflowVersions: (input) => invokeMain('canvas.listWorkflowVersions', input),
  /**
   * Restores a historical graph version by creating a new latest version.
   * @param input - Workflow ID and source version ID.
   * @returns Restored graph version metadata.
   * @throws Error when the main process rejects the restore request.
   * @see docs/api-contracts/canvas-plan.md
   */
  restoreWorkflowVersion: (input) => invokeMain('canvas.restoreWorkflowVersion', input),
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
