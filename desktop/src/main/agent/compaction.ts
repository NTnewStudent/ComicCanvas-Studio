/**
 * 分层上下文压缩（纯函数）：
 *
 *   L1 `trimToolResult` — 工具结果头尾保留裁剪，每轮写入观测时调用。
 *   L2 `foldHistory`    — 历史中最旧的已完成工具调用/结果对折叠为单行注记。
 *   L3 `autoCompact`    — 模型摘要前缀对话；摘要失败降级为硬截断。
 *
 * 不变量：system 提示与当前 user 消息永不折叠/丢弃；未完成的工具调用不折叠；
 * L2/L3 执行后 token 估算严格不增。
 *
 * @see docs/api-contracts/agents.md
 * @see docs/superpowers/specs/2026-07-08-agent-chat-ui-harness-design.md
 */

import type { AgentLoopMessage } from './context-loop'

const TRIM_HEAD_CHARS = 1200
const TRIM_TAIL_CHARS = 400

/**
 * 估算一组循环消息的 token 数（约 4 字符/token，与 context-loop 同口径）。
 * @param messages - Agent 循环消息。
 * @returns token 估算值。
 */
export function estimateLoopTokens(messages: readonly AgentLoopMessage[]): number {
  return messages.reduce((total, message) => total + Math.max(1, Math.ceil(message.content.length / 4)), 0)
}

/**
 * L1 — 头尾保留式工具结果裁剪。
 * @param content - 工具结果原文。
 * @param options - 可选头/尾保留长度（测试用）。
 * @returns 裁剪后的内容；短内容原样返回。
 */
export function trimToolResult(content: string, options?: { headChars?: number; tailChars?: number }): string {
  const head = options?.headChars ?? TRIM_HEAD_CHARS
  const tail = options?.tailChars ?? TRIM_TAIL_CHARS

  if (content.length <= head + tail) {
    return content
  }

  const truncated = content.length - head - tail
  return `${content.slice(0, head)}\n…[truncated ${truncated} chars]…\n${content.slice(content.length - tail)}`
}

export interface FoldHistoryOptions {
  /** 折叠目标预算（token）；低于该值即停止折叠。 */
  tokenBudget: number
}

export interface FoldHistoryResult {
  messages: AgentLoopMessage[]
  tokenEstimate: number
  /** 本次折叠的工具调用/结果对数量。 */
  foldedPairs: number
}

function firstLine(content: string, max = 80): string {
  const line = content.split('\n', 1)[0] ?? ''
  return line.length > max ? `${line.slice(0, max)}…` : line
}

function isProtected(message: AgentLoopMessage, index: number, lastUserIndex: number): boolean {
  if (message.role === 'system') {
    return true
  }

  return message.role === 'user' && index === lastUserIndex
}

/**
 * L2 — 从最旧开始把「assistant(toolCalls) + tool 结果」对折叠为单行 system 注记。
 * @param messages - 当前循环消息。
 * @param options - token 预算。
 * @returns 折叠后的消息、token 估算与折叠对数。
 */
export function foldHistory(messages: readonly AgentLoopMessage[], options: FoldHistoryOptions): FoldHistoryResult {
  let current = [...messages]
  let foldedPairs = 0

  const lastUserIndex = current.reduce((latest, message, index) => (message.role === 'user' ? index : latest), -1)

  while (estimateLoopTokens(current) > options.tokenBudget) {
    // 找最旧的已完成 tool 结果及其发起 assistant 消息。
    const toolIndex = current.findIndex((message, index) =>
      message.role === 'tool'
      && !isProtected(message, index, lastUserIndex))

    if (toolIndex === -1) {
      break
    }

    const tool = current[toolIndex]
    if (!tool || tool.role !== 'tool') {
      break
    }

    const note: AgentLoopMessage = {
      role: 'system',
      content: `[tool ${tool.toolId}: ${tool.status}${firstLine(tool.content) ? ` — ${firstLine(tool.content)}` : ''}]`,
    }

    const assistantIndex = toolIndex > 0
      && current[toolIndex - 1]?.role === 'assistant'
      && (current[toolIndex - 1] as Extract<AgentLoopMessage, { role: 'assistant' }>).toolCalls?.some(() => true)
      ? toolIndex - 1
      : -1

    const next = [...current]
    if (assistantIndex >= 0) {
      next.splice(assistantIndex, 2, note)
    } else {
      next.splice(toolIndex, 1, note)
    }

    // 防御：折叠必须让 token 下降，否则停止避免死循环。
    if (estimateLoopTokens(next) >= estimateLoopTokens(current)) {
      break
    }

    current = next
    foldedPairs += 1
  }

  return {
    messages: current,
    tokenEstimate: estimateLoopTokens(current),
    foldedPairs,
  }
}

export interface AutoCompactOptions {
  /** 压缩目标预算（token）。 */
  tokenBudget: number
  /** 尾部保留的最近消息条数。 */
  keepRecent: number
  /** 模型摘要回调；抛错时走硬截断降级。 */
  summarize: (transcript: string) => Promise<string>
}

export interface AutoCompactResult {
  messages: AgentLoopMessage[]
  tokenEstimate: number
  /** 摘要文本；降级硬截断时为 null。 */
  compactionSummary: string | null
  /** 被丢弃（未纳入摘要保留）的消息数。 */
  omittedMessages: number
}

/**
 * L3 — 模型摘要式压缩：保留 system + 摘要注记 + 最近 N 条，摘要失败降级硬截断。
 * @param messages - 当前循环消息。
 * @param options - 预算、保留条数与摘要回调。
 * @returns 压缩后的消息与审计元数据。
 */
export async function autoCompact(messages: readonly AgentLoopMessage[], options: AutoCompactOptions): Promise<AutoCompactResult> {
  if (estimateLoopTokens(messages) <= options.tokenBudget) {
    return {
      messages: [...messages],
      tokenEstimate: estimateLoopTokens(messages),
      compactionSummary: null,
      omittedMessages: 0,
    }
  }

  const system = messages.filter((message) => message.role === 'system' && message === messages[0])
  const tail = messages.slice(-options.keepRecent)
  const middle = messages.slice(system.length, messages.length - options.keepRecent)

  if (middle.length === 0) {
    return {
      messages: [...messages],
      tokenEstimate: estimateLoopTokens(messages),
      compactionSummary: null,
      omittedMessages: 0,
    }
  }

  const transcript = middle
    .map((message) => `${message.role}: ${message.content.slice(0, 400)}`)
    .join('\n')

  try {
    const summary = await options.summarize(transcript)
    const summaryNote: AgentLoopMessage = { role: 'system', content: `[对话前文摘要] ${summary}` }
    const compacted = [...system, summaryNote, ...tail]

    return {
      messages: compacted,
      tokenEstimate: estimateLoopTokens(compacted),
      compactionSummary: summary,
      omittedMessages: middle.length,
    }
  } catch {
    // 摘要网关失败必须有确定性降级：硬截断保留 system + 尾部。
    const truncated = [...system, ...tail]

    return {
      messages: truncated,
      tokenEstimate: estimateLoopTokens(truncated),
      compactionSummary: null,
      omittedMessages: middle.length,
    }
  }
}
