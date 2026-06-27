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
import type {
  AssetFolder,
  AssetFolderCreateRequest,
  AssetFolderDeleteRequest,
  AssetFolderDeleteResponse,
  AssetImportRequest,
  AssetMoveRequest,
  AssetRecord,
  AssetTrashRequest,
  AssetTrashResponse
} from './assets'
import type { GatewayConfigInput, GatewayConfigView } from './gateway'
import type { JobCreateInput, JobListFilter, JobProgressEvent, JobRecord, JobRecoveryReport, JobTerminalEvent, JobTicket } from './jobs'
import type { CanvasPlan, PlanRunStep } from './plan'
import type { AgentDefinition, AgentRunRequest, AgentRunTicket, SpawnSubAgentInput, SpawnSubAgentResult } from './agents'
import type { SkillDefinition, SkillInvocationRecord, SkillInvokeRequest, SkillListRequest } from './skills'
import type { ContextBuildInput, ContextPack, KnowledgeDocument, KnowledgeIngestRequest, KnowledgeQuery, KnowledgeChunk } from './knowledge'
import type { ToolDescriptor, ToolInvocationRecord } from './tools'
import type { StylePresetSaveInput, StylePresetView, StyleProjectDefaultRequest } from './styles'
import type { CanvasSnippetDeleteRequest, CanvasSnippetDeleteResponse, CanvasSnippetSaveInput, CanvasSnippetSaveResponse, CanvasSnippetView } from './snippets'

export type CanvasIpcChannel =
  | 'canvas.chatSend'
  | 'canvas.chatGetPlan'
  | 'canvas.applyPlan'
  | 'canvas.runPlan'
  | 'canvas.runNode'
  | 'canvas.saveGraph'
  | 'canvas.loadGraph'
  | 'canvas.graphChanged'
  | 'canvas.planReady'
  | 'canvas.listWorkflows'
  | 'canvas.createWorkflow'
  | 'canvas.renameWorkflow'
  | 'canvas.deleteWorkflow'
  | 'canvas.exportWorkflow'
  | 'canvas.importWorkflow'

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
  | 'asset.get'
  | 'asset.list'
  | 'asset.move'
  | 'asset.trash'
  | 'asset.getFolders'
  | 'asset.createFolder'
  | 'asset.deleteFolder'
  | 'asset.changed'

export type GatewayIpcChannel =
  | 'gateway.list'
  | 'gateway.save'
  | 'gateway.delete'
  | 'gateway.test'
  | 'gateway.reload'
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
  | 'agent.spawn'
  | 'agent.progress'
  | 'agent.completed'
  | 'agent.failed'

export type SkillIpcChannel =
  | 'skill.list'
  | 'skill.reload'
  | 'skill.getMetadata'
  | 'skill.invoke'
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
  updatedAt: string
  nodeCount: number
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

export interface IpcRequestMap {
  'canvas.chatSend': { message: string; agentId?: string }
  'canvas.chatGetPlan': { messageId: string }
  'canvas.applyPlan': CanvasApplyPlanRequest
  'canvas.runPlan': CanvasRunPlanRequest
  'canvas.runNode': { nodeId: string; workflowId?: string }
  'canvas.saveGraph': CanvasSaveGraphRequest
  'canvas.loadGraph': CanvasLoadGraphRequest
  'canvas.listWorkflows': void
  'canvas.createWorkflow': { name: string }
  'canvas.renameWorkflow': { workflowId: string; name: string }
  'canvas.deleteWorkflow': { workflowId: string }
  'canvas.exportWorkflow': { workflowId: string }
  'canvas.importWorkflow': WorkflowImportRequest
  'job.enqueue': JobCreateInput
  'job.get': { jobId: string }
  'job.list': JobListFilter
  'job.recover': Record<string, never>
  'asset.import': AssetImportRequest
  'asset.get': { assetId: string }
  'asset.list': { folderId?: string; mediaType?: string; keyword?: string }
  'asset.move': AssetMoveRequest
  'asset.trash': AssetTrashRequest
  'asset.getFolders': Record<string, never>
  'asset.createFolder': AssetFolderCreateRequest
  'asset.deleteFolder': AssetFolderDeleteRequest
  'gateway.list': Record<string, never>
  'gateway.save': GatewayConfigInput
  'gateway.delete': { gatewayId: string }
  'gateway.test': { gatewayId: string; channel: 'text' | 'image' | 'video' }
  'gateway.reload': { gatewayId?: string }
  'style.list': { includeDisabled?: boolean }
  'style.save': StylePresetSaveInput
  'style.delete': { stylePresetId: string }
  'style.setProjectDefault': StyleProjectDefaultRequest
  'style.getProjectDefault': { workflowId: string }
  'canvasSnippet.list': Record<string, never>
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
  'agent.spawn': SpawnSubAgentInput
  'skill.list': SkillListRequest
  'skill.reload': { skillId?: string }
  'skill.getMetadata': { skillId: string }
  'skill.invoke': SkillInvokeRequest
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
  'canvas.chatSend': { jobId: string; messageId: string; status: 'pending' }
  'canvas.chatGetPlan': CanvasPlan
  'canvas.applyPlan': CanvasApplyPlanResponse
  'canvas.runPlan': CanvasRunPlanResponse
  'canvas.runNode': JobTicket
  'canvas.saveGraph': CanvasSaveGraphResponse
  'canvas.loadGraph': CanvasGraphSnapshot
  'canvas.listWorkflows': WorkflowSummaryView[]
  'canvas.createWorkflow': { id: string; name: string }
  'canvas.renameWorkflow': { id: string; name: string }
  'canvas.deleteWorkflow': { id: string; deleted: true }
  'canvas.exportWorkflow': WorkflowExportView
  'canvas.importWorkflow': WorkflowImportResponse | { errorClass: string; message: string; retryable: false }
  'job.enqueue': JobTicket
  'job.get': JobRecord
  'job.list': JobRecord[]
  'job.recover': JobRecoveryReport
  'asset.import': AssetRecord
  'asset.get': AssetRecord
  'asset.list': AssetRecord[]
  'asset.move': AssetRecord
  'asset.trash': AssetTrashResponse
  'asset.getFolders': AssetFolder[]
  'asset.createFolder': AssetFolder
  'asset.deleteFolder': AssetFolderDeleteResponse
  'gateway.list': GatewayConfigView[]
  'gateway.save': GatewayConfigView
  'gateway.delete': { gatewayId: string; deleted: true }
  'gateway.test': JobTicket
  'gateway.reload': { reloadedGatewayIds: string[] }
  'style.list': StylePresetView[]
  'style.save': StylePresetView
  'style.delete': { stylePresetId: string; deleted: true }
  'style.setProjectDefault': { workflowId: string; stylePresetId: string | null }
  'style.getProjectDefault': { workflowId: string; stylePresetId: string | null }
  'canvasSnippet.list': CanvasSnippetView[]
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
  'agent.spawn': SpawnSubAgentResult
  'skill.list': SkillDefinition[]
  'skill.reload': { reloadedSkillIds: string[] }
  'skill.getMetadata': SkillDefinition
  'skill.invoke': SkillInvocationRecord
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
