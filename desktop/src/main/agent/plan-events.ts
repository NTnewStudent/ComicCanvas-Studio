/**
 * CanvasPlan readiness event bus for agent-to-renderer notification.
 * @see docs/api-contracts/canvas-plan.md
 */

export interface CanvasPlanReadyEvent {
  messageId: string
  planId: string
}

export interface CanvasPlanEventBus {
  emitPlanReady(event: CanvasPlanReadyEvent): void
  getPlanReadyEvents(): CanvasPlanReadyEvent[]
}

/**
 * Creates an in-memory CanvasPlan event bus that rejects duplicate ready events.
 * @returns CanvasPlan event bus API.
 * @throws Error when the same chat message emits planReady more than once.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createCanvasPlanEventBus(): CanvasPlanEventBus {
  const readyByMessage = new Map<string, CanvasPlanReadyEvent>()

  return {
    emitPlanReady(event) {
      if (readyByMessage.has(event.messageId)) {
        // Duplicate planReady events would cause renderer-side double fetch/apply prompts.
        throw new Error('canvas_plan_ready_duplicate')
      }

      readyByMessage.set(event.messageId, event)
    },
    getPlanReadyEvents() {
      return Array.from(readyByMessage.values())
    }
  }
}
