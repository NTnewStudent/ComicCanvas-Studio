/**
 * 回合尾部用量摘要行。
 * @see docs/api-contracts/agents.md
 */

/**
 * 渲染 token 用量摘要。
 * @param props - 用量摘要文本。
 * @returns 用量行元素。
 */
export function UsageFooter({ summary }: { summary: string }): JSX.Element {
  return <p className="m-0 px-1 text-[11px] text-text-muted">{summary}</p>
}
