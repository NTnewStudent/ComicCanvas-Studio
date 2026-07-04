import { describe, expect, it } from 'vitest'

import { NODE_CONNECTION_MATRIX } from '../shared/connection-matrix'
import {
  getAddableNodeDefinitions,
  getConnectCreateNodeDefinitions,
  getNodeDefinition,
  getRunnableNodeDefinitions,
  getWorkflowNodeDefinitions,
} from '../shared/workflow-node-definitions'
import type { NodeType } from '../shared/nodes'

describe('Task 42 workflow node definitions service', () => {
  it('covers every shared node type with capabilities and input/output metadata', () => {
    const definitions = getWorkflowNodeDefinitions()
    const definitionTypes = definitions.map((definition) => definition.type).sort()

    expect(definitionTypes).toEqual(Object.keys(NODE_CONNECTION_MATRIX).sort())
    for (const definition of definitions) {
      expect(definition.label.length).toBeGreaterThan(0)
      expect(definition.category.length).toBeGreaterThan(0)
      expect(definition.allowedInputs).toEqual(
        Object.entries(NODE_CONNECTION_MATRIX)
          .filter(([, targets]) => targets.includes(definition.type))
          .map(([source]) => source)
      )
      expect(definition.allowedOutputs).toEqual(NODE_CONNECTION_MATRIX[definition.type])
      expect(definition.capabilities.length).toBeGreaterThan(0)
    }
  })

  it('keeps MJ known for legacy graphs but unavailable for Phase A add/run flows', () => {
    const mj = getNodeDefinition('mjImage')

    expect(mj).toMatchObject({
      type: 'mjImage',
      addable: false,
      connectCreate: false,
      runnable: false,
      unavailableReason: 'MJ node/component is out of scope for local Phase A.',
    })
    expect(getAddableNodeDefinitions().map((definition) => definition.type)).not.toContain('mjImage')
    expect(getConnectCreateNodeDefinitions('text').map((definition) => definition.type)).not.toContain('mjImage')
    expect(getRunnableNodeDefinitions().map((definition) => definition.type)).not.toContain('mjImage')
  })

  it('filters connect-to-create targets through definition availability and the shared matrix', () => {
    const textTargets = getConnectCreateNodeDefinitions('text').map((definition) => definition.type)
    const videoTargets = getConnectCreateNodeDefinitions('video').map((definition) => definition.type)

    expect(textTargets).toEqual(['text', 'image', 'video', 'audio', 'character', 'scene', 'imageConfigV2', 'videoConfigV2'])
    expect(videoTargets).toEqual(['video', 'videoCompose', 'superResolution', 'videoConfigV2', 'muxAudioVideo'])
  })

  it('maps runnable node types to explicit run actions for future tools and agents', () => {
    const runActions = new Map<NodeType, string | null>(
      getWorkflowNodeDefinitions().map((definition) => [definition.type, definition.runAction])
    )

    expect(runActions.get('text')).toBe('textPolish')
    expect(runActions.get('image')).toBeNull()
    expect(runActions.get('imageConfigV2')).toBe('imageRun')
    expect(runActions.get('video')).toBeNull()
    expect(runActions.get('videoConfigV2')).toBe('videoRun')
    expect(runActions.get('videoCompose')).toBe('videoComposeRun')
    expect(runActions.get('superResolution')).toBe('superResolutionRun')
    expect(runActions.get('muxAudioVideo')).toBe('muxAudioVideoRun')
    expect(runActions.get('mjImage')).toBeNull()
  })
})
