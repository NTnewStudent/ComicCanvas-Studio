import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'desktop/src/renderer/src/canvas/CanvasPage.tsx'), 'utf8')

describe('REQ-093 migrated node creation menus', () => {
  it('exposes accepted migrated node types through the canvas add menus', () => {
    for (const type of ['character', 'scene', 'audio', 'videoCompose', 'superResolution', 'muxAudioVideo', 'mjImage']) {
      expect(source).toContain(`type: '${type}'`)
    }
  })

  it('registers a renderer component for each migrated node type', () => {
    for (const type of ['character', 'scene', 'audio', 'videoCompose', 'superResolution', 'muxAudioVideo', 'mjImage']) {
      expect(source).toContain(`${type}:`)
    }
  })
})
