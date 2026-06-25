import { useNavigate } from 'react-router-dom'
import { ChatPanel } from './ChatPanel'
import type { ApplyPlanOptions } from './PlanCard'
import type { CanvasPlan } from '../../../../../shared/plan'

export default function ChatPage(): JSX.Element {
  const navigate = useNavigate()

  function handleApplyPlan(_plan: CanvasPlan, _options: ApplyPlanOptions): void {
    // Navigate to canvas so the user can see the plan being applied.
    navigate('/canvas')
  }

  return (
    <div className="flex flex-col h-full p-4">
      <ChatPanel onApplyPlan={handleApplyPlan} />
    </div>
  )
}
