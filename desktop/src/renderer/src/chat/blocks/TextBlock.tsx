/**
 * Markdown 文本块 — react-markdown + GFM + 代码高亮。
 * @see docs/api-contracts/agents.md
 */

import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import { cn } from '../../lib/cn'

export interface TextBlockProps {
  markdown: string
  streaming: boolean
  role: 'user' | 'assistant'
}

/**
 * 渲染一个 Markdown 文本块；流式中显示光标。
 * @param props - Markdown 正文、流式标记与角色。
 * @returns 文本块元素。
 */
export function TextBlock({ markdown, streaming, role }: TextBlockProps): JSX.Element {
  return (
    <div
      className={cn(
        'cc-markdown rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed break-words',
        role === 'user'
          ? 'max-w-[85%] rounded-br-md bg-brand/15 text-text-base'
          : 'max-w-[94%] rounded-bl-md bg-bg-card text-text-secondary',
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {markdown}
      </ReactMarkdown>
      {streaming && <span className="ml-1 inline-block h-3.5 w-0.5 animate-pulse bg-brand" aria-hidden="true" />}
    </div>
  )
}
