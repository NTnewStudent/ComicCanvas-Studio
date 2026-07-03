/**
 * Electron IPC fanout adapter for CanvasPlan readiness events.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { IpcEventMap } from '../../../../shared/ipc'
import { createCanvasPlanEventBus, type AgentDeltaEvent, type AgentResponseReadyEvent, type CanvasPlanEventBus, type CanvasPlanReadyEvent } from '../agent/plan-events'

interface IpcEventWindow {
  isDestroyed(): boolean
  webContents: {
    send(channel: 'canvas.planReady', event: IpcEventMap['canvas.planReady']): void
    send(channel: 'agent.responseReady', event: IpcEventMap['agent.responseReady']): void
    send(channel: 'agent.delta', event: IpcEventMap['agent.delta']): void
  }
}

export type IpcCanvasWindowProvider = () => IpcEventWindow[]

/**
 * Creates a CanvasPlan event bus that fans planReady events out to renderer windows.
 * @param getWindows - Function returning candidate BrowserWindow-like event targets.
 * @returns CanvasPlan event bus with IPC fanout.
 * @throws Error when a duplicate planReady event is emitted for the same chat message.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createIpcCanvasPlanEventBus(getWindows: IpcCanvasWindowProvider): CanvasPlanEventBus {
  const inner = createCanvasPlanEventBus()

  return {
    emitPlanReady(event: CanvasPlanReadyEvent) {
      inner.emitPlanReady(event)

      for (const window of getWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('canvas.planReady', event)
        }
      }
    },
    emitResponseReady(event: AgentResponseReadyEvent) {
      inner.emitResponseReady(event)

      for (const window of getWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('agent.responseReady', event)
        }
      }
    },
    emitDelta(event: AgentDeltaEvent) {
      inner.emitDelta(event)

      for (const window of getWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('agent.delta', event)
        }
      }
    },
    getPlanReadyEvents() {
      return inner.getPlanReadyEvents()
    },
    getResponseReadyEvents() {
      return inner.getResponseReadyEvents()
    }
  }
}
