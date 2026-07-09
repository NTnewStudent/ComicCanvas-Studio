import { useNavigate } from 'react-router-dom'
import { ChatPanel } from './ChatPanel'

/**
 * 独立聊天页 — 居中限宽列，ChatPanel 撑满可用高度。
 * @returns 聊天页面元素。
 */
export default function ChatPage(): JSX.Element {
  const navigate = useNavigate()

  function handleApplyPlan(): void {
    // Navigate to canvas so the user can see the plan being applied.
    void navigate('/canvas')
  }

  return (
    <div className="flex h-full min-h-0 justify-center p-4 md:p-6">
      <div className="flex h-full min-h-0 w-full max-w-3xl flex-col">
        <ChatPanel onApplyPlan={handleApplyPlan} />
      </div>
    </div>
  )
}
