/**
 * `chat.history` 组装器 — 把持久化 chat_messages 行转换为共享 ChatTurn 列表。
 * @see docs/api-contracts/agents.md
 */

import { assistantTurnFromPersisted, userTurnFromContent, type ChatTurn } from '../../../../shared/chat-blocks'
import type { ChatMessageRecord } from '../db/repositories/chat-message.repo'

/**
 * 把 workflow 会话消息行转换为按时间排序的 ChatTurn 列表。
 * user 行合成单 text 块；assistant 行优先 blocks_json，缺失时按 content/planJson 降级。
 * system/tool 行是内部记录，不进入会话历史。
 * @param messages - `listByWorkflowId` 返回的消息行（已升序）。
 * @returns 会话回合列表。
 */
export function chatHistoryFromMessages(messages: ChatMessageRecord[]): ChatTurn[] {
  const turns: ChatTurn[] = []

  for (const message of messages) {
    if (message.role === 'user') {
      turns.push(userTurnFromContent({
        id: message.id,
        content: message.content,
        ...(message.agentRunId ? { runId: message.agentRunId } : {}),
        createdAt: message.createdAt
      }))
      continue
    }

    if (message.role !== 'assistant') {
      continue
    }

    turns.push(assistantTurnFromPersisted({
      id: message.id,
      content: message.content,
      blocksJson: message.blocksJson ?? null,
      // 存有 planJson 的 assistant 行降级为 plan 块；渲染层按需重新拉取 plan。
      planId: message.planJson ? message.id : null,
      ...(message.agentRunId ? { runId: message.agentRunId } : {}),
      // assistant 行 ID 约定为 `${messageId}-assistant`；还原原始 messageId 供 plan 重取。
      messageId: message.id.replace(/-assistant$/, ''),
      createdAt: message.createdAt,
    }))
  }

  return turns
}
