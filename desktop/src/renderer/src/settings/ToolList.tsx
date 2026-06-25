import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Power, ShieldCheck, Wrench } from 'lucide-react'

import type { IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import type { ToolDescriptor } from '../../../../../shared/tools'
import { cn } from '../lib/cn'

export interface ToolSettingsApi {
  listTools: () => Promise<ToolDescriptor[]>
  enableTool: (request: IpcRequestMap['tool.enable']) => Promise<IpcResponseMap['tool.enable']>
  disableTool: (request: IpcRequestMap['tool.disable']) => Promise<IpcResponseMap['tool.disable']>
}

export interface ToolListProps {
  api?: ToolSettingsApi
}

type LoadState = 'loading' | 'ready' | 'error'

function toolApi(): ToolSettingsApi {
  return window.comicCanvas
}

function upsertTool(current: ToolDescriptor[], saved: ToolDescriptor): ToolDescriptor[] {
  return current.map((tool) => (tool.id === saved.id ? saved : tool))
}

function ownerLabel(tool: ToolDescriptor): string {
  return tool.owner.kind
}

/**
 * Renders the built-in and plugin tool registry settings surface.
 * @param props - Optional API override for component tests.
 * @returns Tool management panel.
 * @throws Error never intentionally; request failures are shown inside the panel.
 * @see docs/api-contracts/tools-plugins.md
 */
export function ToolList({ api = toolApi() }: ToolListProps): JSX.Element {
  const [tools, setTools] = useState<ToolDescriptor[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const orderedTools = useMemo(
    () => tools.slice().sort((left, right) => `${left.category}:${left.id}`.localeCompare(`${right.category}:${right.id}`)),
    [tools]
  )

  useEffect(() => {
    async function loadTools(): Promise<void> {
      setLoadState('loading')

      try {
        const items = await api.listTools()
        setTools(items)
        setLoadState('ready')
      } catch {
        // Tool settings failures stay local to the panel and do not expose raw IPC details.
        setLoadState('error')
        setMessage('Tool list failed to load.')
      }
    }

    void loadTools()
  }, [api])

  async function toggleTool(tool: ToolDescriptor): Promise<void> {
    setMessage(null)

    try {
      const saved = tool.enabled ? await api.disableTool({ toolId: tool.id }) : await api.enableTool({ toolId: tool.id })
      setTools((current) => upsertTool(current, saved))
      setMessage(`${saved.enabled ? 'Enabled' : 'Disabled'} ${saved.name}`)
    } catch {
      // Toggle failures should be recoverable without leaking transport or stack details.
      setMessage('Tool toggle failed.')
    }
  }

  return (
    <section className="flex w-full max-w-6xl flex-col gap-5 rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-card">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">Tool settings</p>
          <h1 className="text-[24px] font-bold leading-tight text-text-base">Tool registry</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            Review built-in canvas tools, permissions, concurrency policy, and whether agents may invoke them.
          </p>
        </div>
        <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-secondary">
          <Wrench className="h-4 w-4 text-brand" />
          {orderedTools.length} tools
        </div>
      </header>

      {message && (
        <div className="inline-flex max-w-max items-center gap-2 rounded-pill border border-border-secondary bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-semantic-success" />
          {message}
        </div>
      )}

      {loadState === 'loading' && <p className="text-[13px] text-text-muted">Loading tools...</p>}
      {loadState === 'error' && <p className="text-[13px] text-semantic-negative">Tool settings could not be loaded.</p>}

      {loadState === 'ready' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {orderedTools.map((tool) => (
            <article key={tool.id} className="flex flex-col gap-4 rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[16px] font-semibold text-text-base">{tool.name}</h2>
                    <span className="rounded-pill border border-border-secondary bg-bg-input px-2 py-0.5 text-[12px] font-medium text-text-muted">{ownerLabel(tool)}</span>
                    <span className="rounded-pill border border-border-input bg-bg-input px-2 py-0.5 text-[12px] text-text-secondary">{tool.category}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">{tool.description}</p>
                  <p className="mt-2 truncate font-mono text-[12px] text-brand">{tool.id}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-[12px] font-medium text-text-secondary">
                  <span className="sr-only">{tool.name} enabled</span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`${tool.name} enabled`}
                    checked={tool.enabled}
                    onChange={() => void toggleTool(tool)}
                    className="h-4 w-8 rounded-pill accent-[var(--cc-accent-gold)]"
                  />
                  <Power className={cn('h-4 w-4', tool.enabled ? 'text-semantic-success' : 'text-text-muted')} />
                </label>
              </div>

              <dl className="grid gap-2 text-[12px] text-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-text-muted">Concurrency</dt>
                  <dd className="rounded-pill bg-bg-input px-2 py-0.5">{tool.concurrency}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-text-muted">Input</dt>
                  <dd className="truncate font-mono text-[12px] text-brand">{tool.inputSchemaRef}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {tool.permissions.length === 0 && <span className="rounded-pill border border-border-input bg-bg-input px-2 py-1 text-[12px] text-text-muted">no permissions</span>}
                {tool.permissions.map((permission) => (
                  <span key={`${tool.id}-${permission.kind}`} className="inline-flex items-center gap-1 rounded-pill border border-border-input bg-bg-input px-2 py-1 text-[12px] font-medium text-text-secondary">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                    {permission.kind}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
