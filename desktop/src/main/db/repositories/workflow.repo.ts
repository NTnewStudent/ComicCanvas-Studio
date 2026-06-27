/**
 * Workflow repository boundary for persisted canvas graph versions.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { CanvasGraphSnapshot } from '../../../../../shared/graph'
import { decodeJson, encodeJson } from './json'

export interface WorkflowCreateRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface WorkflowVersionCreateRecord {
  id: string
  workflowId: string
  graph: CanvasGraphSnapshot
  createdAt: number
  createdBy: string
}

export type WorkflowVersionRecord = WorkflowVersionCreateRecord

interface WorkflowVersionRow {
  id: string
  workflow_id: string
  graph_json: string
  created_at: number
  created_by: string
}

export interface WorkflowSummary {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
}

export interface WorkflowVersionSummary {
  id: string
  createdAt: string
}

export interface WorkflowRepository {
  create(record: WorkflowCreateRecord): void
  addVersion(record: WorkflowVersionCreateRecord): void
  getLatestVersion(workflowId: string): WorkflowVersionRecord | null
  getSummary(workflowId: string): WorkflowSummary | null
  /** 列出所有工作流摘要 */
  list(): WorkflowSummary[]
  /** 列出指定工作流的版本历史 */
  listVersions(workflowId: string, limit?: number): WorkflowVersionSummary[]
  /** 重命名工作流 */
  rename(workflowId: string, name: string): void
  /** 软删除工作流 */
  delete(workflowId: string): void
}

/**
 * Creates a repository for workflows and graph versions.
 * @param db - Open SQLite database handle.
 * @returns Workflow repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createWorkflowRepository(db: BetterSqliteDatabase): WorkflowRepository {
  const insertWorkflow = db.prepare('INSERT INTO workflows (id, name, created_at, updated_at) VALUES (@id, @name, @createdAt, @updatedAt)')
  const insertVersion = db.prepare(`
    INSERT INTO workflow_versions (id, workflow_id, graph_json, created_at, created_by)
    VALUES (@id, @workflowId, @graphJson, @createdAt, @createdBy)
  `)
  const updateWorkflowTimestamp = db.prepare('UPDATE workflows SET updated_at = @createdAt WHERE id = @workflowId')
  const selectLatest = db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 1')
  const selectAllWorkflows = db.prepare(`
    SELECT w.id, w.name, w.updated_at,
      (SELECT COUNT(*) FROM json_each(
        (SELECT wv2.graph_json FROM workflow_versions wv2
         WHERE wv2.workflow_id = w.id
         ORDER BY wv2.created_at DESC LIMIT 1),
        '$.nodes'
      )) as node_count
    FROM workflows w
    WHERE w.deleted_at IS NULL
    ORDER BY w.updated_at DESC
  `)
  const selectWorkflowById = db.prepare(`
    SELECT w.id, w.name, w.updated_at,
      (SELECT COUNT(*) FROM json_each(
        (SELECT wv2.graph_json FROM workflow_versions wv2
         WHERE wv2.workflow_id = w.id
         ORDER BY wv2.created_at DESC LIMIT 1),
        '$.nodes'
      )) as node_count
    FROM workflows w
    WHERE w.deleted_at IS NULL AND w.id = ?
  `)
  const selectVersions = db.prepare('SELECT id, created_at FROM workflow_versions WHERE workflow_id = ? ORDER BY created_at DESC LIMIT ?')
  const updateWorkflowName = db.prepare('UPDATE workflows SET name = @name, updated_at = @updatedAt WHERE id = @workflowId')
  const softDeleteWorkflow = db.prepare('UPDATE workflows SET deleted_at = @deletedAt WHERE id = @workflowId')
  const addVersionTransaction = db.transaction((record: WorkflowVersionCreateRecord) => {
    insertVersion.run({ ...record, graphJson: encodeJson(record.graph) })
    updateWorkflowTimestamp.run(record)
  })

  return {
    create(record) {
      insertWorkflow.run(record)
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
        createdBy: row.created_by
      }
    },
    getSummary(workflowId) {
      interface WorkflowListRow { id: string; name: string; updated_at: number; node_count: number | null }
      const row = selectWorkflowById.get(workflowId) as WorkflowListRow | undefined
      if (!row) {
        return null
      }
      return {
        id: row.id,
        name: row.name,
        updatedAt: new Date(row.updated_at).toISOString(),
        nodeCount: row.node_count ?? 0
      }
    },
    list() {
      interface WorkflowListRow { id: string; name: string; updated_at: number; node_count: number | null }
      const rows = selectAllWorkflows.all() as WorkflowListRow[]
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        updatedAt: new Date(row.updated_at).toISOString(),
        nodeCount: row.node_count ?? 0
      }))
    },
    listVersions(workflowId, limit = 20) {
      interface VersionListRow { id: string; created_at: number }
      const rows = selectVersions.all(workflowId, limit) as VersionListRow[]
      return rows.map((row) => ({
        id: row.id,
        createdAt: new Date(row.created_at).toISOString()
      }))
    },
    rename(workflowId, name) {
      updateWorkflowName.run({ workflowId, name, updatedAt: Date.now() })
    },
    delete(workflowId) {
      softDeleteWorkflow.run({ workflowId, deletedAt: Date.now() })
    }
  }
}
