import { describe, expect, it } from 'vitest'

import { analyzeAgentIntent } from '../desktop/src/main/agent/intent-analysis'

describe('Agent intent analysis', () => {
  it('classifies greetings as clarify-only small talk', () => {
    expect(analyzeAgentIntent('hi')).toMatchObject({
      kind: 'smallTalk',
      executionMode: 'clarify',
      complexity: 'low',
      recommendedAgentId: 'general-purpose',
      requirements: []
    })
  })

  it('classifies vague requests as clarification before planning', () => {
    expect(analyzeAgentIntent('帮我弄一下')).toMatchObject({
      kind: 'ambiguous',
      executionMode: 'clarify',
      complexity: 'medium',
      recommendedAgentId: 'general-purpose',
      requirements: ['帮我弄一下']
    })
  })

  it('routes ordinary knowledge questions to the general-purpose agent instead of canvas clarification', () => {
    expect(analyzeAgentIntent('今天星期几')).toMatchObject({
      kind: 'general',
      executionMode: 'direct',
      complexity: 'low',
      recommendedAgentId: 'general-purpose',
      requirements: ['Answer the user question conversationally.'],
      missing: []
    })
  })

  it('routes simple canvas node creation to direct canvas orchestration', () => {
    expect(analyzeAgentIntent('创建一个文本节点')).toMatchObject({
      kind: 'canvasPlan',
      executionMode: 'direct',
      complexity: 'low',
      recommendedAgentId: 'canvas-orchestrator',
      requirements: ['创建一个文本节点']
    })
  })

  it('routes generation requests to planned orchestration instead of direct reference-node creation', () => {
    for (const message of ['生成图片', '生成视频', '生成一张宇宙飞船图片']) {
      expect(analyzeAgentIntent(message)).toMatchObject({
        kind: 'canvasPlan',
        executionMode: 'plan',
        complexity: 'high',
        recommendedAgentId: 'canvas-orchestrator'
      })
    }
  })

  it('routes multi-step comic generation to planned canvas orchestration', () => {
    expect(analyzeAgentIntent('做一个雨夜侦探漫画短剧，包含角色、场景、图片和视频')).toMatchObject({
      kind: 'canvasPlan',
      executionMode: 'plan',
      complexity: 'high',
      recommendedAgentId: 'canvas-orchestrator',
      requirements: [
        'Create a comic-drama workflow.',
        'Define character references.',
        'Define scene references.',
        'Generate image configuration nodes.',
        'Generate video configuration nodes.'
      ]
    })
  })

  it('decomposes rich workflow requests into capability-aligned requirements', () => {
    expect(analyzeAgentIntent('做一个雨夜侦探漫画短剧，包含角色、场景、图片、配音、视频合成和音视频合成')).toMatchObject({
      kind: 'canvasPlan',
      requirements: [
        'Create a comic-drama workflow.',
        'Define character references.',
        'Define scene references.',
        'Generate image configuration nodes.',
        'Generate or attach audio assets.',
        'Generate video configuration nodes.',
        'Compose video clips.',
        'Mux audio and video.'
      ],
      localCapabilities: [
        'canvas.queryGraph',
        'canvas.proposePlan',
        'canvas.createNode',
        'canvas.connectNodes',
        'canvas.runNode',
        'canvas.composeVideo',
        'canvas.muxAudioVideo'
      ]
    })
  })
})
