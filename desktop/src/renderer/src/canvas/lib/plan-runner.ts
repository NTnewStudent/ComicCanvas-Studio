/**
 * Serial Plan runSteps driver for renderer orchestration.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { RunAction } from '../../../../../../shared/plan'

export interface PlanRunnerStep {
  ref: string
  nodeId: string
  action: RunAction
}

export interface PlanRunnerSummary {
  total: number
  completed: number
  failedStep?: PlanRunnerStep
  errorMessage?: string | null
}

export interface PlanRunner {
  start(): void
  notifyNodeTerminal(nodeId: string, phase: 'completed' | 'failed', errorMessage?: string | null): void
  cancel(): void
  readonly active: boolean
}

export interface PlanRunnerCallbacks {
  runStep(step: PlanRunnerStep, index: number): void
  onFinished(summary: PlanRunnerSummary): void
}

/**
 * Creates a serial PlanRunner that advances only after current-step terminal events.
 * @param steps - Ordered runSteps mapped from Plan refs to canvas node IDs.
 * @param callbacks - Step launcher and one-shot completion callback.
 * @returns PlanRunner handle for start, terminal notification, and cancellation.
 * @throws Error never intentionally; callback errors propagate to the caller.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createPlanRunner(steps: PlanRunnerStep[], callbacks: PlanRunnerCallbacks): PlanRunner {
  let index = -1
  let running = false
  let cancelled = false

  function finish(summary: PlanRunnerSummary): void {
    running = false
    callbacks.onFinished(summary)
  }

  function launchNext(): void {
    index += 1

    if (index >= steps.length) {
      finish({ total: steps.length, completed: steps.length })
      return
    }

    const step = steps[index]

    if (step) {
      callbacks.runStep(step, index)
    }
  }

  return {
    start() {
      if (running || cancelled) {
        return
      }

      running = true
      launchNext()
    },
    notifyNodeTerminal(nodeId, phase, errorMessage) {
      if (!running || cancelled) {
        return
      }

      const current = steps[index]

      if (!current || current.nodeId !== nodeId) {
        return
      }

      if (phase === 'failed') {
        finish({
          total: steps.length,
          completed: index,
          failedStep: current,
          errorMessage: errorMessage ?? null
        })
        return
      }

      launchNext()
    },
    cancel() {
      cancelled = true
      running = false
    },
    get active() {
      return running
    }
  }
}
