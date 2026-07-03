/**
 * CanvasPlan readiness event bus for agent-to-renderer notification.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { AgentNonCanvasResponse } from '../../../../shared/agents'

export interface CanvasPlanReadyEvent {
  messageId: string
  planId: string
}

export interface AgentResponseReadyEvent {
  runId: string
  messageId: string
  response: AgentNonCanvasResponse
}

export interface AgentDeltaEvent {
  runId: string
  messageId: string
  delta: string
}

export interface CanvasPlanEventBus {
  emitPlanReady(event: CanvasPlanReadyEvent): void
  emitResponseReady(event: AgentResponseReadyEvent): void
  emitDelta(event: AgentDeltaEvent): void
  getPlanReadyEvents(): CanvasPlanReadyEvent[]
  getResponseReadyEvents(): AgentResponseReadyEvent[]
}

/**
 * Creates an in-memory CanvasPlan event bus that rejects duplicate ready events.
 * @returns CanvasPlan event bus API.
 * @throws Error when the same chat message emits planReady more than once.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createCanvasPlanEventBus(): CanvasPlanEventBus {
  const readyByMessage = new Map<string, CanvasPlanReadyEvent>()
  const responseByMessage = new Map<string, AgentResponseReadyEvent>()

  return {
    emitPlanReady(event) {
      if (readyByMessage.has(event.messageId)) {
        // Duplicate planReady events would cause renderer-side double fetch/apply prompts.
        throw new Error('canvas_plan_ready_duplicate')
      }

      readyByMessage.set(event.messageId, event)
    },
    emitResponseReady(event) {
      if (responseByMessage.has(event.messageId)) {
        throw new Error('agent_response_ready_duplicate')
      }
      responseByMessage.set(event.messageId, event)
    },
    emitDelta(event: AgentDeltaEvent): void {
      // In-memory bus: no storage needed for deltas (they are fire-and-forget tokens).
      void event
    },
    getPlanReadyEvents() {
      return Array.from(readyByMessage.values())
    },
    getResponseReadyEvents() {
      return Array.from(responseByMessage.values())
    }
  }
}
