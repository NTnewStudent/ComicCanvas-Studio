/**
 * 共享聊天消息块契约与纯组装 reducer — 主进程持久化与渲染层实时组装的唯一真源。
 *
 * 渲染层 chatStore 订阅现有 Agent IPC 事件后经 `applyAgentEvent` 组装块；
 * 主进程在 run 终态用同一 reducer 组装并写入 `chat_messages.blocks_json`，
 * 保证两侧块结构一致（属性测试见 tests/chat-blocks.test.ts）。
 *
 * @see docs/api-contracts/agents.md
 */

import type { AgentResponse } from './agents'

/** 一条 assistant/user 回合内的可渲染消息块。 */
export type ChatBlock =
  | { kind: 'text'; markdown: string; streaming: boolean }
  | { kind: 'thinking'; lines: string[] }
  | {
      kind: 'toolCall'
      callId: string
      toolId: string
      status: 'running' | 'completed' | 'failed' | 'denied'
      inputSummary?: string
      resultSummary?: string
      isSubAgent: boolean
    }
  | { kind: 'plan'; planId: string }
  | { kind: 'permission'; callId: string; toolId: string; reason: string; resolved: boolean }
  | { kind: 'error'; errorClass: string; message: string; retryable: boolean }
  | { kind: 'usage'; summary: string }

/** 会话中的一个回合（一条 user 消息或一次 assistant run 的全部输出）。 */
export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  blocks: ChatBlock[]
  runId?: string
  messageId?: string
  status: 'pending' | 'streaming' | 'completed' | 'failed'
  createdAt: number
}

/**
 * Agent 运行期事件的判别联合 — 与现有 IPC 事件字段一一对应，
 * 由订阅方（渲染层 store / 主进程重放器）转换后送入 reducer。
 */
export type AgentChatEvent =
  | { type: 'delta'; delta: string }
  | { type: 'progress'; message: string }
  | { type: 'toolStarted'; callId: string; toolId: string; inputSummary: string }
  | { type: 'toolCompleted'; callId: string; toolId: string; status: 'completed' | 'failed' | 'denied'; summary: string }
  | { type: 'permissionRequired'; callId: string; toolId: string; reason: string }
  | { type: 'permissionResolved'; callId: string }
  | { type: 'responseReady'; response: AgentResponse }
  | { type: 'planReady'; planId: string }
  | { type: 'runFailed'; errorClass: string; message: string; retryable: boolean }

/** 子 Agent 工具 ID — toolCall 块以此区分子 Agent 任务。 */
const SUB_AGENT_TOOL_ID = 'agent.spawnChild'

/** `job.progress` 里以此前缀出现的行是用量摘要，转为 usage 块。 */
const USAGE_LINE_PREFIX = '用量：'

export interface CreateAssistantTurnInput {
  id: string
  runId?: string
  messageId?: string
  createdAt: number
}

/**
 * 创建一个等待事件填充的 assistant 回合。
 * @param input - 回合 ID、run/message 关联与创建时间。
 * @returns 空块、pending 状态的 assistant ChatTurn。
 */
export function createAssistantTurn(input: CreateAssistantTurnInput): ChatTurn {
  return {
    id: input.id,
    role: 'assistant',
    blocks: [],
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.messageId ? { messageId: input.messageId } : {}),
    status: 'pending',
    createdAt: input.createdAt,
  }
}

export interface UserTurnInput {
  id: string
  content: string
  createdAt: number
}

/**
 * 由用户消息内容合成 user 回合（单 text 块）。
 * @param input - 消息 ID、正文与创建时间。
 * @returns completed 状态的 user ChatTurn。
 */
export function userTurnFromContent(input: UserTurnInput): ChatTurn {
  return {
    id: input.id,
    role: 'user',
    blocks: [{ kind: 'text', markdown: input.content, streaming: false }],
    status: 'completed',
    createdAt: input.createdAt,
  }
}

export interface PersistedAssistantInput {
  id: string
  content: string
  blocksJson?: string | null
  planId?: string | null
  runId?: string
  messageId?: string
  createdAt: number
}

function isChatBlockArray(value: unknown): value is ChatBlock[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null && 'kind' in item)
}

/**
 * 从持久化行还原 assistant 回合：优先 blocks_json，损坏或缺失时按 content/planId 降级合成。
 * @param input - 持久化的消息行字段。
 * @returns completed 状态的 assistant ChatTurn。
 */
export function assistantTurnFromPersisted(input: PersistedAssistantInput): ChatTurn {
  let blocks: ChatBlock[] | null = null

  if (input.blocksJson) {
    try {
      const parsed: unknown = JSON.parse(input.blocksJson)
      if (isChatBlockArray(parsed)) {
        blocks = parsed
      }
    } catch {
      // 损坏的持久化块 JSON 不能让历史恢复失败，走 content 降级。
      blocks = null
    }
  }

  if (!blocks) {
    blocks = []
    if (input.content.trim().length > 0) {
      blocks.push({ kind: 'text', markdown: input.content, streaming: false })
    }
    if (input.planId) {
      blocks.push({ kind: 'plan', planId: input.planId })
    }
  }

  return {
    id: input.id,
    role: 'assistant',
    blocks,
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.messageId ? { messageId: input.messageId } : {}),
    status: 'completed',
    createdAt: input.createdAt,
  }
}

function cloneBlocks(blocks: ChatBlock[]): ChatBlock[] {
  return blocks.map((block) => (block.kind === 'thinking' ? { ...block, lines: [...block.lines] } : { ...block }))
}

function appendDelta(blocks: ChatBlock[], delta: string): ChatBlock[] {
  const last = blocks[blocks.length - 1]

  if (last && last.kind === 'text' && last.streaming) {
    return [...blocks.slice(0, -1), { ...last, markdown: last.markdown + delta }]
  }

  return [...blocks, { kind: 'text', markdown: delta, streaming: true }]
}

function appendProgress(blocks: ChatBlock[], message: string): ChatBlock[] {
  if (message.startsWith(USAGE_LINE_PREFIX)) {
    const withoutUsage = blocks.filter((block) => block.kind !== 'usage')
    return [...withoutUsage, { kind: 'usage', summary: message }]
  }

  const index = blocks.findIndex((block) => block.kind === 'thinking')

  if (index === -1) {
    return [...blocks, { kind: 'thinking', lines: [message] }]
  }

  const thinking = blocks[index]
  if (!thinking || thinking.kind !== 'thinking' || thinking.lines.includes(message)) {
    return blocks
  }

  const next = [...blocks]
  next[index] = { kind: 'thinking', lines: [...thinking.lines, message] }
  return next
}

function finalizeText(blocks: ChatBlock[], text: string | null): ChatBlock[] {
  const withoutStreaming = blocks.filter((block) => !(block.kind === 'text' && block.streaming))

  if (text === null || text.length === 0) {
    return withoutStreaming
  }

  return [...withoutStreaming, { kind: 'text', markdown: text, streaming: false }]
}

function responseText(response: AgentResponse): string | null {
  if (response.type === 'answer') {
    return response.text
  }

  if (response.type === 'clarification') {
    return response.question
  }

  return null
}

/**
 * 纯 reducer：把一个 Agent 运行事件应用到回合上，返回新回合（不修改输入）。
 * @param turn - 当前回合快照。
 * @param event - 运行事件。
 * @returns 应用事件后的新 ChatTurn。
 */
export function applyAgentEvent(turn: ChatTurn, event: AgentChatEvent): ChatTurn {
  const blocks = cloneBlocks(turn.blocks)

  switch (event.type) {
    case 'delta':
      return { ...turn, blocks: appendDelta(blocks, event.delta), status: 'streaming' }

    case 'progress':
      return { ...turn, blocks: appendProgress(blocks, event.message), status: turn.status === 'pending' ? 'streaming' : turn.status }

    case 'toolStarted':
      return {
        ...turn,
        status: 'streaming',
        blocks: [
          ...blocks.filter((block) => !(block.kind === 'toolCall' && block.callId === event.callId)),
          {
            kind: 'toolCall',
            callId: event.callId,
            toolId: event.toolId,
            status: 'running',
            inputSummary: event.inputSummary,
            isSubAgent: event.toolId === SUB_AGENT_TOOL_ID,
          },
        ],
      }

    case 'toolCompleted':
      return {
        ...turn,
        blocks: blocks.map((block) =>
          block.kind === 'toolCall' && block.callId === event.callId
            ? { ...block, status: event.status, resultSummary: event.summary }
            : block,
        ),
      }

    case 'permissionRequired':
      // 同一 callId 的权限请求幂等（permissionRequired 事件与 job.failed 恢复路径可能都到达）。
      if (blocks.some((block) => block.kind === 'permission' && block.callId === event.callId)) {
        return { ...turn, blocks }
      }
      return {
        ...turn,
        blocks: [
          ...blocks,
          { kind: 'permission', callId: event.callId, toolId: event.toolId, reason: event.reason, resolved: false },
        ],
      }

    case 'permissionResolved':
      return {
        ...turn,
        blocks: blocks.map((block) =>
          block.kind === 'permission' && block.callId === event.callId ? { ...block, resolved: true } : block,
        ),
      }

    case 'responseReady':
      return {
        ...turn,
        status: 'completed',
        blocks: finalizeText(blocks, responseText(event.response)),
      }

    case 'planReady':
      return {
        ...turn,
        status: 'completed',
        blocks: [...finalizeText(blocks, null), { kind: 'plan', planId: event.planId }],
      }

    case 'runFailed':
      return {
        ...turn,
        status: 'failed',
        blocks: [
          ...finalizeText(blocks, null),
          { kind: 'error', errorClass: event.errorClass, message: event.message, retryable: event.retryable },
        ],
      }
  }
}
