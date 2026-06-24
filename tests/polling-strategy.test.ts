import { describe, expect, it } from 'vitest'

import { pollWithBackoff } from '../desktop/src/main/providers/polling-strategy'

describe('M3 async media polling strategy', () => {
  it('returns completed results after pending polls with exponential backoff', async () => {
    let now = 0
    const sleeps: number[] = []
    const states = [
      { state: 'pending' as const, progress: 25, message: 'queued' },
      { state: 'pending' as const, progress: 50, message: 'rendering' },
      { state: 'completed' as const, result: 'asset-ready' }
    ]
    const progress: Array<{ progress: number; message?: string }> = []

    const result = await pollWithBackoff(
      () => {
        const state = states.shift()

        if (!state) {
          // Guards the test fixture so extra polls fail with a clear signal.
          throw new Error('unexpected extra poll')
        }

        return Promise.resolve(state)
      },
      {
        initialDelayMs: 100,
        maxDelayMs: 500,
        timeoutMs: 2_000,
        clock: () => now,
        sleep: (durationMs) => {
          sleeps.push(durationMs)
          now += durationMs
          return Promise.resolve()
        }
      },
      {
        onProgress: (event) => {
          progress.push(event)
        }
      }
    )

    expect(result).toBe('asset-ready')
    expect(sleeps).toEqual([100, 200])
    expect(progress).toEqual([
      { progress: 25, message: 'queued' },
      { progress: 50, message: 'rendering' }
    ])
  })

  it('throws provider_timeout when timeout elapses during backoff', async () => {
    let now = 0
    const sleeps: number[] = []

    await expect(
      pollWithBackoff(
        () => Promise.resolve({ state: 'pending' as const, progress: 10 }),
        {
          initialDelayMs: 100,
          maxDelayMs: 500,
          timeoutMs: 250,
          clock: () => now,
          sleep: (durationMs) => {
            sleeps.push(durationMs)
            now += durationMs
            return Promise.resolve()
          }
        }
      )
    ).rejects.toMatchObject({
      errorClass: 'provider_timeout',
      retryable: true
    })
    expect(sleeps).toEqual([100, 150])
  })

  it('checks worker-side cancellation before each poll', async () => {
    let now = 0
    let pollCount = 0
    let canceled = false

    await expect(
      pollWithBackoff(
        () => {
          pollCount += 1
          return Promise.resolve({ state: 'pending' as const })
        },
        {
          initialDelayMs: 100,
          maxDelayMs: 500,
          timeoutMs: 1_000,
          clock: () => now,
          sleep: (durationMs) => {
            now += durationMs
            canceled = true
            return Promise.resolve()
          }
        },
        {
          isCanceled: () => canceled
        }
      )
    ).rejects.toMatchObject({
      errorClass: 'provider_canceled',
      retryable: false
    })
    expect(pollCount).toBe(1)
  })

  it('normalizes failed poll states to provider_request_failed', async () => {
    await expect(
      pollWithBackoff(
        () => Promise.resolve({ state: 'failed' as const, message: 'remote quota exceeded', retryable: false }),
        {
          initialDelayMs: 100,
          maxDelayMs: 500,
          timeoutMs: 1_000
        }
      )
    ).rejects.toMatchObject({
      errorClass: 'provider_request_failed',
      message: 'remote quota exceeded',
      retryable: false
    })
  })
})
