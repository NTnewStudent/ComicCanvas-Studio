/**
 * Shared canvas node sizing primitives.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { CSSProperties } from 'react'

import { DEFAULT_CANVAS_NODE_SIZE } from '../../../../../../shared/node-layout'
import type { ImageRatio, NodeType, Orientation, VideoRatio } from '../../../../../../shared/nodes'

/** CSS width used by media preview frames inside resizable nodes. */
export const PREVIEW_FRAME_WIDTH = '100%'

/** Stable node widths used as NodeResizer minimums and initial node shells. */
export const NODE_MIN_WIDTH: Record<NodeType, number> = Object.fromEntries(
  Object.entries(DEFAULT_CANVAS_NODE_SIZE).map(([type, size]) => [type, size.width])
) as Record<NodeType, number>

/** Stable node minimum heights used by NodeResizer. */
export const NODE_MIN_HEIGHT: Record<NodeType, number> = Object.fromEntries(
  Object.entries(DEFAULT_CANVAS_NODE_SIZE).map(([type, size]) => [type, size.height])
) as Record<NodeType, number>

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

/** Shared Tailwind class fragments for a calmer, denser canvas node rhythm. */
export const NODE_UI_CLASS_NAMES = {
  textShell:
    'relative flex h-full min-h-[240px] w-full min-w-[300px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-3.5 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
  characterShell:
    'relative flex h-full min-h-[440px] w-full min-w-[420px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-3.5 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
  sceneShell:
    'relative flex h-full min-h-[560px] w-full min-w-[420px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-3.5 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
  mediaShell: 'relative flex h-full min-h-[380px] w-full min-w-[360px] flex-col gap-2.5 select-none text-text-base',
  videoShell: 'relative flex h-full min-h-[400px] w-full min-w-[380px] flex-col gap-2.5 select-none text-text-base',
  mediaCard:
    'rounded-xl border border-border-secondary bg-bg-card p-3.5 shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
  title: 'text-[14px] font-semibold leading-[1.35] text-text-base',
  header: 'flex min-h-8 items-center gap-2',
  field:
    'rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] leading-[1.5] text-text-base outline-none focus-visible:shadow-[0_0_0_4px_var(--cc-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand',
  compactButton:
    'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2.5 py-1.5 text-[12px] font-medium text-text-secondary transition hover:border-border-primary hover:text-text-base',
  toolbar:
    'nodrag nowheel relative w-[min(760px,calc(100vw-96px))] overflow-visible rounded-2xl border border-border-primary bg-bg-panel p-3.5 shadow-card'
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

/** V2 Toolbar ideal width, constrained by viewport at render time. */
export const V2_TOOLBAR_WIDTH = 760

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
