import { describe, expect, it, vi } from 'vitest'

import type { AgentLoopMessage } from '../desktop/src/main/agent/context-loop'
import { autoCompact, estimateLoopTokens, foldHistory, trimToolResult } from '../desktop/src/main/agent/compaction'

function longText(length: number, seed = 'x'): string {
  return seed.repeat(length)
}

function baseMessages(): AgentLoopMessage[] {
  return [
    { role: 'system', content: 'You are the ComicCanvas orchestrator.' },
    { role: 'user', content: '生成一个漫剧短片工作流' },
  ]
}

function expectNoOrphanToolMessages(messages: readonly AgentLoopMessage[]): void {
  const pending = new Set<string>()

  for (const message of messages) {
    if (message.role === 'assistant') {
      expect([...pending], 'assistant message split from its tool observations').toEqual([])
      for (const call of message.toolCalls ?? []) {
        pending.add(call.id)
      }
      continue
    }

    if (message.role === 'tool') {
      const toolCallId = message.toolCallId ?? message.invocationId
      expect(pending.has(toolCallId), `orphan tool observation ${toolCallId}`).toBe(true)
      pending.delete(toolCallId)
    }
  }

  expect([...pending], 'tool-calling assistant left without complete observations').toEqual([])
}

describe('L1 trimToolResult', () => {
  it('keeps short results untouched', () => {
    expect(trimToolResult('short result')).toBe('short result')
  })

  it('keeps head and tail with an explicit truncation marker', () => {
    const content = `${longText(2000, 'h')}${longText(2000, 't')}`
    const trimmed = trimToolResult(content)

    expect(trimmed.length).toBeLessThan(content.length)
    expect(trimmed.startsWith('h'.repeat(100))).toBe(true)
    expect(trimmed.endsWith('t'.repeat(100))).toBe(true)
    expect(trimmed).toContain('[truncated 2400 chars]')
  })
})

describe('L2 foldHistory', () => {
  it('folds oldest completed tool call/result pairs into one-line notes until under budget', () => {
    const messages: AgentLoopMessage[] = [
      ...baseMessages(),
      { role: 'assistant', content: '', toolCalls: [{ id: 'call-1', toolId: 'canvas.queryGraph', input: {} }] },
      { role: 'tool', toolId: 'canvas.queryGraph', invocationId: 'inv-1', status: 'completed', content: longText(4000) },
      { role: 'assistant', content: '', toolCalls: [{ id: 'call-2', toolId: 'canvas.createNode', input: {} }] },
      { role: 'tool', toolId: 'canvas.createNode', invocationId: 'inv-2', status: 'completed', content: longText(4000) },
      { role: 'assistant', content: '继续处理。' },
    ]
    const before = estimateLoopTokens(messages)
    const result = foldHistory(messages, { tokenBudget: before - 500 })

    expect(result.foldedPairs).toBeGreaterThan(0)
    expect(result.tokenEstimate).toBeLessThan(before)
    // 折叠注记保留工具 ID 摘要。
    expect(result.messages.some((message) => message.role === 'system' && message.content.includes('canvas.queryGraph'))).toBe(true)
    // 受保护消息不动。
    expect(result.messages[0]).toEqual(messages[0])
    expect(result.messages.some((message) => message.role === 'user' && message.content === '生成一个漫剧短片工作流')).toBe(true)
    expect(result.messages.at(-1)).toEqual(messages.at(-1))
  })

  it('never folds pending tool calls without results', () => {
    const messages: AgentLoopMessage[] = [
      ...baseMessages(),
      { role: 'assistant', content: '', toolCalls: [{ id: 'call-9', toolId: 'canvas.runNode', input: {} }] },
    ]
    const result = foldHistory(messages, { tokenBudget: 1 })

    expect(result.foldedPairs).toBe(0)
    expect(result.messages).toEqual(messages)
  })

  it('does not use toolId fallback when an explicit toolCallId mismatches', () => {
    const messages: AgentLoopMessage[] = [
      ...baseMessages(),
      { role: 'assistant', content: '', toolCalls: [{ id: 'call-expected', toolId: 'canvas.queryGraph', input: {} }] },
      {
        role: 'tool',
        toolId: 'canvas.queryGraph',
        invocationId: 'inv-mismatched',
        toolCallId: 'call-other',
        status: 'completed',
        content: longText(4000)
      }
    ]

    const result = foldHistory(messages, { tokenBudget: 1 })

    expect(result.foldedPairs).toBe(0)
    expect(result.messages).toEqual(messages)
  })

  it('folds an assistant multi-tool group atomically', () => {
    const messages: AgentLoopMessage[] = [
      ...baseMessages(),
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-1', toolId: 'canvas.queryGraph', input: { page: 1 } },
          { id: 'call-2', toolId: 'canvas.queryGraph', input: { page: 2 } }
        ]
      },
      { role: 'tool', toolId: 'canvas.queryGraph', invocationId: 'inv-1', toolCallId: 'call-1', status: 'completed', content: longText(3000, 'a') },
      { role: 'tool', toolId: 'canvas.queryGraph', invocationId: 'inv-2', toolCallId: 'call-2', status: 'completed', content: longText(3000, 'b') },
      { role: 'assistant', content: '继续处理。' }
    ]
    const result = foldHistory(messages, { tokenBudget: estimateLoopTokens(messages) - 500 })

    expect(result.foldedPairs).toBe(2)
    expectNoOrphanToolMessages(result.messages)
    expect(result.messages.filter((message) => message.role === 'system' && message.content.includes('canvas.queryGraph'))).toHaveLength(1)
  })

  it('is a no-op when already under budget', () => {
    const messages = baseMessages()
    const result = foldHistory(messages, { tokenBudget: 100000 })

    expect(result.foldedPairs).toBe(0)
    expect(result.messages).toEqual(messages)
  })
})

describe('L3 autoCompact', () => {
  it('summarizes the prefix through the provided summarizer and keeps the recent tail', async () => {
    const middle: AgentLoopMessage[] = Array.from({ length: 10 }, (_, index) => ({
      role: 'assistant' as const,
      content: `第 ${index} 轮长输出：${longText(2000)}`,
    }))
    const messages: AgentLoopMessage[] = [...baseMessages(), ...middle]
    const summarize = vi.fn().mockResolvedValue('前文摘要：已经完成 10 轮草稿。')

    const result = await autoCompact(messages, { tokenBudget: 2000, keepRecent: 4, summarize })

    expect(summarize).toHaveBeenCalledTimes(1)
    expect(result.compactionSummary).toBe('前文摘要：已经完成 10 轮草稿。')
    expect(result.tokenEstimate).toBeLessThan(estimateLoopTokens(messages))
    // 保留 system + 摘要 + 最近 4 条。
    expect(result.messages[0]).toEqual(messages[0])
    expect(result.messages.some((message) => message.role === 'system' && message.content.includes('前文摘要'))).toBe(true)
    expect(result.messages.slice(-4)).toEqual(messages.slice(-4))
    expect(result.omittedMessages).toBeGreaterThan(0)
  })

  it('falls back to hard truncation when the summarizer fails', async () => {
    const middle: AgentLoopMessage[] = Array.from({ length: 10 }, (_, index) => ({
      role: 'assistant' as const,
      content: `第 ${index} 轮：${longText(2000)}`,
    }))
    const messages: AgentLoopMessage[] = [...baseMessages(), ...middle]
    const summarize = vi.fn().mockRejectedValue(new Error('gateway down'))

    const result = await autoCompact(messages, { tokenBudget: 2000, keepRecent: 4, summarize })

    expect(result.compactionSummary).toBeNull()
    expect(result.omittedMessages).toBeGreaterThan(0)
    expect(result.tokenEstimate).toBeLessThan(estimateLoopTokens(messages))
    expect(result.messages[0]).toEqual(messages[0])
    expect(result.messages.slice(-4)).toEqual(messages.slice(-4))
  })

  it('keeps recent assistant multi-tool groups atomically on summary and fallback paths', async () => {
    const messages: AgentLoopMessage[] = [
      ...baseMessages(),
      { role: 'assistant', content: longText(3000, 'p') },
      {
        role: 'assistant',
        content: 'read twice',
        toolCalls: [
          { id: 'call-1', toolId: 'canvas.queryGraph', input: { page: 1 } },
          { id: 'call-2', toolId: 'canvas.queryGraph', input: { page: 2 } }
        ]
      },
      { role: 'tool', toolId: 'canvas.queryGraph', invocationId: 'inv-1', toolCallId: 'call-1', status: 'completed', content: longText(1000, 'a') },
      { role: 'tool', toolId: 'canvas.queryGraph', invocationId: 'inv-2', toolCallId: 'call-2', status: 'completed', content: longText(1000, 'b') }
    ]

    const summarized = await autoCompact(messages, {
      tokenBudget: 200,
      keepRecent: 2,
      summarize: vi.fn().mockResolvedValue('summary')
    })
    const fallback = await autoCompact(messages, {
      tokenBudget: 200,
      keepRecent: 2,
      summarize: vi.fn().mockRejectedValue(new Error('gateway down'))
    })

    expectNoOrphanToolMessages(summarized.messages)
    expectNoOrphanToolMessages(fallback.messages)
    expect(summarized.messages.filter((message) => message.role === 'tool')).toHaveLength(2)
    expect(fallback.messages.filter((message) => message.role === 'tool')).toHaveLength(2)
  })

  it('is a no-op under budget and never calls the summarizer', async () => {
    const messages = baseMessages()
    const summarize = vi.fn()

    const result = await autoCompact(messages, { tokenBudget: 100000, keepRecent: 4, summarize })

    expect(summarize).not.toHaveBeenCalled()
    expect(result.messages).toEqual(messages)
    expect(result.omittedMessages).toBe(0)
  })
})
