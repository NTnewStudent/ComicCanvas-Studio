import { describe, expect, it, vi } from 'vitest'

import { registerAgentHandlers } from '../desktop/src/main/ipc/agent.handler'
import type { IpcResponseMap } from '../shared/ipc'

type Handler = (_event: unknown, request: unknown) => unknown

function createHandlers() {
  const handlers = new Map<string, Handler>()
  const approveTool = vi.fn(() => ({ runId: 'run-1', jobId: 'job-1', status: 'pending' as const }))
  const denyTool = vi.fn(() => ({ runId: 'run-1', status: 'aborted' as const, errorClass: 'agent_tool_denied' as const }))
  const spawnSubAgent = vi.fn(() => ({ marker: 'spawned' }))

  registerAgentHandlers({
    handle: (channel, handler) => handlers.set(channel, handler)
  }, {
    registry: { list: vi.fn(), save: vi.fn(), delete: vi.fn() } as never,
    runtime: { agentRun: vi.fn(), getRun: vi.fn(), approveTool, denyTool },
    spawnSubAgent: spawnSubAgent as never
  })

  return { handlers, approveTool, denyTool, spawnSubAgent }
}

describe('agent IPC runtime validation', () => {
  it('returns the typed safe runtime-unavailable envelope when spawn is not wired', () => {
    const expected: IpcResponseMap['agent.spawn'] = {
      errorClass: 'agent_runtime_unavailable',
      message: 'Agent runtime is unavailable.',
      retryable: false
    }
    const handlers = new Map<string, Handler>()
    registerAgentHandlers({
      handle: (channel, handler) => handlers.set(channel, handler)
    }, {
      registry: { list: vi.fn(), save: vi.fn(), delete: vi.fn() } as never
    })

    const response: IpcResponseMap['agent.spawn'] = handlers.get('agent.spawn')?.({}, {
      roleId: 'qa-verifier', task: 'Verify the graph.'
    }) as IpcResponseMap['agent.spawn']

    expect(response).toEqual(expected)
    expect('message' in response ? response.message : '').not.toMatch(/secret|token|key=/iu)
  })

  it('trims and delegates bounded approval input with an explicit scope', () => {
    const { handlers, approveTool } = createHandlers()

    handlers.get('agent.approveTool')?.({}, {
      runId: ' run-1 ', callId: ' call-1 ', approvedBy: ' user-local ', scope: 'run'
    })

    expect(approveTool).toHaveBeenCalledWith({
      runId: 'run-1', callId: 'call-1', approvedBy: 'user-local', scope: 'run'
    })
  })

  it.each([
    { runId: 'run-1', callId: 'call-1', approvedBy: 'user-local', scope: 'forever' },
    { runId: 'run-1', callId: 'call-1', approvedBy: 'user-local', unexpected: true },
    { runId: ' ', callId: 'call-1', approvedBy: 'user-local' },
    { runId: 'run-1', callId: 'x'.repeat(257), approvedBy: 'user-local' },
    { runId: 'run-1', callId: 'call-1', approvedBy: 42 }
  ])('rejects malformed approval input before queueing: %j', (request) => {
    const { handlers, approveTool } = createHandlers()

    expect(handlers.get('agent.approveTool')?.({}, request)).toEqual({
      errorClass: 'agent_invalid_request',
      message: 'Invalid agent.approveTool request.',
      retryable: false
    })
    expect(approveTool).not.toHaveBeenCalled()
  })

  it.each([
    { runId: 'run-1', callId: 'call-1', deniedBy: 'user-local', unexpected: true },
    { runId: 'run-1', callId: 'call-1', deniedBy: 'x'.repeat(257) },
    { runId: 'run-1', callId: null, deniedBy: 'user-local' }
  ])('rejects malformed denial input before delegation: %j', (request) => {
    const { handlers, denyTool } = createHandlers()

    expect(handlers.get('agent.denyTool')?.({}, request)).toEqual({
      errorClass: 'agent_invalid_request',
      message: 'Invalid agent.denyTool request.',
      retryable: false
    })
    expect(denyTool).not.toHaveBeenCalled()
  })

  it('trims canonical spawn input before delegation', () => {
    const { handlers, spawnSubAgent } = createHandlers()

    expect(handlers.get('agent.spawn')?.({}, {
      roleId: 'qa-verifier', task: '  Verify the graph.  '
    })).toEqual({ marker: 'spawned' })
    expect(spawnSubAgent).toHaveBeenCalledWith({ roleId: 'qa-verifier', task: 'Verify the graph.' })
  })

  it.each([
    { roleId: 'canvas-orchestrator', task: 'Alias is not canonical.' },
    { roleId: 'custom-agent', task: 'Custom role.' },
    { roleId: 'unknown', task: 'Unknown role.' },
    { roleId: 'qa-verifier', task: 'Valid task.', depth: 1 },
    { roleId: 'qa-verifier', task: ' ' },
    { roleId: 'qa-verifier', task: 'x'.repeat(4001) },
    { roleId: 'qa-verifier', task: 42 },
    null
  ])('returns a stable typed error for malformed spawn input: %j', (request) => {
    const { handlers, spawnSubAgent } = createHandlers()

    expect(handlers.get('agent.spawn')?.({}, request)).toEqual({
      errorClass: 'agent_invalid_request',
      message: 'Invalid agent.spawn request.',
      retryable: false
    })
    expect(spawnSubAgent).not.toHaveBeenCalled()
  })
})
