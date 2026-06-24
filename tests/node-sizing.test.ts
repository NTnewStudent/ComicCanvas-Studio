import { describe, expect, it } from 'vitest'

import {
  NODE_RESIZER_CLASS_NAMES,
  ORIENTATION_ASPECT_RATIO,
  PREVIEW_FRAME_WIDTH,
  getOrientationPreviewStyle
} from '../desktop/src/renderer/src/canvas/lib/node-sizing'

describe('M2 node sizing primitives', () => {
  it('maps every supported orientation to a stable preview aspect ratio', () => {
    expect(ORIENTATION_ASPECT_RATIO).toEqual({
      landscape: '16 / 9',
      portrait: '9 / 16',
      square: '1 / 1'
    })
  })

  it('keeps preview width stable while height follows orientation', () => {
    expect(PREVIEW_FRAME_WIDTH).toBe('100%')
    expect(getOrientationPreviewStyle('portrait')).toEqual({
      width: '100%',
      aspectRatio: '9 / 16'
    })
  })

  it('centralizes NodeResizer class names for canvas node integration', () => {
    expect(NODE_RESIZER_CLASS_NAMES.line).toContain('!border-brand')
    expect(NODE_RESIZER_CLASS_NAMES.handle).toContain('!bg-bg-card')
  })
})
