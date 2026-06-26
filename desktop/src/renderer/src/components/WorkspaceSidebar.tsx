import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  Settings,
  FolderOpen,
  Sun,
  Moon,
  Monitor,
  Activity,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { useThemeStore, type ThemePreference } from '../stores/useThemeStore'

/* ------------------------------------------------------------------ */
/*  Theme cycle button                                                 */
/* ------------------------------------------------------------------ */

function ThemeCycleButton() {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  const cycle = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system']
    const idx = order.indexOf(preference)
    setPreference(order[(idx + 1) % order.length]!)
  }

  const Icon =
    preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label="切换主题"
      title="切换主题"
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-200 hover:bg-bg-hover hover:text-text-base"
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Navigation items                                                   */
/* ------------------------------------------------------------------ */

interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  to: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'projects', label: '项目', icon: LayoutGrid, to: '/projects' },
  { key: 'assets', label: '资产', icon: FolderOpen, to: '/assets' },
  { key: 'settings', label: '设置', icon: Settings, to: '/settings' },
]

function isActivePath(currentPath: string, targetPath: string): boolean {
  if (targetPath === '/projects') return currentPath === '/projects' || currentPath === '/'
  return currentPath.startsWith(targetPath)
}

function SidebarNavItem({
  item,
  active,
}: {
  item: NavItem
  active: boolean
}) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-all duration-150',
        active
          ? 'bg-bg-hover text-text-base shadow-sm'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-all duration-150',
          active
            ? 'text-text-base'
            : 'text-text-muted group-hover:translate-x-0.5 group-hover:text-text-secondary',
        )}
      />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

/* ------------------------------------------------------------------ */
/*  Health indicator (lightweight)                                     */
/* ------------------------------------------------------------------ */

function HealthDot() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
      <Activity className="h-3.5 w-3.5" />
      <span>运行时</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  WorkspaceSidebar                                                   */
/* ------------------------------------------------------------------ */

export function WorkspaceSidebar() {
  const location = useLocation()

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border-secondary bg-bg-surface">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg-hover text-[13px] font-bold text-text-base shadow-sm">
          C
        </span>
        <span className="truncate text-[15px] font-bold tracking-tight text-text-base">
          ComicCanvas
        </span>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 space-y-1 px-3 pt-2" aria-label="主导航">
        <p className="mb-2 px-3.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          工作区
        </p>
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.key}
            item={item}
            active={isActivePath(location.pathname, item.to)}
          />
        ))}
      </nav>

      {/* Bottom: Theme toggle + Health */}
      <div className="flex items-center justify-between border-t border-border-secondary p-3.5">
        <ThemeCycleButton />
        <HealthDot />
      </div>
    </aside>
  )
}
