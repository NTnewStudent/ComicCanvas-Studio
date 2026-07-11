import { describe, expect, it, vi } from 'vitest'

import { registerLocalMemoryHandlers } from '../desktop/src/main/ipc/local-memory.handler'

describe('local memory IPC', () => {
  it('requires explicit confirmation before a suggested memory is saved', () => {
    const handlers = new Map<string, (event: unknown, request: unknown) => unknown>()
    const save = vi.fn()
    registerLocalMemoryHandlers({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      memories: { save }, currentUserId: 'user-local', clock: () => 1, idFactory: () => 'memory-1'
    })

    const manual = handlers.get('memory.save')?.({}, { scope: 'user', content: 'Prefer concise replies.' })
    const suggestion = handlers.get('memory.confirmSuggestion')?.({}, { artifactId: 'artifact-memory', confirmed: false })

    expect(manual).toMatchObject({ id: 'memory-1', scope: 'user' })
    expect(suggestion).toMatchObject({ errorClass: 'memory_confirmation_required', retryable: false })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves content only from a confirmed persisted memorySuggestion artifact', () => {
    const handlers = new Map<string, (event: unknown, request: unknown) => unknown>()
    const save = vi.fn()
    registerLocalMemoryHandlers({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      memories: { save }, currentUserId: 'user-local', clock: () => 2, idFactory: () => 'memory-confirmed',
      artifacts: { getById: () => ({ id: 'artifact-memory', runId: 'run-1', kind: 'memorySuggestion', title: 'Memory', summary: 'Save style', createdAt: 1, payload: { scope: 'workflow', content: 'Use monochrome ink.' } }) },
      runs: { getById: () => ({
        id: 'run-1', threadId: 'thread-1', workflowId: 'workflow-1', messageId: 'message-1', trigger: 'manual',
        agentId: 'general-assistant', status: 'completed', policyProfileId: 'local-default', trace: {}, usage: {}, createdAt: 1, updatedAt: 1
      }) }
    })

    expect(handlers.get('memory.confirmSuggestion')?.({}, { artifactId: 'artifact-memory', confirmed: true }))
      .toMatchObject({ id: 'memory-confirmed', scope: 'workflow', workflowId: 'workflow-1', content: 'Use monochrome ink.' })
    expect(save).toHaveBeenCalledTimes(1)
  })
})
