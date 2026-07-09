import { describe, expect, it, vi } from 'vitest'

import {
  createToolFailureGuard,
  isContextOverflowError,
  withGatewayRetry,
} from '../desktop/src/main/agent/recovery'

describe('withGatewayRetry', () => {
  it('returns immediately on first success without retrying', async () => {
    const call = vi.fn().mockResolvedValue('ok')
    const onRetry = vi.fn()

    const result = await withGatewayRetry(call, { retries: 2, baseDelayMs: 1, onRetry })

    expect(result).toBe('ok')
    expect(call).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('retries transient failures with backoff and succeeds', async () => {
    const call = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('recovered')
    const onRetry = vi.fn()

    const result = await withGatewayRetry(call, { retries: 2, baseDelayMs: 1, onRetry })

    expect(result).toBe('recovered')
    expect(call).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error))
  })

  it('throws the last error after exhausting retries', async () => {
    const call = vi.fn().mockRejectedValue(new Error('provider down'))

    await expect(withGatewayRetry(call, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('provider down')
    expect(call).toHaveBeenCalledTimes(3)
  })
})

describe('isContextOverflowError', () => {
  it('detects context-length style provider errors', () => {
    expect(isContextOverflowError(new Error('This model maximum context length is 8192 tokens'))).toBe(true)
    expect(isContextOverflowError(new Error('context_length_exceeded'))).toBe(true)
    expect(isContextOverflowError(new Error('prompt is too long: tokens exceed limit'))).toBe(true)
    expect(isContextOverflowError(new Error('rate limit exceeded'))).toBe(false)
    expect(isContextOverflowError('not an error')).toBe(false)
  })
})

describe('createToolFailureGuard', () => {
  it('throws tool_failure_loop after three consecutive failures of the same tool', () => {
    const guard = createToolFailureGuard(3)

    guard.recordFailure('canvas.runNode')
    guard.recordFailure('canvas.runNode')
    expect(() => guard.recordFailure('canvas.runNode')).toThrowError(/tool_failure_loop/)
  })

  it('resets the counter when the tool succeeds or another tool runs', () => {
    const guard = createToolFailureGuard(3)

    guard.recordFailure('canvas.runNode')
    guard.recordFailure('canvas.runNode')
    guard.recordSuccess('canvas.runNode')
    guard.recordFailure('canvas.runNode')
    guard.recordFailure('canvas.queryGraph')
    expect(() => guard.recordFailure('canvas.queryGraph')).not.toThrow()
  })
})
