/**
 * Electron IPC fanout adapter for durable job terminal events.
 * @see docs/api-contracts/jobs.md
 */

import type { JobTerminalEvent } from '../../../../shared/jobs'
import { createJobEventBus, type JobEventBus } from './events'

interface IpcEventWindow {
  isDestroyed(): boolean
  webContents: {
    send(channel: JobTerminalEvent['channel'], event: JobTerminalEvent): void
  }
}

export type IpcWindowProvider = () => IpcEventWindow[]

/**
 * Creates a job event bus that also fans terminal events out to renderer windows.
 * @param getWindows - Function returning candidate BrowserWindow-like event targets.
 * @returns Job event bus with IPC fanout.
 * @throws Error when duplicate terminal events are emitted for the same job.
 * @see docs/api-contracts/jobs.md
 */
export function createIpcJobEventBus(getWindows: IpcWindowProvider): JobEventBus {
  const inner = createJobEventBus()

  return {
    emitTerminal(event) {
      inner.emitTerminal(event)

      for (const window of getWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(event.channel, event)
        }
      }
    },
    getTerminalEvents() {
      return inner.getTerminalEvents()
    }
  }
}
