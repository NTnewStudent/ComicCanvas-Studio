/**
 * Workflow repository boundary for persisted canvas graph versions.
 * @see docs/api-contracts/canvas-plan.md
 */

import { createHash } from 'node:crypto'

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import { isCanvasNodeType, sanitizeCanvasGraphSnapshot, type CanvasGraphSnapshot } from '../../../../../shared/graph'
import type { GraphValidationIssue, GraphValidationSummary } from '../../../../../shared/graph-validation'
import type { NodeStatus } from '../../../../../shared/nodes'
import { decodeJson, encodeJson } from './json'

export interface WorkflowCreateRecord {
  id: string
  name: string
  scope?: 'draft' | 'template'
  published?: boolean
  coverAssetId?: string | null
  archived?: boolean
  description?: string | null
  visibility?: 'private' | 'public'
  ownerId?: string
  tags?: string[]
  thumbnailUrl?: string | null
  createdAt: number
  updatedAt: number
}

export interface WorkflowVersionCreateRecord {
  id: string
  workflowId: string
  graph: CanvasGraphSnapshot
  createdAt: number
  createdBy: string
  restoreSourceVersionId?: string | null
  validationWarnings?: GraphValidationIssue[]
}

export type WorkflowVersionRecord = WorkflowVersionCreateRecord

interface WorkflowVersionRow {
  id: string
  workflow_id: string
  graph_json: string
  created_at: number
  created_by: string
  restore_source_version_id: string | null
  validation_warnings_json: string | null
}

export interface WorkflowSummary {
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
  latestRunStatus: NodeStatus
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

export interface WorkflowVersionSummary {
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
  }
}

export interface WorkflowVersionRestoreInput {
  workflowId: string
  sourceVersionId: string
  restoredVersionId: string
  createdAt: number
  createdBy: string
}

export interface WorkflowTemplateCopyInput {
  templateId: string
  workflowId: string
  graphVersionId: string
  name: string
  createdAt: number
  createdBy: string
}

export interface WorkflowTemplateCopyResult {
  workflowId: string
  graphVersion: string
  name: string
}

export interface WorkflowTemplateListOptions {
  scope?: 'public' | 'my' | 'all'
}

export interface WorkflowTemplatePublishInput {
  workflowId: string
  visibility: 'private' | 'public'
  validation: { valid: boolean; issues: GraphValidationIssue[] }
  updatedAt: number
}

export type WorkflowTemplatePublishResult = WorkflowSummary | {
  errorClass: 'workflow_template_unavailable' | 'workflow_template_validation_failed'
  message: string
  retryable: false
  issues?: GraphValidationIssue[]
}

export interface WorkflowRepository {
  create(record: WorkflowCreateRecord): void
  addVersion(record: WorkflowVersionCreateRecord): void
  getLatestVersion(workflowId: string): WorkflowVersionRecord | null
  getSummary(workflowId: string): WorkflowSummary | null
  /** 列出模板摘要，默认仅返回已发布公共模板 */
  listTemplates(options?: WorkflowTemplateListOptions): WorkflowSummary[]
  /** 通过 strict 校验后发布本地模板 */
  publishTemplate(input: WorkflowTemplatePublishInput): WorkflowTemplatePublishResult
  /** 将公共模板复制为私有草稿工作流 */
  copyTemplateToDraft(input: WorkflowTemplateCopyInput): WorkflowTemplateCopyResult | null
  /** 列出所有工作流摘要 */
  list(): WorkflowSummary[]
  /** 列出指定工作流的版本历史 */
  listVersions(workflowId: string, limit?: number): WorkflowVersionSummary[]
  /** 将历史版本复制为新的最新版本，保留不可变版本历史 */
  restoreVersion(input: WorkflowVersionRestoreInput): WorkflowVersionRecord | null
  /** 重命名工作流 */
  rename(workflowId: string, name: string): void
  /** 软删除工作流 */
  delete(workflowId: string): void
}

interface WorkflowListRow {
  id: string
  name: string
  scope: string
  published: number
  description: string | null
  visibility: string | null
  owner_id: string | null
  tags_json: string | null
  thumbnail_url: string | null
  updated_at: number
  default_style_preset_id: string | null
  cover_asset_id: string | null
  archived: number
  graph_json: string | null
}

function emptyGraph(): CanvasGraphSnapshot {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
}

function checksumGraph(graph: CanvasGraphSnapshot): string {
  return createHash('sha256').update(encodeJson(graph)).digest('hex')
}

function firstAssetId(graph: CanvasGraphSnapshot): string | null {
  for (const node of graph.nodes) {
    const data = node.data as unknown as Record<string, unknown>
    if (typeof data.assetId === 'string' && data.assetId.length > 0) {
      return data.assetId
    }
  }
  return null
}

function latestRunStatus(graph: CanvasGraphSnapshot): NodeStatus {
  const statuses = graph.nodes
    .map((node) => (node.data as unknown as { status?: unknown }).status)
    .filter((status): status is NodeStatus =>
      status === 'idle' || status === 'pending' || status === 'running' || status === 'done' || status === 'error'
    )
  if (statuses.includes('running')) return 'running'
  if (statuses.includes('pending')) return 'pending'
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('done')) return 'done'
  return 'idle'
}

function warningSummary(graph: CanvasGraphSnapshot): WorkflowSummary['warningSummary'] {
  const sanitized = sanitizeCanvasGraphSnapshot(graph)
  const unsupportedNodes = graph.nodes.filter((node) => !isCanvasNodeType(String(node.type))).length
  return {
    unsupportedNodes,
    invalidEdges: graph.edges.length - sanitized.edges.length
  }
}

function summarizeValidationWarnings(warnings: GraphValidationIssue[]): GraphValidationSummary {
  return {
    unsupportedNodes: warnings.filter((warning) => warning.code === 'unsupported_node_type').length,
    invalidEdges: warnings.filter((warning) => warning.code === 'invalid_edge').length,
    unavailableModels: warnings.filter((warning) => warning.code === 'unavailable_model').length,
    unavailableStyles: warnings.filter((warning) => warning.code === 'unavailable_style' || warning.code === 'disabled_style').length,
    unavailableAssets: warnings.filter((warning) => warning.code === 'unavailable_asset' || warning.code === 'missing_asset').length,
  }
}

function warningSummaryFromVersion(row: WorkflowVersionRow, graph: CanvasGraphSnapshot): WorkflowVersionSummary['warningSummary'] {
  const warnings = decodeJson<GraphValidationIssue[]>(row.validation_warnings_json)
  return Array.isArray(warnings) ? summarizeValidationWarnings(warnings) : warningSummary(graph)
}

function readTags(json: string | null): string[] {
  const tags = decodeJson<string[]>(json)
  return Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0) : []
}

function mapSummary(row: WorkflowListRow, currentUserId: string): WorkflowSummary {
  const graph = row.graph_json ? decodeJson<CanvasGraphSnapshot>(row.graph_json) ?? emptyGraph() : emptyGraph()
  const ownerId = row.owner_id ?? 'user-local'
  return {
    id: row.id,
    name: row.name,
    scope: row.scope === 'template' ? 'template' : 'draft',
    published: row.published === 1,
    description: row.description ?? null,
    visibility: row.visibility === 'public' ? 'public' : 'private',
    ownerId,
    ownedByCurrentUser: ownerId === currentUserId,
    tags: readTags(row.tags_json),
    thumbnailUrl: row.thumbnail_url ?? null,
    updatedAt: new Date(row.updated_at).toISOString(),
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    coverAssetId: row.cover_asset_id ?? firstAssetId(graph),
    latestRunStatus: latestRunStatus(graph),
    defaultStylePresetId: row.default_style_preset_id,
    archived: row.archived === 1,
    versionChecksum: checksumGraph(graph),
    warningSummary: warningSummary(graph)
  }
}

/**
 * Creates a repository for workflows and graph versions.
 * @param db - Open SQLite database handle.
 * @returns Workflow repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createWorkflowRepository(db: BetterSqliteDatabase, options: { currentUserId?: string } = {}): WorkflowRepository {
  const currentUserId = options.currentUserId ?? 'user-local'
  const insertWorkflow = db.prepare(`
    INSERT INTO workflows (id, name, scope, published, cover_asset_id, archived, description, visibility, owner_id, tags_json, thumbnail_url, created_at, updated_at)
    VALUES (@id, @name, @scope, @published, @coverAssetId, @archived, @description, @visibility, @ownerId, @tagsJson, @thumbnailUrl, @createdAt, @updatedAt)
  `)
  const insertVersion = db.prepare(`
    INSERT INTO workflow_versions (id, workflow_id, graph_json, created_at, created_by, restore_source_version_id, validation_warnings_json)
    VALUES (@id, @workflowId, @graphJson, @createdAt, @createdBy, @restoreSourceVersionId, @validationWarningsJson)
  `)
  const updateWorkflowTimestamp = db.prepare('UPDATE workflows SET updated_at = @createdAt WHERE id = @workflowId')
  const selectLatest = db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 1')
  const selectAllWorkflows = db.prepare(`
    SELECT w.id, w.name, w.scope, w.published, w.description, w.visibility, w.owner_id, w.tags_json, w.thumbnail_url,
      w.updated_at, w.default_style_preset_id, w.cover_asset_id, w.archived,
      (SELECT wv2.graph_json FROM workflow_versions wv2
       WHERE wv2.workflow_id = w.id
       ORDER BY wv2.created_at DESC LIMIT 1) as graph_json
    FROM workflows w
    WHERE w.deleted_at IS NULL AND w.scope = 'draft'
    ORDER BY w.updated_at DESC
  `)
  const selectWorkflowById = db.prepare(`
    SELECT w.id, w.name, w.scope, w.published, w.description, w.visibility, w.owner_id, w.tags_json, w.thumbnail_url,
      w.updated_at, w.default_style_preset_id, w.cover_asset_id, w.archived,
      (SELECT wv2.graph_json FROM workflow_versions wv2
       WHERE wv2.workflow_id = w.id
       ORDER BY wv2.created_at DESC LIMIT 1) as graph_json
    FROM workflows w
    WHERE w.deleted_at IS NULL AND w.id = ?
  `)
  const selectPublishedTemplates = db.prepare(`
    SELECT w.id, w.name, w.scope, w.published, w.description, w.visibility, w.owner_id, w.tags_json, w.thumbnail_url,
      w.updated_at, w.default_style_preset_id, w.cover_asset_id, w.archived,
      (SELECT wv2.graph_json FROM workflow_versions wv2
       WHERE wv2.workflow_id = w.id
       ORDER BY wv2.created_at DESC LIMIT 1) as graph_json
    FROM workflows w
    WHERE w.deleted_at IS NULL AND w.scope = 'template' AND w.published = 1 AND w.visibility = 'public'
    ORDER BY w.updated_at DESC
  `)
  const selectMyTemplates = db.prepare(`
    SELECT w.id, w.name, w.scope, w.published, w.description, w.visibility, w.owner_id, w.tags_json, w.thumbnail_url,
      w.updated_at, w.default_style_preset_id, w.cover_asset_id, w.archived,
      (SELECT wv2.graph_json FROM workflow_versions wv2
       WHERE wv2.workflow_id = w.id
       ORDER BY wv2.created_at DESC LIMIT 1) as graph_json
    FROM workflows w
    WHERE w.deleted_at IS NULL AND w.scope = 'template' AND w.owner_id = ?
    ORDER BY w.updated_at DESC
  `)
  const selectAllTemplates = db.prepare(`
    SELECT w.id, w.name, w.scope, w.published, w.description, w.visibility, w.owner_id, w.tags_json, w.thumbnail_url,
      w.updated_at, w.default_style_preset_id, w.cover_asset_id, w.archived,
      (SELECT wv2.graph_json FROM workflow_versions wv2
       WHERE wv2.workflow_id = w.id
       ORDER BY wv2.created_at DESC LIMIT 1) as graph_json
    FROM workflows w
    WHERE w.deleted_at IS NULL AND w.scope = 'template'
    ORDER BY w.updated_at DESC
  `)
  const selectVersions = db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY created_at DESC LIMIT ?')
  const selectVersionById = db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? AND id = ? LIMIT 1')
  const updateWorkflowName = db.prepare('UPDATE workflows SET name = @name, updated_at = @updatedAt WHERE id = @workflowId')
  const softDeleteWorkflow = db.prepare('UPDATE workflows SET deleted_at = @deletedAt WHERE id = @workflowId')
  const publishTemplateStmt = db.prepare(`
    UPDATE workflows
    SET published = 1, visibility = @visibility, updated_at = @updatedAt
    WHERE id = @workflowId AND scope = 'template' AND deleted_at IS NULL
  `)
  const copyTemplateTransaction = db.transaction((input: WorkflowTemplateCopyInput) => {
    const template = selectWorkflowById.get(input.templateId) as WorkflowListRow | undefined
    const latest = selectLatest.get(input.templateId) as WorkflowVersionRow | undefined
    if (!template || template.scope !== 'template' || template.published !== 1 || !latest) {
      return null
    }
    const graph = decodeJson<CanvasGraphSnapshot>(latest.graph_json) ?? emptyGraph()
    insertWorkflow.run({
      id: input.workflowId,
      name: input.name,
      scope: 'draft',
      published: 0,
      coverAssetId: template.cover_asset_id ?? firstAssetId(graph),
      archived: 0,
      description: `Copied from template: ${template.name}`,
      visibility: 'private',
      ownerId: input.createdBy,
      tagsJson: template.tags_json ?? '[]',
      thumbnailUrl: template.thumbnail_url,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    })
    insertVersion.run({
      id: input.graphVersionId,
      workflowId: input.workflowId,
      graphJson: encodeJson(graph),
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      restoreSourceVersionId: null,
      validationWarningsJson: null
    })
    return { workflowId: input.workflowId, graphVersion: input.graphVersionId, name: input.name }
  })
  const addVersionTransaction = db.transaction((record: WorkflowVersionCreateRecord) => {
    insertVersion.run({
      ...record,
      graphJson: encodeJson(record.graph),
      restoreSourceVersionId: record.restoreSourceVersionId ?? null,
      validationWarningsJson: record.validationWarnings ? encodeJson(record.validationWarnings) : null
    })
    updateWorkflowTimestamp.run(record)
  })
  const restoreVersionTransaction = db.transaction((input: WorkflowVersionRestoreInput) => {
    const source = selectVersionById.get(input.workflowId, input.sourceVersionId) as WorkflowVersionRow | undefined
    if (!source) {
      return null
    }
    const graph = decodeJson<CanvasGraphSnapshot>(source.graph_json) ?? emptyGraph()
    insertVersion.run({
      id: input.restoredVersionId,
      workflowId: input.workflowId,
      graphJson: encodeJson(graph),
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      restoreSourceVersionId: input.sourceVersionId,
      validationWarningsJson: source.validation_warnings_json
    })
    updateWorkflowTimestamp.run({ workflowId: input.workflowId, createdAt: input.createdAt })
    return {
      id: input.restoredVersionId,
      workflowId: input.workflowId,
      graph,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      restoreSourceVersionId: input.sourceVersionId
    }
  })

  return {
    create(record) {
      insertWorkflow.run({
        ...record,
        scope: record.scope ?? 'draft',
        published: record.published ? 1 : 0,
        coverAssetId: record.coverAssetId ?? null,
        archived: record.archived ? 1 : 0,
        description: record.description ?? null,
        visibility: record.visibility ?? (record.published ? 'public' : 'private'),
        ownerId: record.ownerId ?? currentUserId,
        tagsJson: encodeJson(record.tags ?? []),
        thumbnailUrl: record.thumbnailUrl ?? null
      })
    },
    addVersion(record) {
      addVersionTransaction(record)
    },
    getLatestVersion(workflowId) {
      const row = selectLatest.get(workflowId) as WorkflowVersionRow | undefined

      if (!row) {
        return null
      }

      return {
        id: row.id,
        workflowId: row.workflow_id,
        graph: decodeJson<CanvasGraphSnapshot>(row.graph_json) ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        createdAt: row.created_at,
        createdBy: row.created_by,
        restoreSourceVersionId: row.restore_source_version_id,
        validationWarnings: decodeJson<GraphValidationIssue[]>(row.validation_warnings_json) ?? []
      }
    },
    getSummary(workflowId) {
      const row = selectWorkflowById.get(workflowId) as WorkflowListRow | undefined
      if (!row) {
        return null
      }
      return mapSummary(row, currentUserId)
    },
    listTemplates(options = {}) {
      const scope = options.scope ?? 'public'
      const rows = scope === 'my'
        ? selectMyTemplates.all(currentUserId) as WorkflowListRow[]
        : scope === 'all'
          ? selectAllTemplates.all() as WorkflowListRow[]
          : selectPublishedTemplates.all() as WorkflowListRow[]
      return rows.map((row) => mapSummary(row, currentUserId))
    },
    publishTemplate(input) {
      const summary = this.getSummary(input.workflowId)
      if (!summary || summary.scope !== 'template') {
        return {
          errorClass: 'workflow_template_unavailable',
          message: 'Workflow template is unavailable.',
          retryable: false,
        }
      }
      if (!input.validation.valid) {
        return {
          errorClass: 'workflow_template_validation_failed',
          message: 'Workflow template cannot be published until strict validation passes.',
          retryable: false,
          issues: input.validation.issues,
        }
      }
      publishTemplateStmt.run(input)
      return this.getSummary(input.workflowId) ?? {
        errorClass: 'workflow_template_unavailable',
        message: 'Workflow template is unavailable.',
        retryable: false,
      }
    },
    copyTemplateToDraft(input) {
      return copyTemplateTransaction(input)
    },
    list() {
      const rows = selectAllWorkflows.all() as WorkflowListRow[]
      return rows.map((row) => mapSummary(row, currentUserId))
    },
    listVersions(workflowId, limit = 20) {
      const rows = selectVersions.all(workflowId, limit) as WorkflowVersionRow[]
      return rows.map((row) => {
        const graph = decodeJson<CanvasGraphSnapshot>(row.graph_json) ?? emptyGraph()
        return {
          id: row.id,
          createdAt: new Date(row.created_at).toISOString(),
          createdBy: row.created_by,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          checksum: checksumGraph(graph),
          restoreSourceVersionId: row.restore_source_version_id,
          warningSummary: warningSummaryFromVersion(row, graph)
        }
      })
    },
    restoreVersion(input) {
      return restoreVersionTransaction(input)
    },
    rename(workflowId, name) {
      updateWorkflowName.run({ workflowId, name, updatedAt: Date.now() })
    },
    delete(workflowId) {
      softDeleteWorkflow.run({ workflowId, deletedAt: Date.now() })
    }
  }
}
