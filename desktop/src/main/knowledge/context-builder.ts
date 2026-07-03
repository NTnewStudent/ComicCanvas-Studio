/**
 * ContextBuilderService — assembles bounded context for Agent runs.
 *
 * Priority order (highest → lowest, matches spec INV-1):
 *   1. Agent policy / system instructions  (always present, not built here)
 *   2. Current user message               (always present, handled by loop)
 *   3. Canvas summary                      (when includeCanvasGraph)
 *   4. Selected assets summary             (when includeSelectedAssets)
 *   5. Retrieved knowledge chunks          (when includeKnowledge)
 *   6. Recent conversation messages        (when includeRecentMessages, up to budget)
 *
 * Returns a rendered string that is injected into the model prompt just before
 * "Messages", and a lightweight ContextPack record for persistence + debugging.
 *
 * This is NOT LTM. Context is workflow-scoped, assembled fresh per run, and
 * never reads arbitrary files outside the explicitly approved scope.
 *
 * @see docs/api-contracts/knowledge-context.md
 * @see specs/conversation-context-engine/requirements.md
 */

import { randomUUID } from 'node:crypto'

import type { AgentContextPolicy } from '../../../../shared/agents'
import type { CanvasGraphSnapshot } from '../../../../shared/graph'
import type { ContextPack, ContextSource } from '../../../../shared/knowledge'
import type { ChatMessageRecord } from '../db/repositories/chat-message.repo'

export interface CanvasSummaryInput {
  graph: CanvasGraphSnapshot
  selectedNodeIds?: string[]
}

export interface AssetSummaryInput {
  assetIds: string[]
  resolveAssetLabel: (id: string) => string
}

export interface KnowledgeChunkInput {
  id: string
  text: string
  citation: { sourceRef: string; title?: string; range?: string }
  score?: number
}

export interface ContextBuilderInput {
  agentId: string
  policy: AgentContextPolicy
  workflowId: string
  recentMessages: ChatMessageRecord[]
  canvas?: CanvasSummaryInput
  assets?: AssetSummaryInput
  knowledgeChunks?: KnowledgeChunkInput[]
  tokenBudget: number
  clock?: () => number
}

export interface BuiltContext {
  /** The rendered context string injected into the model prompt. */
  rendered: string
  /** Lightweight record for persistence and debugging. */
  pack: ContextPack
  /** Number of recent messages included (for trace). */
  messagesIncluded: number
  /** Approximate token count of the rendered context. */
  tokenEstimate: number
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function renderCanvasSummary(input: CanvasSummaryInput): string {
  const { graph, selectedNodeIds = [] } = input
  const nodeCount = graph.nodes.length
  const edgeCount = graph.edges.length

  if (nodeCount === 0) {
    return 'Canvas: empty (no nodes).'
  }

  const typeGroups: Record<string, number> = {}
  for (const node of graph.nodes) {
    typeGroups[node.type] = (typeGroups[node.type] ?? 0) + 1
  }
  const typeSummary = Object.entries(typeGroups)
    .map(([type, count]) => `${count}×${type}`)
    .join(', ')

  const selectedPart = selectedNodeIds.length > 0
    ? ` Selected nodes: ${selectedNodeIds.slice(0, 8).join(', ')}${selectedNodeIds.length > 8 ? '...' : ''}.`
    : ''

  return `Canvas: ${nodeCount} nodes (${typeSummary}), ${edgeCount} edges.${selectedPart}`
}

function renderAssetsSummary(input: AssetSummaryInput): string {
  if (input.assetIds.length === 0) return ''
  const labels = input.assetIds.slice(0, 6).map((id) => input.resolveAssetLabel(id))
  const tail = input.assetIds.length > 6 ? ` (+${input.assetIds.length - 6} more)` : ''
  return `Selected assets: ${labels.join(', ')}${tail}.`
}

function renderKnowledgeChunks(chunks: KnowledgeChunkInput[]): string {
  if (chunks.length === 0) return ''
  const lines = chunks.map((chunk) => {
    const cite = chunk.citation.title
      ? `[${chunk.citation.title}]`
      : `[${chunk.citation.sourceRef}]`
    return `${cite}: ${chunk.text.slice(0, 400)}`
  })
  return `Knowledge:\n${lines.join('\n')}`
}

function renderMessage(record: ChatMessageRecord): string {
  const role = record.role === 'user' ? 'User' : 'Assistant'
  // For assistant messages that contain a plan, include a compact summary instead of raw JSON.
  if (record.planJson && record.role === 'assistant') {
    try {
      const plan = JSON.parse(record.planJson) as { summary?: string }
      return `${role}: [CanvasPlan: ${plan.summary ?? 'canvas plan applied'}]`
    } catch {
      // Fall through to content
    }
  }
  return `${role}: ${record.content.slice(0, 600)}`
}

/**
 * Assembles bounded context for an Agent run from canvas, assets, knowledge, and messages.
 * @param input - Context sources, policy flags, and token budget.
 * @returns Rendered context string + lightweight ContextPack record.
 * @throws Error never intentionally; missing sources produce warnings, not failures.
 * @see specs/conversation-context-engine/requirements.md
 */
export function buildAgentContext(input: ContextBuilderInput): BuiltContext {
  const clock = input.clock ?? Date.now
  const packId = `ctx-${randomUUID()}`
  const sources: ContextSource[] = []
  const parts: string[] = []
  let tokenEstimate = 0

  function tryAdd(text: string, source: ContextSource): boolean {
    const tokens = estimateTokens(text)
    if (tokenEstimate + tokens > input.tokenBudget) {
      return false
    }
    tokenEstimate += tokens
    parts.push(text)
    sources.push(source)
    return true
  }

  // 3. Canvas summary
  if (input.policy.includeCanvasGraph && input.canvas) {
    const summary = renderCanvasSummary(input.canvas)
    if (summary) {
      tryAdd(summary, { kind: 'canvas', refId: input.workflowId, priority: 3 })
    }
  }

  // 4. Selected assets
  if (input.policy.includeSelectedAssets && input.assets && input.assets.assetIds.length > 0) {
    const summary = renderAssetsSummary(input.assets)
    if (summary) {
      tryAdd(summary, { kind: 'asset', refId: `assets:${input.assets.assetIds.slice(0, 4).join(',')}`, priority: 4 })
    }
  }

  // 5. Knowledge chunks
  if (input.policy.includeKnowledge && input.knowledgeChunks && input.knowledgeChunks.length > 0) {
    const rendered = renderKnowledgeChunks(input.knowledgeChunks)
    if (rendered) {
      tryAdd(rendered, { kind: 'knowledge', refId: `chunks:${input.knowledgeChunks.length}`, priority: 5 })
    }
  }

  // 6. Recent messages (oldest first, budget-limited, most recent dropped last)
  let messagesIncluded = 0
  if (input.policy.includeRecentMessages && input.recentMessages.length > 0) {
    const relevantMessages = input.recentMessages
      .filter((msg) => (msg.role === 'user' || msg.role === 'assistant') && msg.content.trim().length > 0)
      .slice(-20) // Hard cap before budget check

    for (const msg of relevantMessages) {
      const rendered = renderMessage(msg)
      if (tryAdd(rendered, { kind: 'message', refId: msg.id, priority: 6 })) {
        messagesIncluded += 1
      }
    }
  }

  const rendered = parts.length > 0
    ? `\n--- Context ---\n${parts.join('\n')}\n--- End Context ---`
    : ''

  const pack: ContextPack = {
    id: packId,
    agentId: input.agentId,
    sources,
    redactions: [],
    createdAt: clock()
  }

  return { rendered, pack, messagesIncluded, tokenEstimate }
}

/**
 * Simple lexical knowledge retrieval over pre-indexed text chunks.
 * Scores by keyword overlap — suitable for first-ship lexical retrieval.
 * A future version replaces this with embedding search.
 * @param query - Search query.
 * @param chunks - Candidate knowledge chunks.
 * @param limit - Maximum results.
 * @returns Top-scoring chunks.
 */
export function lexicalRetrieve(
  query: string,
  chunks: KnowledgeChunkInput[],
  limit = 5
): KnowledgeChunkInput[] {
  const queryWords = new Set(
    query.toLowerCase().split(/\W+/u).filter((w) => w.length > 2)
  )

  if (queryWords.size === 0) return []

  return chunks
    .map((chunk) => {
      const words = chunk.text.toLowerCase().split(/\W+/u)
      const overlap = words.filter((w) => queryWords.has(w)).length
      return { chunk, score: overlap / (queryWords.size + 1) }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({ ...item.chunk, score: item.score }))
}
