/**
 * Canvas connection validation feedback banner.
 * @see docs/api-contracts/canvas-plan.md
 */

import { AlertCircle } from 'lucide-react'

import { cn } from '../../lib/cn'
import type { ConnectionValidationFeedback } from '../lib/connection-validation'

/** Props for the canvas connection feedback banner. */
export interface ConnectionFeedbackProps {
  /** Latest validation feedback, or null when no message should be rendered. */
  feedback: ConnectionValidationFeedback | null
  /** Optional extra class names for the positioned banner container. */
  className?: string
}

/**
 * Renders an accessible, compact connection validation notice.
 * @param props - Feedback payload and optional class names.
 * @returns Feedback banner React element or null.
 * @throws Error never intentionally; missing feedback renders nothing.
 * @see docs/api-contracts/canvas-plan.md
 */
export function ConnectionFeedback({ feedback, className }: ConnectionFeedbackProps): JSX.Element | null {
  if (feedback === null) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-input bg-bg-card px-3 py-2 text-[13px] font-medium text-text-base shadow-pop',
        feedback.reason === 'connection_not_allowed' && 'text-semantic-negative',
        feedback.reason === 'duplicate_edge' && 'text-semantic-warning',
        className
      )}
      data-reason={feedback.reason}
      data-at={feedback.at}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{feedback.message}</span>
    </div>
  )
}
