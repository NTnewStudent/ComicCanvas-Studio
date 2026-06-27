import { describe, expect, it } from 'vitest'

import { NODE_CONNECTION_MATRIX, canConnect } from '../shared/connection-matrix'
import type { NodeType } from '../shared/nodes'

describe('connection matrix', () => {
  const nodeTypes = Object.keys(NODE_CONNECTION_MATRIX) as NodeType[]

  it('matches canConnect to the canonical matrix for every known node pair', () => {
    for (const source of nodeTypes) {
      for (const target of nodeTypes) {
        expect(canConnect(source, target)).toBe(NODE_CONNECTION_MATRIX[source].includes(target))
      }
    }
  })

  it('keeps matrix keys aligned with known node types', () => {
    expect(Object.keys(NODE_CONNECTION_MATRIX).sort()).toEqual([...nodeTypes].sort())
  })

  it('keeps important migrated composition flows explicit', () => {
    expect(canConnect('videoConfigV2', 'videoCompose')).toBe(true)
    expect(canConnect('video', 'superResolution')).toBe(true)
    expect(canConnect('audio', 'muxAudioVideo')).toBe(true)
    expect(canConnect('mjImage', 'videoConfigV2')).toBe(true)
    expect(canConnect('muxAudioVideo', 'audio')).toBe(false)
  })
})
