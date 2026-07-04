/**
 * Chat message repository boundary for conversation and plan records.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

export interface ChatMessageCreateRecord {
  id: string
  workflowId?: string
  agentRunId?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  planJson?: string | null
  applyStatus?: string | null
  createdAt: number
}

export type ChatMessageRecord = ChatMessageCreateRecord

interface ChatMessageRow {
  id: string
  workflow_id: string | null
  agent_run_id: string | null
  role: ChatMessageCreateRecord['role']
  content: string
  plan_json: string | null
  apply_status: string | null
  created_at: number
}

export interface ChatMessageRepository {
  create(record: ChatMessageCreateRecord): void
  getById(id: string): ChatMessageRecord | null
  updatePlan(id: string, planJson: string, applyStatus: string): void
  listByWorkflowId(workflowId: string): ChatMessageRecord[]
}

function toRecord(row: ChatMessageRow): ChatMessageRecord {
  const record: ChatMessageRecord = {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  }

  if (row.workflow_id) record.workflowId = row.workflow_id
  if (row.agent_run_id) record.agentRunId = row.agent_run_id
  record.planJson = row.plan_json
  record.applyStatus = row.apply_status

  return record
}

/**
 * Creates a repository for chat messages and plan records.
 * @param db - Open SQLite database handle.
 * @returns Chat message repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/agents.md
 */
export function createChatMessageRepository(db: BetterSqliteDatabase): ChatMessageRepository {
  const insert = db.prepare(`
    INSERT INTO chat_messages (
      id, workflow_id, agent_run_id, role, content, plan_json, apply_status, created_at
    ) VALUES (
      @id, @workflowId, @agentRunId, @role, @content, @planJson, @applyStatus, @createdAt
    )
  `)
  const selectByWorkflow = db.prepare('SELECT * FROM chat_messages WHERE workflow_id = ? ORDER BY created_at ASC')
  const selectById = db.prepare('SELECT * FROM chat_messages WHERE id = ?')
  const updatePlan = db.prepare('UPDATE chat_messages SET plan_json = @planJson, apply_status = @applyStatus WHERE id = @id')

  return {
    create(record) {
      insert.run({
        ...record,
        workflowId: record.workflowId ?? null,
        agentRunId: record.agentRunId ?? null,
        planJson: record.planJson ?? null,
        applyStatus: record.applyStatus ?? null
      })
    },
    getById(id) {
      const row = selectById.get(id) as ChatMessageRow | undefined

      return row ? toRecord(row) : null
    },
    updatePlan(id, planJson, applyStatus) {
      updatePlan.run({ id, planJson, applyStatus })
    },
    listByWorkflowId(workflowId) {
      const rows = selectByWorkflow.all(workflowId) as ChatMessageRow[]

      return rows.map(toRecord)
    }
  }
}
