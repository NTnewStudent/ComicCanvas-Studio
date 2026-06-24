/**
 * Shared canvas node sizing primitives.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { CSSProperties } from 'react'

import type { Orientation } from '../../../../../../shared/nodes'

/** CSS width used by media preview frames inside resizable nodes. */
export const PREVIEW_FRAME_WIDTH = '100%'

/** Stable node widths used as NodeResizer minimums and initial node shells. */
export const NODE_MIN_WIDTH = {
  text: 260,
  image: 340,
  video: 360
} as const

/** Stable node minimum heights used by NodeResizer. */
export const NODE_MIN_HEIGHT = {
  text: 168,
  image: 260,
  video: 300
} as const

/** Orientation to CSS aspect-ratio mapping shared by image and video nodes. */
export const ORIENTATION_ASPECT_RATIO: Record<Orientation, string> = {
  landscape: '16 / 9',
  portrait: '9 / 16',
  square: '1 / 1'
}

/** Shared Tailwind classes used to style React Flow NodeResizer handles. */
export const NODE_RESIZER_CLASS_NAMES = {
  line: '!border-brand/60',
  handle: '!h-2.5 !w-2.5 !rounded-sm !border-2 !border-brand !bg-bg-card'
} as const

/**
 * Builds a stable preview frame style for a media orientation.
 * @param orientation - Target preview orientation.
 * @returns Inline style with stable width and orientation-driven aspect ratio.
 */
export function getOrientationPreviewStyle(orientation: Orientation): Pick<CSSProperties, 'width' | 'aspectRatio'> {
  return {
    width: PREVIEW_FRAME_WIDTH,
    aspectRatio: ORIENTATION_ASPECT_RATIO[orientation]
  }
}
