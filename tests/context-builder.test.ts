import { describe, expect, it } from 'vitest'
import { buildAgentContext, lexicalRetrieve, type ContextBuilderInput, type KnowledgeChunkInput } from '../desktop/src/main/knowledge/context-builder'
import type { CanvasGraphSnapshot } from '../shared/graph'

const emptyGraph: CanvasGraphSnapshot = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
const smallGraph: CanvasGraphSnapshot = {
  nodes: [
    { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Story', content: 'A rainy night' } },
    { id: 'n2', type: 'imageConfigV2', position: { x: 200, y: 0 }, data: { label: 'Image', promptOverride: '', modelId: 'stub-image', orientation: 'landscape', assetId: null, status: 'idle' } }
  ],
  edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { edgeType: 'promptOrder', createdAt: 1 } }],
  viewport: { x: 0, y: 0, zoom: 1 }
}

const basePolicy = {
  includeCanvasGraph: false,
  includeSelectedAssets: false,
  includeRecentMessages: false,
  includeKnowledge: false,
  maxContextTokens: 4000
}

const baseInput: ContextBuilderInput = {
  agentId: 'general-purpose',
  policy: basePolicy,
  workflowId: 'default',
  recentMessages: [],
  tokenBudget: 2000,
  clock: () => 1_782_900_000_000
}

describe('ContextBuilderService', () => {
  it('returns empty rendered string when all policy flags are off', () => {
    const result = buildAgentContext(baseInput)
    expect(result.rendered).toBe('')
    expect(result.pack.sources).toHaveLength(0)
    expect(result.pack.agentId).toBe('general-purpose')
  })

  it('includes canvas summary when includeCanvasGraph is on and graph is non-empty', () => {
    const result = buildAgentContext({
      ...baseInput,
      policy: { ...basePolicy, includeCanvasGraph: true },
      canvas: { graph: smallGraph }
    })
    expect(result.rendered).toContain('2 nodes')
    expect(result.rendered).toContain('1×text')
    expect(result.rendered).toContain('1×imageConfigV2')
    expect(result.pack.sources.some((s) => s.kind === 'canvas')).toBe(true)
  })

  it('skips canvas section for empty graph even when flag is on', () => {
    const result = buildAgentContext({
      ...baseInput,
      policy: { ...basePolicy, includeCanvasGraph: true },
      canvas: { graph: emptyGraph }
    })
    expect(result.rendered).toContain('empty')
  })

  it('includes recent messages respecting token budget', () => {
    const messages = [
      { id: 'm1', role: 'user' as const, content: 'I want a wuxia character', createdAt: 1 },
      { id: 'm2', role: 'assistant' as const, content: 'What style do you prefer?', createdAt: 2 }
    ]
    const result = buildAgentContext({
      ...baseInput,
      policy: { ...basePolicy, includeRecentMessages: true },
      recentMessages: messages
    })
    expect(result.rendered).toContain('wuxia character')
    expect(result.rendered).toContain('What style')
    expect(result.messagesIncluded).toBe(2)
    expect(result.pack.sources.some((s) => s.kind === 'message')).toBe(true)
  })

  it('truncates messages when token budget is exhausted', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      id: `m${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i} with some content to inflate token count `.repeat(5),
      createdAt: i
    }))
    const result = buildAgentContext({
      ...baseInput,
      tokenBudget: 500,
      policy: { ...basePolicy, includeRecentMessages: true },
      recentMessages: messages
    })
    expect(result.messagesIncluded).toBeLessThan(30)
    expect(result.tokenEstimate).toBeLessThanOrEqual(510)
    expect(result.pack.tokenEstimate).toBe(result.tokenEstimate)
    expect(result.pack.omissions.some((entry) => entry.includes('message'))).toBe(true)
    expect(result.pack.warnings).toContain('token_budget_exhausted')
  })

  it('includes knowledge chunks when flag is on', () => {
    const chunks: KnowledgeChunkInput[] = [
      { id: 'k1', text: 'The hero is a wandering swordsman named Liang.', citation: { sourceRef: 'notes.md', title: 'Character Notes' } }
    ]
    const result = buildAgentContext({
      ...baseInput,
      policy: { ...basePolicy, includeKnowledge: true },
      knowledgeChunks: chunks
    })
    expect(result.rendered).toContain('wandering swordsman')
    expect(result.rendered).toContain('[Character Notes]')
    expect(result.pack.sources.some((s) => s.kind === 'knowledge')).toBe(true)
  })
})

describe('lexicalRetrieve', () => {
  const chunks: KnowledgeChunkInput[] = [
    { id: 'c1', text: 'The wuxia hero wields a jade sword with precision.', citation: { sourceRef: 'story.md' } },
    { id: 'c2', text: 'A modern romance in the city, no martial arts.', citation: { sourceRef: 'romance.md' } },
    { id: 'c3', text: 'The hero learns sword techniques from the mountain hermit.', citation: { sourceRef: 'skills.md' } }
  ]

  it('ranks chunks by keyword overlap', () => {
    const results = lexicalRetrieve('wuxia sword hero', chunks)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.id).toBe('c1')
  })

  it('excludes chunks with no overlap', () => {
    const results = lexicalRetrieve('fantasy dragon fire', chunks)
    expect(results).toHaveLength(0)
  })

  it('respects the limit parameter', () => {
    const results = lexicalRetrieve('hero', chunks, 1)
    expect(results).toHaveLength(1)
  })
})
