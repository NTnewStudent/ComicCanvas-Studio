import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { ChatBlock } from '../shared/chat-blocks'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createChatMessageRepository } from '../desktop/src/main/db/repositories/chat-message.repo'
import { chatHistoryFromMessages } from '../desktop/src/main/ipc/chat-history'

function withTempDb<T>(run: (db: ReturnType<typeof openDatabaseAtPath>) => T): T {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-chat-history-'))
  const dbPath = join(tempDir, 'chat-history.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    return run(db)
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('chat history persistence', () => {
  it('persists assistant block JSON through updateBlocks and reads it back', () => {
    withTempDb((db) => {
      const repo = createChatMessageRepository(db)
      const blocks: ChatBlock[] = [
        { kind: 'toolCall', callId: 'call-1', toolId: 'canvas.createNode', status: 'completed', resultSummary: 'node-1', isSubAgent: false },
        { kind: 'text', markdown: '已创建节点。', streaming: false },
      ]

      repo.create({ id: 'message-1-assistant', workflowId: 'workflow-1', role: 'assistant', content: '已创建节点。', createdAt: 10 })
      repo.updateBlocks('message-1-assistant', JSON.stringify(blocks))

      const record = repo.getById('message-1-assistant')
      expect(record?.blocksJson).toBe(JSON.stringify(blocks))
    })
  })

  it('builds ordered chat turns from persisted user and assistant rows', () => {
    withTempDb((db) => {
      const repo = createChatMessageRepository(db)

      repo.create({ id: 'message-1', workflowId: 'workflow-1', agentRunId: 'run-1', role: 'user', content: '生成一个图片节点', createdAt: 1 })
      repo.create({ id: 'message-1-assistant', workflowId: 'workflow-1', agentRunId: 'run-1', role: 'assistant', content: '已创建。', createdAt: 2 })
      repo.updateBlocks('message-1-assistant', JSON.stringify([{ kind: 'text', markdown: '已创建。', streaming: false }]))
      repo.create({ id: 'message-2', workflowId: 'workflow-1', agentRunId: 'run-2', role: 'user', content: '再来一个视频', createdAt: 3 })
      // 无 blocks_json 的 assistant 行走 planJson 降级。
      repo.create({ id: 'message-2-plan', workflowId: 'workflow-1', agentRunId: 'run-2', role: 'assistant', content: '', planJson: '{"kind":"plan"}', applyStatus: 'draft', createdAt: 4 })

      const turns = chatHistoryFromMessages(repo.listByWorkflowId('workflow-1'))

      expect(turns.map((turn) => turn.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
      expect(turns[0]).toMatchObject({ blocks: [{ kind: 'text', markdown: '生成一个图片节点', streaming: false }] })
      expect(turns[1]).toMatchObject({ blocks: [{ kind: 'text', markdown: '已创建。', streaming: false }], status: 'completed' })
      expect(turns[3]!.blocks).toContainEqual({ kind: 'plan', planId: 'message-2-plan' })
    })
  })

  it('skips system/tool rows and tolerates corrupt block JSON', () => {
    withTempDb((db) => {
      const repo = createChatMessageRepository(db)

      repo.create({ id: 'sys-1', workflowId: 'workflow-1', role: 'system', content: 'internal', createdAt: 1 })
      repo.create({ id: 'assistant-1', workflowId: 'workflow-1', role: 'assistant', content: '回退文本', createdAt: 2 })
      repo.updateBlocks('assistant-1', '{corrupt json')

      const turns = chatHistoryFromMessages(repo.listByWorkflowId('workflow-1'))

      expect(turns).toHaveLength(1)
      expect(turns[0]).toMatchObject({
        role: 'assistant',
        blocks: [{ kind: 'text', markdown: '回退文本', streaming: false }],
      })
    })
  })
})
