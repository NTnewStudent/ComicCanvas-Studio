/**
 * Workflow repository boundary for persisted canvas graph versions.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { GraphSnapshot } from '../../../../../shared/composed-prompt'
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
  graph: GraphSnapshot
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

export interface WorkflowRepository {
  create(record: WorkflowCreateRecord): void
  addVersion(record: WorkflowVersionCreateRecord): void
  getLatestVersion(workflowId: string): WorkflowVersionRecord | null
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
  const selectLatest = db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 1')

  return {
    create(record) {
      insertWorkflow.run(record)
    },
    addVersion(record) {
      insertVersion.run({ ...record, graphJson: encodeJson(record.graph) })
    },
    getLatestVersion(workflowId) {
      const row = selectLatest.get(workflowId) as WorkflowVersionRow | undefined

      if (!row) {
        return null
      }

      return {
        id: row.id,
        workflowId: row.workflow_id,
        graph: decodeJson<GraphSnapshot>(row.graph_json) ?? { nodes: [], edges: [] },
        createdAt: row.created_at,
        createdBy: row.created_by
      }
    }
  }
}
