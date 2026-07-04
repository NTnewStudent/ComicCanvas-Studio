/**
 * Per-model token cost estimation for Agent runs.
 *
 * Rates are USD per 1,000,000 tokens. Unknown models cost 0 (counts still
 * tracked). Keep this list small and obviously approximate — it is for
 * in-app observability, not billing.
 *
 * @see docs/api-contracts/agents.md
 */

export interface ModelRate {
  /** USD per 1M input tokens. */
  inputPerMillion: number
  /** USD per 1M output tokens. */
  outputPerMillion: number
}

const MODEL_RATES: Record<string, ModelRate> = {
  'deepseek-chat': { inputPerMillion: 0.27, outputPerMillion: 1.1 },
  'deepseek-reasoner': { inputPerMillion: 0.55, outputPerMillion: 2.19 },
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 }
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0 }
}

/**
 * Estimates the USD cost for a single model call.
 * @param modelId - Provider model identifier (may be empty/unknown).
 * @param inputTokens - Prompt tokens.
 * @param outputTokens - Completion tokens.
 * @returns Estimated cost in USD; 0 when the model has no known rate.
 */
export function estimateCostUsd(modelId: string | undefined, inputTokens: number, outputTokens: number): number {
  const rate = modelId ? MODEL_RATES[modelId] : undefined
  if (!rate) {
    return 0
  }
  return (inputTokens / 1_000_000) * rate.inputPerMillion + (outputTokens / 1_000_000) * rate.outputPerMillion
}

/**
 * Adds a single call's usage into a running total.
 * @param total - Accumulator (mutated copy returned).
 * @param add - Usage for one call.
 * @returns New accumulated usage.
 */
export function addUsage(total: TokenUsage, add: Partial<TokenUsage>): TokenUsage {
  return {
    inputTokens: total.inputTokens + (add.inputTokens ?? 0),
    outputTokens: total.outputTokens + (add.outputTokens ?? 0),
    costUsd: total.costUsd + (add.costUsd ?? 0)
  }
}

/**
 * Formats a compact, user-visible usage/cost line for the chat transcript.
 * @param usage - Accumulated usage.
 * @returns A short string such as "Tokens 1.2k in / 340 out · ~$0.0012".
 */
export function formatUsage(usage: TokenUsage): string {
  const compact = (value: number): string => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value))
  const cost = usage.costUsd > 0 ? ` · ~$${usage.costUsd.toFixed(4)}` : ''
  return `用量：输入 ${compact(usage.inputTokens)} / 输出 ${compact(usage.outputTokens)} tokens${cost}`
}
