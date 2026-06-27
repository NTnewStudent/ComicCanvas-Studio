import { describe, expect, it } from 'vitest'

import { NODE_CONNECTION_MATRIX, canConnect } from '../shared/connection-matrix'
import type { NodeType } from '../shared/nodes'

const migratedNodeTypes = [
  'text',
  'image',
  'video',
  'character',
  'scene',
  'audio',
  'imageConfigV2',
  'videoConfigV2',
  'videoCompose',
  'superResolution',
  'muxAudioVideo',
  'mjImage',
] as const satisfies readonly NodeType[]

describe('REQ-093 migrated node contracts', () => {
  it('keeps the shared node type set aligned with the accepted hjwall migration set', () => {
    expect(Object.keys(NODE_CONNECTION_MATRIX).sort()).toEqual([...migratedNodeTypes].sort())
  })

  it('supports the core hjwall generation and composition connection flows', () => {
    const allowedPairs = [
      ['text', 'character'],
      ['text', 'scene'],
      ['text', 'audio'],
      ['text', 'mjImage'],
      ['character', 'imageConfigV2'],
      ['scene', 'videoConfigV2'],
      ['imageConfigV2', 'mjImage'],
      ['mjImage', 'videoConfigV2'],
      ['videoConfigV2', 'videoCompose'],
      ['video', 'superResolution'],
      ['videoConfigV2', 'superResolution'],
      ['superResolution', 'video'],
      ['video', 'muxAudioVideo'],
      ['audio', 'muxAudioVideo'],
      ['muxAudioVideo', 'video'],
      ['videoCompose', 'video'],
    ] as const satisfies ReadonlyArray<readonly [NodeType, NodeType]>

    for (const [source, target] of allowedPairs) {
      expect(canConnect(source, target), `${source}->${target}`).toBe(true)
    }
  })

  it('continues to reject unsafe reverse or nonsensical graph flows', () => {
    const rejectedPairs = [
      ['video', 'image'],
      ['audio', 'image'],
      ['muxAudioVideo', 'audio'],
      ['superResolution', 'imageConfigV2'],
      ['videoCompose', 'audio'],
    ] as const satisfies ReadonlyArray<readonly [NodeType, NodeType]>

    for (const [source, target] of rejectedPairs) {
      expect(canConnect(source, target), `${source}->${target}`).toBe(false)
    }
  })
})
