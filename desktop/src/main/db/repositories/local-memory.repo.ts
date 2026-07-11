/** Local-only scoped memory persistence boundary. */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'
import type { LocalMemoryRecord, LocalMemoryScope } from '../../../../../shared/memory'

export type { LocalMemoryRecord, LocalMemoryScope } from '../../../../../shared/memory'

export interface LocalMemoryRepository {
  save(record: LocalMemoryRecord): LocalMemoryRecord
  list(scope: { userId?: string; workflowId?: string; agentRoleId?: string }): LocalMemoryRecord[]
}

interface Row {
  id: string
  scope: LocalMemoryScope
  user_id: string | null
  workflow_id: string | null
  agent_role_id: string | null
  content: string
  created_at: number
  updated_at: number
}

function record(row: Row): LocalMemoryRecord {
  return {
    id: row.id, scope: row.scope, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at,
    ...(row.user_id ? { userId: row.user_id } : {}),
    ...(row.workflow_id ? { workflowId: row.workflow_id } : {}),
    ...(row.agent_role_id ? { agentRoleId: row.agent_role_id } : {})
  }
}

/** Creates the local-only memory repository. */
export function createLocalMemoryRepository(db: BetterSqliteDatabase): LocalMemoryRepository {
  const upsert = db.prepare(`
    INSERT INTO local_memories (id, scope, user_id, workflow_id, agent_role_id, content, created_at, updated_at)
    VALUES (@id, @scope, @userId, @workflowId, @agentRoleId, @content, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `)
  const select = db.prepare(`
    SELECT * FROM local_memories
    WHERE (scope = 'user' AND user_id = @userId)
       OR (scope = 'workflow' AND workflow_id = @workflowId)
       OR (scope = 'agentRole' AND agent_role_id = @agentRoleId)
    ORDER BY created_at ASC, id ASC
  `)
  return {
    save(value) {
      upsert.run({ ...value, userId: value.userId ?? null, workflowId: value.workflowId ?? null, agentRoleId: value.agentRoleId ?? null })
      return value
    },
    list(scope) {
      return (select.all({ userId: scope.userId ?? '', workflowId: scope.workflowId ?? '', agentRoleId: scope.agentRoleId ?? '' }) as Row[]).map(record)
    }
  }
}
