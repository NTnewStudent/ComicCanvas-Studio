/**
 * Chat message repository boundary for conversation, plan, and block records.
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
  blocksJson?: string | null
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
  blocks_json: string | null
  created_at: number
}

export interface ChatMessageRepository {
  create(record: ChatMessageCreateRecord): void
  /** Inserts or replaces one terminal assistant row while preserving its original position. */
  upsertAssistant(record: ChatMessageCreateRecord & { role: 'assistant' }): void
  getById(id: string): ChatMessageRecord | null
  updatePlan(id: string, planJson: string, applyStatus: string): void
  /** Persists the assistant turn's shared chat-block JSON for session restore. */
  updateBlocks(id: string, blocksJson: string): void
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
  record.blocksJson = row.blocks_json

  return record
}

/**
 * Creates a repository for chat messages, plan records, and persisted turn blocks.
 * @param db - Open SQLite database handle.
 * @returns Chat message repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/agents.md
 */
export function createChatMessageRepository(db: BetterSqliteDatabase): ChatMessageRepository {
  const insert = db.prepare(`
    INSERT INTO chat_messages (
      id, workflow_id, agent_run_id, role, content, plan_json, apply_status, blocks_json, created_at
    ) VALUES (
      @id, @workflowId, @agentRunId, @role, @content, @planJson, @applyStatus, @blocksJson, @createdAt
    )
  `)
  const upsertAssistant = db.prepare(`
    INSERT INTO chat_messages (
      id, workflow_id, agent_run_id, role, content, plan_json, apply_status, blocks_json, created_at
    ) VALUES (
      @id, @workflowId, @agentRunId, 'assistant', @content, @planJson, @applyStatus, @blocksJson, @createdAt
    )
    ON CONFLICT(id) DO UPDATE SET
      workflow_id = excluded.workflow_id,
      agent_run_id = excluded.agent_run_id,
      role = 'assistant',
      content = excluded.content,
      plan_json = excluded.plan_json,
      apply_status = excluded.apply_status,
      blocks_json = excluded.blocks_json
  `)
  const selectByWorkflow = db.prepare(`
    SELECT *
    FROM chat_messages
    WHERE workflow_id = @workflowId
      OR (
        workflow_id IS NULL
        AND role = 'assistant'
        AND agent_run_id IN (
          SELECT agent_run_id
          FROM chat_messages
          WHERE workflow_id = @workflowId
            AND agent_run_id IS NOT NULL
        )
      )
    ORDER BY created_at ASC
  `)
  const selectById = db.prepare('SELECT * FROM chat_messages WHERE id = ?')
  const updatePlan = db.prepare('UPDATE chat_messages SET plan_json = @planJson, apply_status = @applyStatus WHERE id = @id')
  const updateBlocks = db.prepare('UPDATE chat_messages SET blocks_json = @blocksJson WHERE id = @id')

  return {
    create(record) {
      insert.run({
        ...record,
        workflowId: record.workflowId ?? null,
        agentRunId: record.agentRunId ?? null,
        planJson: record.planJson ?? null,
        applyStatus: record.applyStatus ?? null,
        blocksJson: record.blocksJson ?? null
      })
    },
    upsertAssistant(record) {
      upsertAssistant.run({
        ...record,
        workflowId: record.workflowId ?? null,
        agentRunId: record.agentRunId ?? null,
        planJson: record.planJson ?? null,
        applyStatus: record.applyStatus ?? null,
        blocksJson: record.blocksJson ?? null
      })
    },
    getById(id) {
      const row = selectById.get(id) as ChatMessageRow | undefined

      return row ? toRecord(row) : null
    },
    updatePlan(id, planJson, applyStatus) {
      updatePlan.run({ id, planJson, applyStatus })
    },
    updateBlocks(id, blocksJson) {
      updateBlocks.run({ id, blocksJson })
    },
    listByWorkflowId(workflowId) {
      const rows = selectByWorkflow.all({ workflowId }) as ChatMessageRow[]

      return rows.map(toRecord)
    }
  }
}
