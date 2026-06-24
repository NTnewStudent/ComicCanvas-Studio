/**
 * Polling utilities for async media gateway providers.
 * @see docs/api-contracts/gateway-providers.md
 */

import { GatewayProviderError } from './registry'
import type { GatewayProviderContext } from './stub.provider'

export type PollingState<TResult> =
  | { state: 'pending'; progress?: number; message?: string }
  | { state: 'completed'; result: TResult }
  | { state: 'failed'; message?: string; retryable?: boolean }

export interface PollingStrategyOptions {
  initialDelayMs: number
  maxDelayMs: number
  timeoutMs: number
  clock?: () => number
  sleep?: (durationMs: number) => Promise<void> | void
}

function providerError(errorClass: GatewayProviderError['errorClass'], message: string, retryable: boolean): GatewayProviderError {
  return new GatewayProviderError({ errorClass, message, retryable })
}

async function defaultSleep(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

function assertNotCanceled(context?: GatewayProviderContext): void {
  if (context?.isCanceled?.() === true) {
    // Worker cancellation is a first-class gateway terminal condition, not a remote provider failure.
    throw providerError('provider_canceled', 'Provider polling was canceled by the worker', false)
  }
}

async function emitProgress(context: GatewayProviderContext | undefined, state: { progress?: number; message?: string }): Promise<void> {
  if (typeof state.progress !== 'number') {
    return
  }

  const event = state.message === undefined ? { progress: state.progress } : { progress: state.progress, message: state.message }
  await context?.onProgress?.(event)
}

/**
 * Polls a remote task until it reaches a terminal state.
 * @param poll - Function that reads the provider status for the current attempt.
 * @param options - Backoff, timeout, clock, and sleep dependencies.
 * @param context - Optional worker-side cancellation and progress callbacks.
 * @returns Completed provider result.
 * @throws GatewayProviderError when polling fails, times out, or is canceled.
 * @see docs/api-contracts/gateway-providers.md
 */
export async function pollWithBackoff<TResult>(
  poll: (attempt: number) => Promise<PollingState<TResult>> | PollingState<TResult>,
  options: PollingStrategyOptions,
  context?: GatewayProviderContext
): Promise<TResult> {
  const clock = options.clock ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const startedAt = clock()
  let delayMs = Math.max(0, options.initialDelayMs)
  let attempt = 1

  while (true) {
    assertNotCanceled(context)

    if (clock() - startedAt >= options.timeoutMs) {
      // The remote task exceeded the configured provider timeout budget.
      throw providerError('provider_timeout', 'Provider polling timed out', true)
    }

    const state = await poll(attempt)

    if (state.state === 'completed') {
      return state.result
    }

    if (state.state === 'failed') {
      // Remote task failure is normalized to the shared provider failure envelope.
      throw providerError('provider_request_failed', state.message ?? 'Provider task failed', state.retryable ?? true)
    }

    await emitProgress(context, state)

    const remainingMs = options.timeoutMs - (clock() - startedAt)
    if (remainingMs <= 0) {
      // The timeout can elapse immediately after a status response.
      throw providerError('provider_timeout', 'Provider polling timed out', true)
    }

    await sleep(Math.min(delayMs, remainingMs))
    delayMs = Math.min(Math.max(delayMs * 2, delayMs), options.maxDelayMs)
    attempt += 1
  }
}
