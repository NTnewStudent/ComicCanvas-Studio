/**
 * Agent 运行故障恢复原语：
 *
 *   - `withGatewayRetry`     — 网关瞬时失败指数退避重试。
 *   - `isContextOverflowError` — 识别 token/上下文超限类错误（触发反应式压缩）。
 *   - `createToolFailureGuard` — 同一工具连续失败上限保护，防止死循环。
 *
 * 稳定 errorClass：`gateway_retry_exhausted`、`compaction_failed`、`tool_failure_loop`。
 *
 * @see docs/api-contracts/agents.md
 * @see docs/superpowers/specs/2026-07-08-agent-chat-ui-harness-design.md
 */

export interface GatewayRetryOptions {
  /** 重试次数（不含首次调用）。 */
  retries: number
  /** 首次退避毫秒数；之后按 4 倍递增（500 → 2000）。 */
  baseDelayMs: number
  /** 每次重试前回调（用于 yield 可见进度）。 */
  onRetry?: (attempt: number, error: unknown) => void
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 对网关调用做指数退避重试；耗尽后抛出最后一次错误。
 * @param call - 待重试的异步调用。
 * @param options - 重试次数、退避与回调。
 * @returns 首个成功结果。
 * @throws unknown 重试耗尽时抛出最后一次的原始错误（由调用方映射 errorClass）。
 */
export async function withGatewayRetry<T>(call: () => Promise<T>, options: GatewayRetryOptions): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await call()
    } catch (error) {
      lastError = error

      if (attempt === options.retries) {
        break
      }

      options.onRetry?.(attempt + 1, error)
      await sleep(options.baseDelayMs * Math.pow(4, attempt))
    }
  }

  // 重试耗尽：把最后一次错误抛回调用方决定 fallback 或终态。
  throw lastError
}

const CONTEXT_OVERFLOW_PATTERNS = [
  /context[_\s]?length/i,
  /maximum context/i,
  /tokens? exceed/i,
  /prompt is too long/i,
  /input is too long/i,
]

/**
 * 判断错误是否为上下文/token 超限类，可通过压缩后重试恢复。
 * @param error - 任意抛出的值。
 * @returns 匹配已知超限模式时为 true。
 */
export function isContextOverflowError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(error.message))
}

/** 网关重试与 fallback 全部耗尽 — errorClass 稳定为 `gateway_retry_exhausted`。 */
export class GatewayRetryExhaustedError extends Error {
  readonly errorClass = 'gateway_retry_exhausted' as const
  readonly retryable = true

  /**
   * @param cause - 最后一次网关错误。
   */
  constructor(cause: unknown) {
    super(`gateway_retry_exhausted: 网关重试与备用网关均失败。${cause instanceof Error ? ` 最后错误：${cause.message}` : ''}`)
    this.name = 'GatewayRetryExhaustedError'
  }
}

/** 反应式压缩后模型调用仍失败 — errorClass 稳定为 `compaction_failed`。 */
export class CompactionFailedError extends Error {
  readonly errorClass = 'compaction_failed' as const
  readonly retryable = false

  /**
   * @param cause - 压缩重试后的模型错误。
   */
  constructor(cause: unknown) {
    super(`compaction_failed: 上下文压缩后模型调用仍失败。${cause instanceof Error ? ` 最后错误：${cause.message}` : ''}`)
    this.name = 'CompactionFailedError'
  }
}

export interface ToolFailureGuard {
  /** 记录一次工具失败；达到上限时抛出 `tool_failure_loop`。 */
  recordFailure(toolId: string): void
  /** 记录一次工具成功，清零该工具的连续失败计数。 */
  recordSuccess(toolId: string): void
}

/** 工具失败循环错误 — errorClass 稳定为 `tool_failure_loop`。 */
export class ToolFailureLoopError extends Error {
  readonly errorClass = 'tool_failure_loop' as const
  readonly retryable = false

  /**
   * @param toolId - 连续失败的工具 ID。
   * @param limit - 触发保护的连续失败次数。
   */
  constructor(readonly toolId: string, limit: number) {
    // 错误消息带 errorClass 前缀，便于测试与日志检索。
    super(`tool_failure_loop: 工具 ${toolId} 连续失败 ${limit} 次，已终止本次运行。`)
    this.name = 'ToolFailureLoopError'
  }
}

/**
 * 创建同一工具连续失败保护计数器。
 * @param limit - 连续失败上限（默认 3）。
 * @returns 失败/成功记录器。
 * @throws ToolFailureLoopError 当同一工具连续失败达到上限。
 */
export function createToolFailureGuard(limit = 3): ToolFailureGuard {
  let failingToolId: string | null = null
  let consecutive = 0

  return {
    recordFailure(toolId) {
      if (failingToolId === toolId) {
        consecutive += 1
      } else {
        failingToolId = toolId
        consecutive = 1
      }

      if (consecutive >= limit) {
        // 连续失败达到上限：终止而不是让模型无限重试同一坏工具。
        throw new ToolFailureLoopError(toolId, limit)
      }
    },
    recordSuccess(toolId) {
      if (failingToolId === toolId) {
        failingToolId = null
        consecutive = 0
      }
    },
  }
}
