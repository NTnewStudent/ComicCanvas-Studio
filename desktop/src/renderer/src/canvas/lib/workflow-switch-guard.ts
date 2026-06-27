export interface WorkflowSwitchGuardInput {
  isDirty: boolean
  saveCurrent: () => Promise<void>
  switchWorkflow: () => void | Promise<void>
  onSaveFailed: (error: unknown) => void
}

export type WorkflowSwitchGuardResult =
  | { switched: true }
  | { switched: false; reason: 'save_failed' }

export async function guardWorkflowSwitch(input: WorkflowSwitchGuardInput): Promise<WorkflowSwitchGuardResult> {
  if (input.isDirty) {
    try {
      await input.saveCurrent()
    } catch (error) {
      input.onSaveFailed(error)
      return { switched: false, reason: 'save_failed' }
    }
  }

  await input.switchWorkflow()
  return { switched: true }
}

export interface DirtyBeforeUnloadGuardInput {
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>
  isDirty: () => boolean
}

export function installDirtyBeforeUnloadGuard(input: DirtyBeforeUnloadGuardInput): () => void {
  const handler = (event: BeforeUnloadEvent) => {
    if (!input.isDirty()) return

    event.preventDefault()
    event.returnValue = ''
  }

  input.target.addEventListener('beforeunload', handler)
  return () => input.target.removeEventListener('beforeunload', handler)
}
