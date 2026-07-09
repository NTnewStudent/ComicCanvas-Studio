/**
 * 思考过程块 — 可折叠 progress 行列表；运行中自动展开。
 * @see docs/api-contracts/agents.md
 */

export interface ThinkingBlockProps {
  lines: string[]
  /** 回合仍在运行时自动展开。 */
  live: boolean
}

/**
 * 渲染可折叠的思考行块。
 * @param props - progress 行与运行态标记。
 * @returns 折叠块元素或 null。
 */
export function ThinkingBlock({ lines, live }: ThinkingBlockProps): JSX.Element | null {
  if (lines.length === 0) {
    return null
  }

  return (
    <details
      open={live}
      className="rounded-lg border border-border-secondary bg-bg-card/60 px-3 py-2 text-[12px] text-text-muted"
    >
      <summary className="cursor-pointer select-none text-text-secondary">思考过程（{lines.length}）</summary>
      <div className="mt-2 space-y-1">
        {lines.map((line, index) => (
          <p key={`think-${index}`} className="m-0 font-mono leading-relaxed">
            {line}
          </p>
        ))}
      </div>
    </details>
  )
}
