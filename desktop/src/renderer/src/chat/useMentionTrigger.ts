import { useMemo } from 'react'

export interface MentionTrigger {
  start: number
  end: number
  query: string
}

/**
 * Detects an active trailing `@query` mention around the current textarea caret.
 * @param value - Current textarea value.
 * @param caretIndex - Current caret index, defaulting to the end of the value.
 * @returns Active mention range and query, or null when no mention is active.
 * @throws Error never intentionally.
 */
export function useMentionTrigger(value: string, caretIndex: number = value.length): MentionTrigger | null {
  return useMemo(() => {
    const safeCaretIndex = Math.max(0, Math.min(caretIndex, value.length))
    const textBeforeCaret = value.slice(0, safeCaretIndex)
    const match = /(^|\s)@([^\s@]*)$/.exec(textBeforeCaret)

    if (!match) {
      return null
    }

    const prefix = match[1] ?? ''
    const query = match[2] ?? ''
    const start = match.index + prefix.length

    return { start, end: safeCaretIndex, query }
  }, [caretIndex, value])
}
