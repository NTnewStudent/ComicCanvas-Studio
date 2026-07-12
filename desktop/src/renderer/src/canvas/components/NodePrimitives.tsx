/**
 * Shared cloud-paper node presentation primitives.
 * @see docs/superpowers/specs/2026-07-12-cloud-paper-canvas-node-system-design.md
 */

import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react'

import { cn } from '../../lib/cn'

export interface NodeFrameProps extends HTMLAttributes<HTMLElement> {
  selected?: boolean
}

/** Renders the stable white surface shared by every canvas node. */
export function NodeFrame({ selected = false, className, children, ...props }: NodeFrameProps): JSX.Element {
  return (
    <article
      className={cn('cc-node-frame', selected && 'cc-node-frame-selected', className)}
      {...props}
    >
      {children}
    </article>
  )
}

export interface NodeHeaderProps {
  icon: ReactNode
  title: ReactNode
  meta?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Renders compact node identity, metadata, status, and contextual actions. */
export function NodeHeader({ icon, title, meta, status, actions, className }: NodeHeaderProps): JSX.Element {
  return (
    <header className={cn('cc-node-header', className)}>
      <span className="cc-node-kind" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="cc-node-title block truncate">{title}</span>
        {meta ? <span className="cc-node-meta block truncate">{meta}</span> : null}
      </span>
      {status ? <span className="cc-node-status">{status}</span> : null}
      {actions ? <span className="cc-node-actions">{actions}</span> : null}
    </header>
  )
}

export interface NodePreviewProps extends HTMLAttributes<HTMLDivElement> {}

/** Renders the single primary preview surface inside a node. */
export function NodePreview({ className, children, ...props }: NodePreviewProps): JSX.Element {
  return (
    <div className={cn('cc-node-preview', className)} {...props}>
      {children}
    </div>
  )
}

export interface NodeSummaryRow {
  label: ReactNode
  value: ReactNode
}

export interface NodeSummaryRowsProps {
  rows: readonly NodeSummaryRow[]
  className?: string
}

/** Renders compact scan values without nested card surfaces. */
export function NodeSummaryRows({ rows, className }: NodeSummaryRowsProps): JSX.Element {
  return (
    <div className={cn('cc-node-summary', className)}>
      {rows.map((row, index) => (
        <div className="cc-node-summary-row" key={index}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  )
}

/** Renders selection-only asset actions above a node editor. */
export function NodeAssetBar({ children }: PropsWithChildren): JSX.Element {
  return <div className="cc-node-asset-bar">{children}</div>
}

export interface NodeSelectionEditorProps extends PropsWithChildren {
  open: boolean
  testId?: string
  className?: string
}

/** Mounts one rounded editor beneath a selected node and nothing while closed. */
export function NodeSelectionEditor({ open, children, testId, className }: NodeSelectionEditorProps): JSX.Element | null {
  if (!open) return null

  return (
    <div
      className="nodrag nowheel cc-node-editor-anchor"
      data-node-editor=""
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <section className={cn('cc-node-editor', className)}>{children}</section>
    </div>
  )
}

/** Renders the shared bottom action row inside a selected node editor. */
export function NodeEditorFooter({ children }: PropsWithChildren): JSX.Element {
  return <footer className="cc-node-editor-footer">{children}</footer>
}
