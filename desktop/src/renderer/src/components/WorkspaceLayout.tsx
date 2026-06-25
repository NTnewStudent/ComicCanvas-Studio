import { Outlet } from 'react-router-dom'
import { WorkspaceSidebar } from './WorkspaceSidebar'

/**
 * Workspace layout with persistent sidebar.
 * Canvas page uses its own full-screen layout and is NOT wrapped by this.
 */
export function WorkspaceLayout() {
  return (
    <main className="flex h-screen overflow-hidden bg-bg-base text-text-base">
      <WorkspaceSidebar />
      <section className="relative flex flex-1 flex-col h-full overflow-x-hidden overflow-y-auto">
        <Outlet />
      </section>
    </main>
  )
}
