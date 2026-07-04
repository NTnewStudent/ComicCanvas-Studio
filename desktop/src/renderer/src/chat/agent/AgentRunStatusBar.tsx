/**
 * Minimal Agent run status strip (turns, elapsed time, token usage).
 * @see docs/api-contracts/agents.md
 */

interface TokenUsage {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

interface RunTraceMetrics {
  startedAt?: unknown
  completedAt?: unknown
  turnCount?: unknown
  usage?: unknown
  usageSummary?: unknown
}

function readUsage(value: unknown): TokenUsage | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  const inputTokens = typeof record.inputTokens === 'number' ? record.inputTokens : 0
  const outputTokens = typeof record.outputTokens === 'number' ? record.outputTokens : 0
  const costUsd = typeof record.costUsd === 'number' ? record.costUsd : 0

  if (inputTokens === 0 && outputTokens === 0 && costUsd === 0) {
    return null
  }

  return { inputTokens, outputTokens, costUsd }
}

function formatUsage(usage: TokenUsage): string {
  const compact = (value: number): string => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value))
  const cost = usage.costUsd > 0 ? ` · ~$${usage.costUsd.toFixed(4)}` : ''
  return `用量：输入 ${compact(usage.inputTokens)} / 输出 ${compact(usage.outputTokens)} tokens${cost}`
}

function formatElapsed(startedAt: number, completedAt?: number): string {
  const end = completedAt ?? Date.now()
  const seconds = Math.max(0, Math.round((end - startedAt) / 1000))

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

/**
 * Renders a compact run status line under the chat composer.
 * @param props - Busy flag, client start time, and optional persisted trace metrics.
 * @returns Status strip or null when idle without metrics.
 */
export function AgentRunStatusBar({
  busy,
  runStartedAt,
  trace
}: {
  busy: boolean
  runStartedAt: number | null
  trace?: Record<string, unknown> | null
}): JSX.Element | null {
  const metrics = trace as RunTraceMetrics | null | undefined
  const startedAt = typeof metrics?.startedAt === 'number' ? metrics.startedAt : runStartedAt
  const completedAt = typeof metrics?.completedAt === 'number' ? metrics.completedAt : undefined
  const turnCount = typeof metrics?.turnCount === 'number' ? metrics.turnCount : null
  const usage = readUsage(metrics?.usage)
  const usageSummary = typeof metrics?.usageSummary === 'string' ? metrics.usageSummary : null

  if (!busy && !startedAt && turnCount === null && !usage && !usageSummary) {
    return null
  }

  const parts: string[] = []

  if (busy) {
    parts.push('运行中')
  }

  if (startedAt) {
    parts.push(`耗时 ${formatElapsed(startedAt, completedAt)}`)
  }

  if (turnCount !== null && turnCount > 0) {
    parts.push(`${turnCount} 轮`)
  }

  if (usage) {
    parts.push(formatUsage(usage))
  } else if (usageSummary) {
    parts.push(usageSummary)
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border-secondary bg-bg-input/50 px-2.5 py-1.5 text-[11px] text-text-muted">
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
    </div>
  )
}
