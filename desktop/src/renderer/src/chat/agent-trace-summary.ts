/**
 * Formats durable Agent run trace metadata into user-visible summary lines.
 * @see docs/api-contracts/agents.md
 */

interface TraceIntentAnalysis {
  summary?: unknown
  requirements?: unknown
  missing?: unknown
  executionMode?: unknown
  recommendedAgentId?: unknown
}

interface TraceCapabilityCheck {
  localCapabilities?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

/**
 * Converts persisted Agent trace into compact audit-summary chat lines.
 * @param trace - Trace returned by `agent.getRun`.
 * @returns Stable, user-visible reasoning summary lines.
 * @throws Error never intentionally; malformed trace fields are ignored.
 * @see docs/api-contracts/agents.md
 */
export function formatAgentTraceSummary(trace: Record<string, unknown> | undefined): string[] {
  if (!trace) return []

  const intent = isRecord(trace.intentAnalysis) ? trace.intentAnalysis as TraceIntentAnalysis : null
  const capability = isRecord(trace.capabilityCheck) ? trace.capabilityCheck as TraceCapabilityCheck : null
  const lines: string[] = []

  if (intent && typeof intent.summary === 'string' && intent.summary.trim().length > 0) {
    lines.push(`理解输入：${intent.summary}`)
  }

  const requirements = stringList(intent?.requirements)
  if (requirements.length > 0) {
    lines.push(`拆解需求：${requirements.join('、')}`)
  }

  const missing = stringList(intent?.missing)
  if (missing.length > 0) {
    lines.push(`需要澄清：${missing.join('、')}`)
  }

  const capabilities = stringList(capability?.localCapabilities)
  if (capabilities.length > 0) {
    lines.push(`检查本地能力：${capabilities.join('、')}`)
  }

  if (intent && typeof intent.executionMode === 'string' && typeof intent.recommendedAgentId === 'string') {
    lines.push(`执行模式：${intent.executionMode}；推荐 Agent：${intent.recommendedAgentId}。`)
  }

  if (typeof trace.usageSummary === 'string' && trace.usageSummary.trim().length > 0) {
    lines.push(trace.usageSummary)
  }

  return lines
}
