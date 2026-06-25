import { Suspense, lazy } from 'react'
import { Navigate, createHashRouter, type RouteObject } from 'react-router-dom'
import { WorkspaceLayout } from './components/WorkspaceLayout'

/* ------------------------------------------------------------------ */
/*  Lazy-loaded pages                                                  */
/* ------------------------------------------------------------------ */

const CanvasPage = lazy(() => import('./canvas/CanvasPage'))
const ProjectsListPage = lazy(() => import('./projects/ProjectsListPage'))
const AssetPage = lazy(() => import('./assets/AssetPage'))
const SettingsPage = lazy(() => import('./settings/SettingsPage'))
const ChatPage = lazy(() => import('./chat/ChatPage'))

function PageFallback(): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center text-text-muted text-sm">
      加载中…
    </div>
  )
}

function SuspensePage({ children }: { children: React.ReactNode }): JSX.Element {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

/* ------------------------------------------------------------------ */
/*  Route configuration                                                */
/* ------------------------------------------------------------------ */

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/projects" replace />,
  },
  {
    path: '/canvas',
    element: <SuspensePage><CanvasPage /></SuspensePage>,
  },
  {
    element: <WorkspaceLayout />,
    children: [
      {
        path: '/projects',
        element: <SuspensePage><ProjectsListPage /></SuspensePage>,
      },
      {
        path: '/assets',
        element: <SuspensePage><AssetPage /></SuspensePage>,
      },
      {
        path: '/settings',
        element: <SuspensePage><SettingsPage /></SuspensePage>,
      },
      {
        path: '/chat',
        element: <SuspensePage><ChatPage /></SuspensePage>,
      },
    ],
  },
]

export const router = createHashRouter(routes)
