import { describe, expect, it } from 'vitest'

import { computeRelatedNodeIds } from '../desktop/src/renderer/src/canvas/lib/related-highlight'

describe('Task 24 related node highlight', () => {
  it('returns direct upstream and downstream neighbors without including the focused node', () => {
    expect(Array.from(computeRelatedNodeIds('image-1', [
      { source: 'text-1', target: 'image-1' },
      { source: 'image-1', target: 'video-1' },
      { source: 'image-1', target: 'image-1' },
      { source: 'text-2', target: 'video-2' },
    ])).sort()).toEqual(['text-1', 'video-1'])
  })

  it('returns an empty set when the node has no direct graph relation', () => {
    expect(Array.from(computeRelatedNodeIds('missing-node', [
      { source: 'text-1', target: 'image-1' },
    ]))).toEqual([])
  })
})
