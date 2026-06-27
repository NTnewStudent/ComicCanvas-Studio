import { describe, expect, it, vi } from 'vitest'

import { guardWorkflowSwitch, installDirtyBeforeUnloadGuard } from '../desktop/src/renderer/src/canvas/lib/workflow-switch-guard'

describe('REQ-091 workflow dirty-save guards', () => {
  it('allows clean workflow switching without saving', async () => {
    const saveCurrent = vi.fn()
    const switchWorkflow = vi.fn()

    const result = await guardWorkflowSwitch({
      isDirty: false,
      saveCurrent,
      switchWorkflow,
      onSaveFailed: vi.fn(),
    })

    expect(result).toEqual({ switched: true })
    expect(saveCurrent).not.toHaveBeenCalled()
    expect(switchWorkflow).toHaveBeenCalledTimes(1)
  })

  it('saves dirty workflow before switching', async () => {
    const saveCurrent = vi.fn().mockResolvedValue(undefined)
    const switchWorkflow = vi.fn()

    const result = await guardWorkflowSwitch({
      isDirty: true,
      saveCurrent,
      switchWorkflow,
      onSaveFailed: vi.fn(),
    })

    expect(result).toEqual({ switched: true })
    expect(saveCurrent).toHaveBeenCalledTimes(1)
    expect(switchWorkflow).toHaveBeenCalledTimes(1)
  })

  it('blocks workflow switching when dirty save fails', async () => {
    const error = new Error('disk full')
    const saveCurrent = vi.fn().mockRejectedValue(error)
    const switchWorkflow = vi.fn()
    const onSaveFailed = vi.fn()

    const result = await guardWorkflowSwitch({
      isDirty: true,
      saveCurrent,
      switchWorkflow,
      onSaveFailed,
    })

    expect(result).toEqual({ switched: false, reason: 'save_failed' })
    expect(switchWorkflow).not.toHaveBeenCalled()
    expect(onSaveFailed).toHaveBeenCalledWith(error)
  })

  it('registers a beforeunload guard while the canvas has unsaved changes', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const isDirty = vi.fn().mockReturnValue(true)

    const cleanup = installDirtyBeforeUnloadGuard({
      target: { addEventListener, removeEventListener },
      isDirty,
    })
    const handler = addEventListener.mock.calls[0]?.[1] as (event: BeforeUnloadEvent) => void
    const event = { preventDefault: vi.fn(), returnValue: undefined as unknown } as unknown as BeforeUnloadEvent

    handler(event)

    expect(addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.returnValue).toBe('')

    cleanup()
    expect(removeEventListener).toHaveBeenCalledWith('beforeunload', handler)
  })
})
