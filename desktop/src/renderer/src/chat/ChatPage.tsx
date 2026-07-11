import { useNavigate } from 'react-router-dom'
import { ChatPanel } from './ChatPanel'

/**
 * 独立聊天页 — Agent Workbench 撑满可用高度并展示运行检查器。
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
      <div className="flex h-full min-h-0 w-full max-w-6xl flex-col">
        <ChatPanel onApplyPlan={handleApplyPlan} onDraftGraphApplied={handleApplyPlan} />
      </div>
    </div>
  )
}
