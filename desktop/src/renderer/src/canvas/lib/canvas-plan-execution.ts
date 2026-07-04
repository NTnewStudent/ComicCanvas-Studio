/**
 * Renderer orchestration bridge for applying CanvasPlans and running generated nodes.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/jobs.md
 */

import type { StoreApi } from 'zustand/vanilla'

import type { JobTerminalEvent, JobTicket } from '../../../../../../shared/jobs'
import type { CanvasPlan, RunAction } from '../../../../../../shared/plan'
import type { CanvasStoreState } from '../store/canvas.store'
import { applyCanvasPlan, type ApplyCanvasPlanOptions, type ApplyCanvasPlanResult } from './apply-plan'
import { terminalFailureToNodePatch, terminalResultToNodePatch } from './job-reconciliation'
import { createPlanRunner, type PlanRunner, type PlanRunnerStep, type PlanRunnerSummary } from './plan-runner'

export interface CanvasPlanExecutionOptions {
  /** Whether runSteps should start immediately after applying the Plan. */
  autoExecute: boolean
}

export interface CanvasPlanExecutionControllerOptions {
  /** Renderer canvas store receiving applied Plan graph state and node terminal updates. */
  store: StoreApi<CanvasStoreState>
  /** Preload-backed node run command. */
  runNode: (nodeId: string) => Promise<JobTicket> | JobTicket
  /** Deterministic applyPlan options for tests. */
  applyOptions?: ApplyCanvasPlanOptions
  /** Optional completion observer for PlanRunner summaries. */
  onRunnerFinished?: (summary: PlanRunnerSummary) => void
}

export interface CanvasPlanExecutionController {
  applyPlan(plan: CanvasPlan, options: CanvasPlanExecutionOptions): ApplyCanvasPlanResult
  notifyJobCompleted(event: Extract<JobTerminalEvent, { channel: 'job.completed' }>): void
  notifyJobFailed(event: Extract<JobTerminalEvent, { channel: 'job.failed' }>): void
  readonly currentRunner: PlanRunner | null
}

function jobTypeForRunAction(action: RunAction): 'canvas.polishText' | 'canvas.generateImage' {
  return action === 'textPolish' ? 'canvas.polishText' : 'canvas.generateImage'
}

function markNodeRunning(store: StoreApi<CanvasStoreState>, step: PlanRunnerStep): void {
  store.getState().updateNodeData(
    step.nodeId,
    step.action === 'textPolish'
      ? { polishStatus: 'pending' }
      : { status: 'pending', assetId: null }
  )
}

function markNodeDone(store: StoreApi<CanvasStoreState>, nodeId: string, event: Extract<JobTerminalEvent, { channel: 'job.completed' }>): void {
  const patch = terminalResultToNodePatch(event.result)
  if (patch) {
    store.getState().updateNodeData(nodeId, patch)
  }
}

function markNodeFailed(store: StoreApi<CanvasStoreState>, step: PlanRunnerStep, message?: string): void {
  store.getState().updateNodeData(step.nodeId, terminalFailureToNodePatch(jobTypeForRunAction(step.action), {
    errorClass: 'plan_runner_failed',
    message: message ?? 'run_node_enqueue_failed',
    retryable: false,
  }))
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value
}

/**
 * Creates a renderer-side controller that bridges Plan application, PlanRunner, and job terminal events.
 * @param options - Store, runNode API, deterministic apply options, and optional completion observer.
 * @returns Controller for applying Plans and feeding job terminal events back to the active runner.
 * @throws Error never intentionally; runNode failures are reflected as failed node state.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createCanvasPlanExecutionController(options: CanvasPlanExecutionControllerOptions): CanvasPlanExecutionController {
  let runner: PlanRunner | null = null
  const jobToStep = new Map<string, PlanRunnerStep>()

  function runStep(step: PlanRunnerStep): void {
    markNodeRunning(options.store, step)

    try {
      const ticket = options.runNode(step.nodeId)
      if (isPromiseLike(ticket)) {
        ticket.then((resolvedTicket) => {
          jobToStep.set(resolvedTicket.jobId, step)
        }).catch(() => {
          // runNode crosses the preload/main-process boundary; enqueue failures become node error state.
          markNodeFailed(options.store, step)
          runner?.notifyNodeTerminal(step.nodeId, 'failed', 'run_node_enqueue_failed')
        })
      } else {
        jobToStep.set(ticket.jobId, step)
      }
    } catch {
      markNodeFailed(options.store, step)
      runner?.notifyNodeTerminal(step.nodeId, 'failed', 'run_node_enqueue_failed')
    }
  }

  return {
    applyPlan(plan, executionOptions) {
      const result = applyCanvasPlan(plan, options.store, options.applyOptions)

      runner?.cancel()
      jobToStep.clear()
      runner = null

      if (executionOptions.autoExecute && result.runSteps.length > 0) {
        runner = createPlanRunner(result.runSteps, {
          runStep,
          onFinished(summary) {
            options.onRunnerFinished?.(summary)
          }
        })
        runner.start()
      }

      return result
    },
    notifyJobCompleted(event) {
      const step = jobToStep.get(event.jobId)

      if (!step) {
        return
      }

      jobToStep.delete(event.jobId)

      markNodeDone(options.store, step.nodeId, event)

      runner?.notifyNodeTerminal(step.nodeId, 'completed')
    },
    notifyJobFailed(event) {
      const step = jobToStep.get(event.jobId)

      if (!step) {
        return
      }

      jobToStep.delete(event.jobId)
      markNodeFailed(options.store, step, event.error.message)
      runner?.notifyNodeTerminal(step.nodeId, 'failed', event.error.message)
    },
    get currentRunner() {
      return runner
    }
  }
}
