/**
 * Shared canvas node sizing primitives.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { CSSProperties } from 'react'

import type { ImageRatio, Orientation, VideoRatio } from '../../../../../../shared/nodes'

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

// ── V2 节点尺寸常量 ─────────────────────────────────────────

/** V2 图片预览卡宽度 */
export const V2_IMAGE_PREVIEW_WIDTH = 360

/** V2 图片预览卡高度（按图片比例计算） */
export const V2_IMAGE_PREVIEW_HEIGHT_RATIO: Record<ImageRatio, number> = {
  '16:9': 202.5,
  '9:16': 640,
  '1:1': 360,
  '4:3': 270,
  '3:4': 480,
  '21:9': 154
}

/** V2 视频预览卡宽度 — 竖屏比例 (9:16, 3:4) */
export const V2_VIDEO_WIDTH_PORTRAIT = 180

/** V2 视频预览卡宽度 — 横屏/方形 */
export const V2_VIDEO_WIDTH_LANDSCAPE = 240

/** V2 Toolbar 宽度 */
export const V2_TOOLBAR_WIDTH = 960

/** V2 节点预览卡圆角 */
export const V2_NODE_RADIUS = 20

/** V2 图片比例 → CSS aspect-ratio 映射 */
export const V2_IMAGE_ASPECT_RATIO: Record<ImageRatio, string> = {
  '9:16': '9 / 16',
  '3:4': '3 / 4',
  '1:1': '1 / 1',
  '4:3': '4 / 3',
  '16:9': '16 / 9',
  '21:9': '21 / 9'
}

/** V2 视频比例 → CSS aspect-ratio 映射 */
export const V2_VIDEO_ASPECT_RATIO: Record<VideoRatio, string> = {
  '9:16': '9 / 16',
  '3:4': '3 / 4',
  '1:1': '1 / 1',
  '4:3': '4 / 3',
  '16:9': '16 / 9',
  '21:9': '21 / 9'
}

/**
 * 判断视频比例是否为竖屏方向。
 * @param ratio - 视频比例。
 * @returns 是否为竖屏比例 (9:16 或 3:4)。
 */
export function isPortraitRatio(ratio: VideoRatio | ImageRatio): boolean {
  return ratio === '9:16' || ratio === '3:4'
}
