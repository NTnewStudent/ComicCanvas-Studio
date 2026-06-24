import { describe, expect, it, vi } from 'vitest'

import { createIpcJobEventBus } from '../desktop/src/main/jobs/ipc-fanout'

function createWindow(destroyed = false) {
  return {
    isDestroyed: () => destroyed,
    webContents: {
      send: vi.fn()
    }
  }
}

describe('M2 job IPC event fanout', () => {
  it('broadcasts terminal job events to live renderer windows exactly once', () => {
    const first = createWindow()
    const second = createWindow()
    const closed = createWindow(true)
    const events = createIpcJobEventBus(() => [first, second, closed])
    const terminalEvent = {
      channel: 'job.completed' as const,
      jobId: 'job-1',
      result: { kind: 'asset' as const, assetId: 'asset-1' },
      emittedAt: 42
    }

    events.emitTerminal(terminalEvent)

    expect(first.webContents.send).toHaveBeenCalledWith('job.completed', terminalEvent)
    expect(second.webContents.send).toHaveBeenCalledWith('job.completed', terminalEvent)
    expect(closed.webContents.send).not.toHaveBeenCalled()
    expect(events.getTerminalEvents()).toEqual([terminalEvent])
    expect(() => events.emitTerminal(terminalEvent)).toThrow('job_terminal_event_duplicate')
  })
})
