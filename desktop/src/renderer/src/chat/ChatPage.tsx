import { useNavigate } from 'react-router-dom'
import { ChatPanel } from './ChatPanel'
export default function ChatPage(): JSX.Element {
  const navigate = useNavigate()

  function handleApplyPlan(): void {
    // Navigate to canvas so the user can see the plan being applied.
    void navigate('/canvas')
  }

  return (
    <div className="flex flex-col h-full p-4">
      <ChatPanel onApplyPlan={handleApplyPlan} />
    </div>
  )
}
