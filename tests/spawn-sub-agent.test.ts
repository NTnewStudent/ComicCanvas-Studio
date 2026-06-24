import { describe, expect, it } from 'vitest'

import { MAX_SPAWN_DEPTH } from '../shared/agents'
import { spawnSubAgent } from '../desktop/src/main/agent/spawn-sub-agent'

const parentContext = {
  parentRunId: 'run-parent',
  parentTraceId: 'trace-parent',
  allowedTools: ['canvas.queryGraph', 'canvas.createNode'],
  allowedSkills: ['storyboard']
}

describe('M5 spawnSubAgent', () => {
  it('rejects requested tools outside the parent permission set before starting the child run', async () => {
    let childRuns = 0

    const result = await spawnSubAgent(
      {
        spec: {
          task: 'Create a draft image node.',
          systemPrompt: 'You are a canvas helper.',
          allowedTools: ['canvas.queryGraph', 'canvas.deleteNode'],
          allowedSkills: ['storyboard'],
          maxTurns: 3,
          effort: 'medium'
        },
        depth: 0
      },
      parentContext,
      {
        idFactory: () => 'run-child-denied',
        clock: () => 1_782_900_000_000,
        runChild() {
          childRuns += 1
          return { output: 'should not run', status: 'completed', turnsUsed: 1 }
        }
      }
    )

    expect(childRuns).toBe(0)
    expect(result).toEqual({
      output: '',
      status: 'failed',
      turnsUsed: 0,
      droppedTools: ['canvas.deleteNode'],
      droppedSkills: [],
      error: 'agent_permission_denied',
      trace: {
        runId: 'run-child-denied',
        parentRunId: 'run-parent',
        parentTraceId: 'trace-parent',
        depth: 1,
        startedAt: 1_782_900_000_000,
        completedAt: 1_782_900_000_000,
        requestedTools: ['canvas.queryGraph', 'canvas.deleteNode'],
        effectiveTools: ['canvas.queryGraph'],
        requestedSkills: ['storyboard'],
        effectiveSkills: ['storyboard'],
        droppedTools: ['canvas.deleteNode'],
        droppedSkills: [],
        status: 'failed',
        error: 'agent_permission_denied'
      }
    })
  })

  it('rejects child runs that exceed MAX_SPAWN_DEPTH', async () => {
    const result = await spawnSubAgent(
      {
        spec: {
          task: 'Go too deep.',
          systemPrompt: 'You are a nested helper.',
          allowedTools: ['canvas.queryGraph'],
          maxTurns: 1
        },
        depth: MAX_SPAWN_DEPTH
      },
      parentContext,
      {
        idFactory: () => 'run-child-depth',
        clock: () => 1_782_900_000_100,
        runChild() {
          throw new Error('child runner must not be called')
        }
      }
    )

    expect(result).toMatchObject({
      output: '',
      status: 'failed',
      turnsUsed: 0,
      droppedTools: [],
      droppedSkills: [],
      error: 'agent_depth_exceeded',
      trace: {
        runId: 'run-child-depth',
        depth: MAX_SPAWN_DEPTH + 1,
        status: 'failed',
        error: 'agent_depth_exceeded'
      }
    })
  })

  it('runs a normal child agent with intersected permissions and returns its independent trace', async () => {
    const result = await spawnSubAgent(
      {
        spec: {
          task: 'Summarize the graph.',
          systemPrompt: 'You are a read-only canvas helper.',
          allowedTools: ['canvas.queryGraph'],
          allowedSkills: ['storyboard'],
          maxTurns: 4,
          effort: 'low'
        },
        depth: 0
      },
      parentContext,
      {
        idFactory: () => 'run-child-ok',
        clock: (() => {
          const values = [1_782_900_000_200, 1_782_900_000_250]
          return () => values.shift() ?? 1_782_900_000_250
        })(),
        runChild(input) {
          expect(input).toEqual({
            runId: 'run-child-ok',
            parentRunId: 'run-parent',
            task: 'Summarize the graph.',
            systemPrompt: 'You are a read-only canvas helper.',
            allowedTools: ['canvas.queryGraph'],
            allowedSkills: ['storyboard'],
            maxTurns: 4,
            effort: 'low',
            traceId: 'trace-parent/run-child-ok',
            depth: 1
          })

          return { output: 'Graph has one image node.', status: 'completed', turnsUsed: 2 }
        }
      }
    )

    expect(result).toEqual({
      output: 'Graph has one image node.',
      status: 'completed',
      turnsUsed: 2,
      droppedTools: [],
      droppedSkills: [],
      trace: {
        runId: 'run-child-ok',
        parentRunId: 'run-parent',
        parentTraceId: 'trace-parent',
        depth: 1,
        startedAt: 1_782_900_000_200,
        completedAt: 1_782_900_000_250,
        requestedTools: ['canvas.queryGraph'],
        effectiveTools: ['canvas.queryGraph'],
        requestedSkills: ['storyboard'],
        effectiveSkills: ['storyboard'],
        droppedTools: [],
        droppedSkills: [],
        status: 'completed'
      }
    })
  })
})
