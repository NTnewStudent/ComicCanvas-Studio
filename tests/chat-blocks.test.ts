import { describe, expect, it } from 'vitest'

import {
  applyAgentEvent,
  assistantTurnFromPersisted,
  createAssistantTurn,
  userTurnFromContent,
  type AgentChatEvent,
  type ChatTurn,
} from '../shared/chat-blocks'

function baseTurn(): ChatTurn {
  return createAssistantTurn({ id: 'turn-1', runId: 'run-1', messageId: 'message-1', createdAt: 1_784_000_000_000 })
}

function reduceAll(turn: ChatTurn, events: AgentChatEvent[]): ChatTurn {
  return events.reduce((current, event) => applyAgentEvent(current, event), turn)
}

describe('shared chat-blocks reducer', () => {
  it('merges streaming deltas into one trailing text block', () => {
    const turn = reduceAll(baseTurn(), [
      { type: 'delta', delta: '你好' },
      { type: 'delta', delta: '，世界' },
    ])

    expect(turn.blocks).toEqual([
      { kind: 'text', markdown: '你好，世界', streaming: true },
    ])
    expect(turn.status).toBe('streaming')
  })

  it('appends a running toolCall block and updates it in place on completion', () => {
    const turn = reduceAll(baseTurn(), [
      { type: 'toolStarted', callId: 'call-1', toolId: 'canvas.createNode', inputSummary: 'Create text node' },
      { type: 'toolCompleted', callId: 'call-1', toolId: 'canvas.createNode', status: 'completed', summary: 'node-1 created' },
    ])

    expect(turn.blocks).toEqual([
      {
        kind: 'toolCall',
        callId: 'call-1',
        toolId: 'canvas.createNode',
        status: 'completed',
        inputSummary: 'Create text node',
        resultSummary: 'node-1 created',
        isSubAgent: false,
      },
    ])
  })

  it('marks agent.spawnChild tool calls as sub-agent blocks', () => {
    const turn = reduceAll(baseTurn(), [
      { type: 'toolStarted', callId: 'call-2', toolId: 'agent.spawnChild', inputSummary: 'Spawn child agent: research' },
    ])

    expect(turn.blocks[0]).toMatchObject({ kind: 'toolCall', toolId: 'agent.spawnChild', isSubAgent: true })
  })

  it('deduplicates progress lines into a thinking block and routes usage lines to a usage block', () => {
    const turn = reduceAll(baseTurn(), [
      { type: 'progress', message: '理解用户输入' },
      { type: 'progress', message: '理解用户输入' },
      { type: 'progress', message: '拆解需求' },
      { type: 'progress', message: '用量：输入 1.2k / 输出 340 tokens' },
    ])

    expect(turn.blocks).toEqual([
      { kind: 'thinking', lines: ['理解用户输入', '拆解需求'] },
      { kind: 'usage', summary: '用量：输入 1.2k / 输出 340 tokens' },
    ])
  })

  it('completes the turn with final answer text and stops streaming', () => {
    const turn = reduceAll(baseTurn(), [
      { type: 'delta', delta: '今天' },
      { type: 'responseReady', response: { type: 'answer', summary: 's', text: '今天是星期三。', dropped: [] } },
    ])

    expect(turn.status).toBe('completed')
    expect(turn.blocks).toEqual([
      { kind: 'text', markdown: '今天是星期三。', streaming: false },
    ])
  })

  it('appends a plan block on planReady and completes the turn', () => {
    const turn = reduceAll(baseTurn(), [
      { type: 'planReady', planId: 'plan-1' },
    ])

    expect(turn.blocks).toEqual([{ kind: 'plan', planId: 'plan-1' }])
    expect(turn.status).toBe('completed')
  })

  it('tracks permission blocks and resolves them', () => {
    const turn = reduceAll(baseTurn(), [
      {
        type: 'permissionRequired',
        callId: 'call-3',
        toolId: 'canvas.deleteNode',
        reason: '删除节点需要确认',
        requiredPermissions: [{ kind: 'destructive', reason: '删除画布数据' }]
      },
      { type: 'permissionResolved', callId: 'call-3', scope: 'once' },
    ])

    expect(turn.blocks).toEqual([
      {
        kind: 'permission',
        callId: 'call-3',
        toolId: 'canvas.deleteNode',
        reason: '删除节点需要确认',
        requiredPermissions: [{ kind: 'destructive', reason: '删除画布数据' }],
        resolved: true,
        scope: 'once'
      },
    ])
  })

  it('records run failure as an error block and fails the turn', () => {
    const turn = reduceAll(baseTurn(), [
      { type: 'runFailed', errorClass: 'gateway_retry_exhausted', message: '网关重试耗尽', retryable: true },
    ])

    expect(turn.status).toBe('failed')
    expect(turn.blocks).toEqual([
      { kind: 'error', errorClass: 'gateway_retry_exhausted', message: '网关重试耗尽', retryable: true },
    ])
  })

  it('is pure and deterministic: same event sequence yields deeply equal turns without mutating input', () => {
    const events: AgentChatEvent[] = [
      { type: 'progress', message: '开始编排' },
      { type: 'delta', delta: '正在生成' },
      { type: 'toolStarted', callId: 'call-1', toolId: 'canvas.queryGraph', inputSummary: '{}' },
      { type: 'toolCompleted', callId: 'call-1', toolId: 'canvas.queryGraph', status: 'completed', summary: '3 nodes' },
      { type: 'responseReady', response: { type: 'answer', summary: 's', text: '完成', dropped: [] } },
    ]

    const start = baseTurn()
    const snapshot = JSON.parse(JSON.stringify(start)) as ChatTurn
    const first = reduceAll(start, events)
    const second = reduceAll(baseTurn(), events)

    expect(start).toEqual(snapshot)
    expect(first).toEqual(second)
    expect(first.blocks).not.toBe(second.blocks)
  })

  it('builds user turns and rehydrates persisted assistant turns with fallbacks', () => {
    const user = userTurnFromContent({ id: 'user-1', content: '生成一个短视频', createdAt: 1 })
    expect(user).toEqual({
      id: 'user-1',
      role: 'user',
      blocks: [{ kind: 'text', markdown: '生成一个短视频', streaming: false }],
      status: 'completed',
      createdAt: 1,
    })

    const fromBlocks = assistantTurnFromPersisted({
      id: 'assistant-1',
      content: '忽略我',
      blocksJson: JSON.stringify([{ kind: 'text', markdown: '块优先', streaming: false }]),
      createdAt: 2,
    })
    expect(fromBlocks.blocks).toEqual([{ kind: 'text', markdown: '块优先', streaming: false }])

    const fromContent = assistantTurnFromPersisted({ id: 'assistant-2', content: '纯文本回退', createdAt: 3 })
    expect(fromContent.blocks).toEqual([{ kind: 'text', markdown: '纯文本回退', streaming: false }])

    const fromPlan = assistantTurnFromPersisted({ id: 'assistant-3', content: '', planId: 'plan-9', createdAt: 4 })
    expect(fromPlan.blocks).toEqual([{ kind: 'plan', planId: 'plan-9' }])

    const corrupt = assistantTurnFromPersisted({ id: 'assistant-4', content: '回退', blocksJson: '{bad json', createdAt: 5 })
    expect(corrupt.blocks).toEqual([{ kind: 'text', markdown: '回退', streaming: false }])
  })
})
