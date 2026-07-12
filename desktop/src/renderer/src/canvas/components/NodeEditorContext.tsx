/**
 * Coordinates the single selection editor that may be open on the canvas.
 * @see docs/superpowers/specs/2026-07-12-cloud-paper-canvas-node-system-design.md
 */

import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'

const NodeEditorContext = createContext<string | null>(null)

/** Returns the selected node ID only when selection is unambiguous. */
export function activeNodeEditorId(selectedNodeIds: readonly string[]): string | null {
  return selectedNodeIds.length === 1 ? selectedNodeIds[0]! : null
}

export interface NodeEditorProviderProps extends PropsWithChildren {
  selectedNodeIds: readonly string[]
}

/** Provides one active editor ID to node renderers without node-level store subscriptions. */
export function NodeEditorProvider({ selectedNodeIds, children }: NodeEditorProviderProps): JSX.Element {
  const activeId = useMemo(() => activeNodeEditorId(selectedNodeIds), [selectedNodeIds])
  return <NodeEditorContext.Provider value={activeId}>{children}</NodeEditorContext.Provider>
}

/** Reports whether the requested node owns the current selection editor. */
export function useNodeEditorOpen(nodeId: string): boolean {
  return useContext(NodeEditorContext) === nodeId
}
