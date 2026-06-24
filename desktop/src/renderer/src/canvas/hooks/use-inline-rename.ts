/**
 * Inline rename state machine shared by canvas node headers.
 * @see docs/api-contracts/canvas-plan.md
 */

import { useEffect, useState, type KeyboardEvent } from 'react'

/** Options for a controlled inline rename interaction. */
export interface UseInlineRenameOptions {
  /** Current committed label. */
  value: string
  /** Called when the user commits a non-empty label. */
  onCommit: (next: string) => void
}

/** Inline rename control surface for node header components. */
export interface InlineRenameState {
  /** Current committed label mirrored locally after commits. */
  value: string
  /** Whether the rename input is visible. */
  isRenaming: boolean
  /** Current input draft value. */
  draft: string
  /** Replaces the draft value. */
  setDraft: (next: string) => void
  /** Enters rename mode with the current value selected by the component. */
  start: () => void
  /** Saves a non-empty draft and exits rename mode. */
  commit: () => void
  /** Restores the committed label and exits rename mode. */
  cancel: () => void
  /** Keyboard handler: Enter commits, Escape cancels. */
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

/**
 * Creates reusable inline rename behavior for node headers.
 * @param options - Current value and commit callback.
 * @returns Inline rename state and event handlers.
 * @throws Error never intentionally; empty labels are rejected as no-ops.
 * @see docs/api-contracts/canvas-plan.md
 */
export function useInlineRename({ value, onCommit }: UseInlineRenameOptions): InlineRenameState {
  const [committed, setCommitted] = useState(value)
  const [draft, setDraft] = useState(value)
  const [isRenaming, setIsRenaming] = useState(false)

  useEffect(() => {
    setCommitted(value)
    setDraft(value)
  }, [value])

  function start(): void {
    setDraft(committed)
    setIsRenaming(true)
  }

  function commit(): void {
    const next = draft.trim()
    if (!next) {
      setDraft(committed)
      setIsRenaming(false)
      return
    }

    setCommitted(next)
    setDraft(next)
    setIsRenaming(false)
    onCommit(next)
  }

  function cancel(): void {
    setDraft(committed)
    setIsRenaming(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      commit()
    }
    if (event.key === 'Escape') {
      cancel()
    }
  }

  return {
    value: committed,
    isRenaming,
    draft,
    setDraft,
    start,
    commit,
    cancel,
    handleKeyDown
  }
}
