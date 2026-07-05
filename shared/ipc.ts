/**
 * IPC channel contracts shared by preload, renderer, and main handlers.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/gateway-providers.md
 * @see docs/api-contracts/tools-plugins.md
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/skills.md
 * @see docs/api-contracts/knowledge-context.md
 * @see docs/api-contracts/audit-observability.md
 */

import type { CanvasGraphSnapshot, CanvasLoadGraphRequest, CanvasSaveGraphRequest, CanvasSaveGraphResponse } from './graph'
import type { GraphValidationIssue, GraphValidationMode, GraphValidationSummary } from './graph-validation'
import type {
  AssetFolder,
  AssetFolderCreateRequest,
  AssetFolderDeleteRequest,
  AssetFolderDeleteResponse,
  AssetImportRequest,
  AssetCategory,
  AssetCategoryAssignRequest,
  AssetCategoryCreateRequest,
  AssetCategoryUpdateRequest,
  AssetListRequest,
  AssetMoveRequest,
  AssetRecord,
  AssetRenameRequest,
  AssetTrashRequest,
  AssetTrashResponse
} from './assets'
import type { GatewayConfigInput, GatewayConfigView, GatewayFetchModelsRequest, GatewayFetchModelsResponse } from './gateway'
import type { JobCreateInput, JobListFilter, JobProgressEvent, JobRecord, JobRecoveryReport, JobTerminalEvent, JobTicket } from './jobs'
import type { CanvasPlan, PlanRunStep } from './plan'
import type { AgentDefinition, AgentNonCanvasResponse, AgentRunRequest, AgentRunTicket, AgentToolApprovalInput, SpawnSubAgentInput, SpawnSubAgentResult } from './agents'
import type { SkillDefinition, SkillInvocationRecord, SkillInvokeRequest, SkillListRequest } from './skills'
import type { ContextBuildInput, ContextPack, KnowledgeDocument, KnowledgeIngestRequest, KnowledgeQuery, KnowledgeChunk } from './knowledge'
import type { ToolDescriptor, ToolInvocationRecord, ToolPermission } from './tools'
import type { StylePresetSaveInput, StylePresetView, StyleProjectDefaultRequest } from './styles'
import type { CanvasSnippetDeleteRequest, CanvasSnippetDeleteResponse, CanvasSnippetGetRequest, CanvasSnippetListRequest, CanvasSnippetSaveInput, CanvasSnippetSaveResponse, CanvasSnippetView } from './snippets'
import type { WorkflowModelCatalog } from './workflow-node-definitions'

export type CanvasIpcChannel =
  | 'canvas.chatSend'
  | 'canvas.chatGetPlan'
  | 'canvas.applyPlan'
  | 'canvas.runPlan'
  | 'canvas.runNode'
  | 'canvas.saveGraph'
  | 'canvas.validateGraph'
  | 'canvas.loadGraph'
  | 'canvas.graphChanged'
  | 'canvas.planReady'
  | 'canvas.listWorkflows'
  | 'canvas.createWorkflow'
  | 'canvas.renameWorkflow'
  | 'canvas.deleteWorkflow'
  | 'canvas.exportWorkflow'
  | 'canvas.importWorkflow'
  | 'canvas.listWorkflowTemplates'
  | 'canvas.copyWorkflowTemplate'
  | 'canvas.publishWorkflowTemplate'
  | 'canvas.listWorkflowVersions'
  | 'canvas.restoreWorkflowVersion'

export type JobIpcChannel =
  | 'job.enqueue'
  | 'job.get'
  | 'job.list'
  | 'job.recover'
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'

export type AssetIpcChannel =
  | 'asset.import'
  | 'asset.pickImportFiles'
  | 'asset.get'
  | 'asset.list'
  | 'asset.move'
  | 'asset.rename'
  | 'asset.trash'
  | 'asset.getFolders'
  | 'asset.createFolder'
  | 'asset.deleteFolder'
  | 'asset.getCategories'
  | 'asset.createCategory'
  | 'asset.updateCategory'
  | 'asset.assignCategory'
  | 'asset.removeCategory'
  | 'asset.changed'

export type GatewayIpcChannel =
  | 'gateway.list'
  | 'gateway.save'
  | 'gateway.delete'
  | 'gateway.test'
  | 'gateway.reload'
  | 'gateway.models'
  | 'gateway.fetchModels'
  | 'gateway.changed'

export type StyleIpcChannel =
  | 'style.list'
  | 'style.save'
  | 'style.delete'
  | 'style.setProjectDefault'
  | 'style.getProjectDefault'
  | 'style.changed'

export type CanvasSnippetIpcChannel =
  | 'canvasSnippet.list'
  | 'canvasSnippet.get'
  | 'canvasSnippet.save'
  | 'canvasSnippet.delete'

export type ToolIpcChannel =
  | 'tool.list'
  | 'tool.invoke'
  | 'tool.enable'
  | 'tool.disable'
  | 'tool.progress'
  | 'tool.completed'
  | 'tool.failed'
  | 'tool.audit'

export type AgentIpcChannel =
  | 'agent.list'
  | 'agent.save'
  | 'agent.delete'
  | 'agent.run'
  | 'agent.getRun'
  | 'agent.approveTool'
  | 'agent.spawn'
  | 'agent.responseReady'
  | 'agent.delta'
  | 'agent.toolStarted'
  | 'agent.toolCompleted'
  | 'agent.permissionRequired'
  | 'agent.progress'
  | 'agent.completed'
  | 'agent.failed'

export type SkillIpcChannel =
  | 'skill.list'
  | 'skill.reload'
  | 'skill.getMetadata'
  | 'skill.invoke'
  | 'skill.enable'
  | 'skill.disable'
  | 'skill.changed'

export type KnowledgeIpcChannel =
  | 'knowledge.ingest'
  | 'knowledge.retrieve'
  | 'knowledge.delete'
  | 'knowledge.rebuild'
  | 'knowledge.indexed'
  | 'knowledge.failed'
  | 'context.build'

export type AuditIpcChannel =
  | 'audit.list'
  | 'health.check'

export type StorageIpcChannel =
  | 'storage.getConfig'
  | 'storage.saveConfig'
  | 'storage.testConnection'

export type IpcChannel =
  | CanvasIpcChannel
  | JobIpcChannel
  | AssetIpcChannel
  | GatewayIpcChannel
  | StyleIpcChannel
  | CanvasSnippetIpcChannel
  | ToolIpcChannel
  | AgentIpcChannel
  | SkillIpcChannel
  | KnowledgeIpcChannel
  | AuditIpcChannel
  | StorageIpcChannel

/** S3-compatible storage configuration (shared type for IPC contract) */
export interface StorageConfigInput {
  /** Provider ID ('s3' | 'r2' | 'cos' | 'oss') */
  provider: string
  /** Service endpoint URL */
  endpoint: string
  /** Region (R2 uses 'auto') */
  region?: string
  /** Bucket name */
  bucket: string
  /** Access key ID */
  accessKeyId: string
  /** Secret access key */
  secretAccessKey: string
  /** Public URL prefix (CDN domain, optional) */
  publicUrlPrefix?: string
}

/** Storage connection test result */
export interface StorageConnectionTestResult {
  ok: boolean
  error?: string
}

export interface SafeErrorEnvelope {
  errorClass: string
  message: string
  traceId: string
  retryable: boolean
}

export interface CanvasApplyPlanRequest {
  plan: CanvasPlan
  mode: 'draft' | 'apply'
  sourceAgentRunId?: string
}

export interface CanvasApplyPlanResponse {
  graphVersion: string
  appliedNodeIds: string[]
  appliedEdgeIds: string[]
  dropped: string[]
}

export interface CanvasRunPlanRequest {
  graphVersion: string
  runSteps: PlanRunStep[]
  workflowId?: string
}

export interface CanvasRunPlanResponse {
  jobIds: string[]
  status: 'queued'
}

export interface WorkflowSummaryView {
  id: string
  name: string
  scope: 'draft' | 'template'
  published: boolean
  description: string | null
  visibility: 'private' | 'public'
  ownerId: string
  ownedByCurrentUser: boolean
  tags: string[]
  thumbnailUrl: string | null
  updatedAt: string
  nodeCount: number
  edgeCount: number
  coverAssetId: string | null
  latestRunStatus: 'idle' | 'pending' | 'running' | 'done' | 'error'
  defaultStylePresetId: string | null
  archived: boolean
  versionChecksum: string
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
    unavailableModels?: number
    unavailableStyles?: number
    unavailableAssets?: number
  }
}

export interface WorkflowExportView {
  schemaVersion: 1
  name: string
  graph: CanvasGraphSnapshot
}

export interface WorkflowImportRequest {
  json: string
  name?: string
}

export interface WorkflowImportResponse {
  workflowId: string
  graphVersion: string
  dropped: string[]
}

export interface WorkflowTemplateListRequest {
  scope?: 'public' | 'my' | 'all'
}

export interface WorkflowTemplateCopyResponse {
  workflowId: string
  graphVersion: string
  name: string
}

export interface WorkflowTemplatePublishRequest {
  workflowId: string
  visibility?: 'private' | 'public'
}

export interface WorkflowVersionSummaryView {
  id: string
  createdAt: string
  createdBy: string
  nodeCount: number
  edgeCount: number
  checksum: string
  restoreSourceVersionId: string | null
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
    unavailableModels?: number
    unavailableStyles?: number
    unavailableAssets?: number
  }
}

export interface WorkflowVersionRestoreResponse {
  workflowId: string
  graphVersion: string
  restoredFromVersionId: string
  checksum: string
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
    unavailableModels?: number
    unavailableStyles?: number
    unavailableAssets?: number
  }
}

export interface WorkflowGraphValidationResponse {
  mode: GraphValidationMode
  valid: boolean
  issues: GraphValidationIssue[]
  warningSummary: GraphValidationSummary
}

export interface IpcRequestMap {
  'canvas.chatSend': { message: string; agentId?: string }
  'canvas.chatGetPlan': { messageId: string }
  'canvas.applyPlan': CanvasApplyPlanRequest
  'canvas.runPlan': CanvasRunPlanRequest
  'canvas.runNode': { nodeId: string; workflowId?: string }
  'canvas.saveGraph': CanvasSaveGraphRequest
  'canvas.validateGraph': { workflowId?: string; graph?: CanvasGraphSnapshot; mode?: GraphValidationMode }
  'canvas.loadGraph': CanvasLoadGraphRequest
  'canvas.listWorkflows': void
  'canvas.createWorkflow': { name: string }
  'canvas.renameWorkflow': { workflowId: string; name: string }
  'canvas.deleteWorkflow': { workflowId: string }
  'canvas.exportWorkflow': { workflowId: string }
  'canvas.importWorkflow': WorkflowImportRequest
  'canvas.listWorkflowTemplates': WorkflowTemplateListRequest
  'canvas.copyWorkflowTemplate': { templateId: string; name?: string }
  'canvas.publishWorkflowTemplate': WorkflowTemplatePublishRequest
  'canvas.listWorkflowVersions': { workflowId: string; limit?: number }
  'canvas.restoreWorkflowVersion': { workflowId: string; versionId: string }
  'job.enqueue': JobCreateInput
  'job.get': { jobId: string }
  'job.list': JobListFilter
  'job.recover': Record<string, never>
  'asset.import': AssetImportRequest
  'asset.pickImportFiles': Record<string, never>
  'asset.get': { assetId: string }
  'asset.list': AssetListRequest
  'asset.move': AssetMoveRequest
  'asset.rename': AssetRenameRequest
  'asset.trash': AssetTrashRequest
  'asset.getFolders': Record<string, never>
  'asset.createFolder': AssetFolderCreateRequest
  'asset.deleteFolder': AssetFolderDeleteRequest
  'asset.getCategories': { includeDisabled?: boolean }
  'asset.createCategory': AssetCategoryCreateRequest
  'asset.updateCategory': AssetCategoryUpdateRequest
  'asset.assignCategory': AssetCategoryAssignRequest
  'asset.removeCategory': AssetCategoryAssignRequest
  'gateway.list': Record<string, never>
  'gateway.save': GatewayConfigInput
  'gateway.delete': { gatewayId: string }
  'gateway.test': { gatewayId: string; channel: 'text' | 'image' | 'video' }
  'gateway.reload': { gatewayId?: string }
  'gateway.models': Record<string, never>
  'gateway.fetchModels': GatewayFetchModelsRequest
  'style.list': { includeDisabled?: boolean }
  'style.save': StylePresetSaveInput
  'style.delete': { stylePresetId: string }
  'style.setProjectDefault': StyleProjectDefaultRequest
  'style.getProjectDefault': { workflowId: string }
  'canvasSnippet.list': CanvasSnippetListRequest
  'canvasSnippet.get': CanvasSnippetGetRequest
  'canvasSnippet.save': CanvasSnippetSaveInput
  'canvasSnippet.delete': CanvasSnippetDeleteRequest
  'tool.list': { includeDisabled?: boolean }
  'tool.invoke': { toolId: string; input: unknown; traceId: string }
  'tool.enable': { toolId: string }
  'tool.disable': { toolId: string }
  'agent.list': { includeDisabled?: boolean }
  'agent.save': AgentDefinition
  'agent.delete': { agentId: string }
  'agent.run': AgentRunRequest
  'agent.getRun': { runId: string }
  'agent.approveTool': AgentToolApprovalInput
  'agent.spawn': SpawnSubAgentInput
  'skill.list': SkillListRequest
  'skill.reload': { skillId?: string }
  'skill.getMetadata': { skillId: string }
  'skill.invoke': SkillInvokeRequest & { agentId?: string }
  'skill.enable': { skillId: string }
  'skill.disable': { skillId: string }
  'knowledge.ingest': KnowledgeIngestRequest
  'knowledge.retrieve': KnowledgeQuery
  'knowledge.delete': { documentId: string }
  'knowledge.rebuild': { projectId: string }
  'context.build': ContextBuildInput
  'audit.list': { traceId?: string; actorId?: string; capability?: string; limit: number }
  'health.check': { components?: string[] }
  'storage.getConfig': void
  'storage.saveConfig': StorageConfigInput
  'storage.testConnection': StorageConfigInput
}

export interface IpcResponseMap {
  'canvas.chatSend': { runId: string; jobId: string; messageId: string; status: 'pending' }
  'canvas.chatGetPlan': CanvasPlan
  'canvas.applyPlan': CanvasApplyPlanResponse
  'canvas.runPlan': CanvasRunPlanResponse
  'canvas.runNode': JobTicket | { errorClass: string; message: string; retryable: false; issues?: GraphValidationIssue[] }
  'canvas.saveGraph': CanvasSaveGraphResponse
  'canvas.validateGraph': WorkflowGraphValidationResponse
  'canvas.loadGraph': CanvasGraphSnapshot
  'canvas.listWorkflows': WorkflowSummaryView[]
  'canvas.createWorkflow': { id: string; name: string }
  'canvas.renameWorkflow': { id: string; name: string }
  'canvas.deleteWorkflow': { id: string; deleted: true }
  'canvas.exportWorkflow': WorkflowExportView
  'canvas.importWorkflow': WorkflowImportResponse | { errorClass: string; message: string; retryable: false }
  'canvas.listWorkflowTemplates': WorkflowSummaryView[]
  'canvas.copyWorkflowTemplate': WorkflowTemplateCopyResponse | { errorClass: string; message: string; retryable: false }
  'canvas.publishWorkflowTemplate': WorkflowSummaryView | { errorClass: string; message: string; retryable: false; issues?: GraphValidationIssue[] }
  'canvas.listWorkflowVersions': WorkflowVersionSummaryView[]
  'canvas.restoreWorkflowVersion': WorkflowVersionRestoreResponse | { errorClass: string; message: string; retryable: false }
  'job.enqueue': JobTicket
  'job.get': JobRecord
  'job.list': JobRecord[]
  'job.recover': JobRecoveryReport
  'asset.import': AssetRecord
  'asset.pickImportFiles': { paths: string[] }
  'asset.get': AssetRecord
  'asset.list': AssetRecord[]
  'asset.move': AssetRecord
  'asset.rename': AssetRecord
  'asset.trash': AssetTrashResponse
  'asset.getFolders': AssetFolder[]
  'asset.createFolder': AssetFolder
  'asset.deleteFolder': AssetFolderDeleteResponse
  'asset.getCategories': AssetCategory[]
  'asset.createCategory': AssetCategory
  'asset.updateCategory': AssetCategory
  'asset.assignCategory': { assetId: string; categoryId: string; assigned: true }
  'asset.removeCategory': { assetId: string; categoryId: string; removed: true }
  'gateway.list': GatewayConfigView[]
  'gateway.save': GatewayConfigView
  'gateway.delete': { gatewayId: string; deleted: true }
  'gateway.test': JobTicket
  'gateway.reload': { reloadedGatewayIds: string[] }
  'gateway.models': WorkflowModelCatalog
  'gateway.fetchModels': GatewayFetchModelsResponse
  'style.list': StylePresetView[]
  'style.save': StylePresetView
  'style.delete': { stylePresetId: string; deleted: true }
  'style.setProjectDefault': { workflowId: string; stylePresetId: string | null }
  'style.getProjectDefault': { workflowId: string; stylePresetId: string | null }
  'canvasSnippet.list': CanvasSnippetView[]
  'canvasSnippet.get': CanvasSnippetView | { errorClass: 'not_found'; message: string; retryable: false }
  'canvasSnippet.save': CanvasSnippetSaveResponse
  'canvasSnippet.delete': CanvasSnippetDeleteResponse
  'tool.list': ToolDescriptor[]
  'tool.invoke': ToolInvocationRecord
  'tool.enable': ToolDescriptor
  'tool.disable': ToolDescriptor
  'agent.list': AgentDefinition[]
  'agent.save': AgentDefinition
  'agent.delete': { agentId: string; deleted: true }
  'agent.run': AgentRunTicket
  'agent.getRun': { runId: string; status: string; trace?: Record<string, unknown> }
  'agent.approveTool': AgentRunTicket | { errorClass: string; message: string; retryable: false }
  'agent.spawn': SpawnSubAgentResult
  'skill.list': SkillDefinition[]
  'skill.reload': { reloadedSkillIds: string[] }
  'skill.getMetadata': SkillDefinition
  'skill.invoke': SkillInvocationRecord | { errorClass: string; message: string; retryable: false }
  'skill.enable': SkillDefinition | { errorClass: string; message: string; retryable: false }
  'skill.disable': SkillDefinition | { errorClass: string; message: string; retryable: false }
  'knowledge.ingest': KnowledgeDocument
  'knowledge.retrieve': KnowledgeChunk[]
  'knowledge.delete': { documentId: string; deleted: true }
  'knowledge.rebuild': JobTicket
  'context.build': ContextPack
  'audit.list': { entries: Array<Record<string, unknown>> }
  'health.check': { status: 'ok' | 'degraded' | 'failed'; checks: Array<Record<string, unknown>>; checkedAt: number }
  'storage.getConfig': StorageConfigInput | null
  'storage.saveConfig': void
  'storage.testConnection': StorageConnectionTestResult
}

export interface IpcEventMap {
  'canvas.graphChanged': { graphVersion: string }
  'canvas.planReady': { messageId: string; planId: string }
  'job.progress': JobProgressEvent
  'job.completed': Extract<JobTerminalEvent, { channel: 'job.completed' }>
  'job.failed': Extract<JobTerminalEvent, { channel: 'job.failed' }>
  'asset.changed': { assetId: string; change: 'created' | 'updated' | 'trashed' | 'tombstoned' }
  'gateway.changed': { gatewayId: string; change: 'saved' | 'deleted' | 'reloaded' }
  'style.changed': { stylePresetId: string; change: 'saved' | 'deleted' | 'projectDefaultChanged' }
  'tool.progress': { invocationId: string; message: string; progress?: number }
  'tool.completed': { invocationId: string; output: unknown }
  'tool.failed': { invocationId: string; error: SafeErrorEnvelope }
  'tool.audit': { traceId: string; toolId: string; decision: string }
  'agent.responseReady': { runId: string; messageId: string; response: AgentNonCanvasResponse }
  'agent.delta': { runId: string; messageId: string; delta: string }
  'agent.toolStarted': {
    runId: string
    messageId: string
    callId: string
    toolId: string
    inputSummary: string
  }
  'agent.toolCompleted': {
    runId: string
    messageId: string
    callId: string
    toolId: string
    invocationId: string
    status: 'completed' | 'failed' | 'denied'
    summary: string
  }
  'agent.permissionRequired': {
    runId: string
    messageId: string
    callId: string
    toolId: string
    reason: string
    requiredPermissions: ToolPermission[]
  }
  'agent.progress': { runId: string; message: string }
  'agent.completed': { runId: string; output: string }
  'agent.failed': { runId: string; error: SafeErrorEnvelope }
  'skill.changed': { skillId: string; change: 'loaded' | 'disabled' | 'reloaded' }
  'knowledge.indexed': { documentId: string }
  'knowledge.failed': { documentId: string; error: SafeErrorEnvelope }
}

export type IpcInvokeChannel = keyof IpcRequestMap

export type IpcEventChannel = keyof IpcEventMap

export type AssetChangedEvent = IpcEventMap['asset.changed']
