/**
 * Canonical canvas node layout sizes shared by renderer and tools.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { NodeType } from './nodes'

/** Durable canvas node dimensions in React Flow coordinate units. */
export interface CanvasNodeLayoutSize {
  /** Initial and minimum canvas node width. */
  width: number
  /** Initial and minimum canvas node height. */
  height: number
}

/** Default canvas dimensions for every supported node type. */
export const DEFAULT_CANVAS_NODE_SIZE: Record<NodeType, CanvasNodeLayoutSize> = {
  text: { width: 300, height: 240 },
  image: { width: 360, height: 380 },
  video: { width: 380, height: 400 },
  character: { width: 420, height: 440 },
  scene: { width: 420, height: 560 },
  audio: { width: 360, height: 500 },
  imageConfigV2: { width: 360, height: 520 },
  videoConfigV2: { width: 380, height: 560 },
  videoCompose: { width: 380, height: 520 },
  superResolution: { width: 380, height: 560 },
  muxAudioVideo: { width: 380, height: 470 },
  mjImage: { width: 360, height: 390 },
}

/**
 * Returns the canonical default size for one canvas node type.
 * @param type - Supported canvas node type.
 * @returns Initial and minimum layout dimensions for the node.
 */
export function defaultCanvasNodeSize(type: NodeType): CanvasNodeLayoutSize {
  return DEFAULT_CANVAS_NODE_SIZE[type]
}
