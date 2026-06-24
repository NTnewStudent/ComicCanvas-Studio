/**
 * In-process job event bus for Electron IPC fanout adapters.
 * @see docs/api-contracts/jobs.md
 */

import type { JobTerminalEvent } from '../../../../shared/jobs'

export interface JobEventBus {
  emitTerminal(event: JobTerminalEvent): void
  getTerminalEvents(): JobTerminalEvent[]
}

/**
 * Creates an in-memory event bus that rejects duplicate terminal job events.
 * @returns Job event bus API.
 * @throws Error when a second terminal event is emitted for the same job.
 * @see docs/api-contracts/jobs.md
 */
export function createJobEventBus(): JobEventBus {
  const terminalByJob = new Map<string, JobTerminalEvent>()

  return {
    emitTerminal(event) {
      if (terminalByJob.has(event.jobId)) {
        throw new Error('job_terminal_event_duplicate')
      }

      terminalByJob.set(event.jobId, event)
    },
    getTerminalEvents() {
      return Array.from(terminalByJob.values())
    }
  }
}
