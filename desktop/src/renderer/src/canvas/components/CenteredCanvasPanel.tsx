/**
 * Shared centered modal shell for canvas library panels.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export interface CenteredCanvasPanelProps {
  /** Accessible label for the modal panel. */
  ariaLabel: string
  /** Modal content. */
  children: ReactNode
  /** Extra class names for the centered panel card. */
  className?: string
  /** Called when the backdrop is clicked. */
  onClose: () => void
}

/**
 * Renders a canvas-blocking centered modal shell.
 * @param props - Label, children, close callback, and optional card classes.
 * @returns Centered canvas modal element.
 * @throws Error never intentionally.
 * @see docs/api-contracts/canvas-plan.md
 */
export function CenteredCanvasPanel({ ariaLabel, children, className, onClose }: CenteredCanvasPanelProps): JSX.Element {
  return (
    <div className="nopan nodrag nowheel pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5 py-8 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="关闭弹层"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          'relative z-10 flex max-h-[min(720px,calc(100vh-72px))] w-[min(920px,calc(100vw-56px))] flex-col overflow-hidden rounded-2xl border border-border-primary bg-bg-panel shadow-pop',
          className
        )}
      >
        {children}
      </section>
    </div>
  )
}
