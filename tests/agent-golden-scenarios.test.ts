import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AgentResponse } from '../shared/agents'
import { createDefaultOrchestratorPlanner } from '../desktop/src/main/agent/orchestrator'

describe('local agent golden scenarios', () => {
  afterEach(() => vi.useRealTimers())

  it('answers general chat prompts visibly without proposing canvas mutations', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00+08:00'))
    const planner = createDefaultOrchestratorPlanner()
    const cases = [
      ['你好', '你好'],
      ['你是谁', 'ComicCanvas Studio'],
      ['明天星期几', '明天是星期四'],
      ['你知道 Java 吗', '普通问题']
    ] as const

    for (const [message, expectedText] of cases) {
      const response = planner.proposePlan({ runId: `run-${message}`, messageId: `message-${message}`, message, agentId: 'general-purpose' }) as AgentResponse
      expect(response.type).toBe('answer')
      if (response.type !== 'answer') throw new Error('Expected visible answer response')
      expect(response.text).toContain(expectedText)
      expect(response).not.toHaveProperty('plan')
      expect(response.dropped).not.toContain('canvas_mutation')
    }
  })
})
