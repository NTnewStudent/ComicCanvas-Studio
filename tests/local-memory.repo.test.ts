import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { applyMigrations, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createLocalMemoryRepository } from '../desktop/src/main/db/repositories/local-memory.repo'

describe('LocalMemoryRepository', () => {
  let root = ''
  let db: ReturnType<typeof openDatabaseAtPath> | null = null

  afterEach(() => {
    db?.close()
    if (root) rmSync(root, { recursive: true, force: true })
    db = null
    root = ''
  })

  it('persists and scopes user, workflow, and agent-role memories locally', () => {
    root = mkdtempSync(join(tmpdir(), 'cc-memory-'))
    db = openDatabaseAtPath(join(root, 'memory.sqlite'))
    applyMigrations(db)
    const repo = createLocalMemoryRepository(db)

    repo.save({ id: 'memory-user', scope: 'user', userId: 'user-a', content: 'Prefer concise replies.', createdAt: 1, updatedAt: 1 })
    repo.save({ id: 'memory-workflow', scope: 'workflow', workflowId: 'workflow-a', content: 'Use black and white line art.', createdAt: 2, updatedAt: 2 })
    repo.save({ id: 'memory-role', scope: 'agentRole', agentRoleId: 'canvas-planner', content: 'Always validate image references.', createdAt: 3, updatedAt: 3 })

    expect(repo.list({ userId: 'user-a', workflowId: 'workflow-a', agentRoleId: 'canvas-planner' }).map((item) => item.id))
      .toEqual(['memory-user', 'memory-workflow', 'memory-role'])
    expect(repo.list({ userId: 'user-b', workflowId: 'workflow-b', agentRoleId: 'qa-verifier' })).toEqual([])
  })
})
