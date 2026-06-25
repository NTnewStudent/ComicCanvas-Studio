import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, Lock, Pencil, Plus, Trash2 } from 'lucide-react'

import type { AgentDefinition } from '../../../../../shared/agents'
import type { IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import { cn } from '../lib/cn'
import { AgentForm } from './AgentForm'

export interface AgentSettingsApi {
  listAgents: () => Promise<AgentDefinition[]>
  saveAgent: (input: AgentDefinition) => Promise<AgentDefinition>
  deleteAgent: (request: IpcRequestMap['agent.delete']) => Promise<IpcResponseMap['agent.delete']>
}

export interface AgentListProps {
  api?: AgentSettingsApi
}

type LoadState = 'loading' | 'ready' | 'error'

function agentApi(): AgentSettingsApi {
  return window.comicCanvas
}

function listTools(agent: AgentDefinition): string[] {
  return agent.allowedTools === '*' ? ['所有工具'] : agent.allowedTools
}

function listSkills(agent: AgentDefinition): string[] {
  return agent.allowedSkills === '*' ? ['所有技能'] : agent.allowedSkills
}

function upsertAgent(current: AgentDefinition[], saved: AgentDefinition): AgentDefinition[] {
  const existing = current.findIndex((agent) => agent.id === saved.id)

  if (existing === -1) {
    return [...current, saved]
  }

  return current.map((agent) => (agent.id === saved.id ? saved : agent))
}

/**
 * Renders custom and built-in agent settings through the typed preload API.
 * @param props - Optional API override for component tests.
 * @returns Agent settings panel.
 * @throws Error never intentionally; request failures are shown as panel status.
 * @see docs/api-contracts/agents.md
 */
export function AgentList({ api = agentApi() }: AgentListProps): JSX.Element {
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [editing, setEditing] = useState<AgentDefinition | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<AgentDefinition | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const orderedAgents = useMemo(() => agents.slice().sort((left, right) => Number(left.source === 'user') - Number(right.source === 'user')), [agents])

  useEffect(() => {
    async function loadAgents(): Promise<void> {
      setLoadState('loading')

      try {
        const items = await api.listAgents()
        setAgents(items)
        setLoadState('ready')
      } catch {
        // Settings failures should stay in-panel so renderer isolation never leaks raw IPC errors.
        setLoadState('error')
        setMessage('Agent 列表加载失败。')
      }
    }

    void loadAgents()
  }, [api])

  async function save(input: AgentDefinition): Promise<void> {
    setSaving(true)
    setMessage(null)

    try {
      const saved = await api.saveAgent(input)
      setAgents((current) => upsertAgent(current, saved))
      setEditing(null)
      setMessage(`已保存 ${saved.name}`)
    } catch {
      // Save failures are surfaced as a safe status line instead of exposing transport details.
      setMessage('Agent 保存失败。')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) {
      return
    }

    const target = deleting
    try {
      await api.deleteAgent({ agentId: target.id })
      setAgents((current) => current.filter((agent) => agent.id !== target.id))
      setDeleting(null)
      setMessage(`已删除 ${target.name}`)
    } catch {
      // Delete failures remain recoverable from the settings surface.
      setMessage('Agent 删除失败。')
    }
  }

  return (
    <section className="flex w-full max-w-6xl flex-col gap-5 rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-card">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">Agent 设置</p>
          <h1 className="text-[24px] font-bold leading-tight text-text-base">Agent 注册表</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            管理内置和自定义 Agent，用于画布规划、工具访问和漫剧生成工作流。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover"
          aria-label="添加 Agent"
        >
          <Plus className="h-4 w-4" />
          添加 Agent
        </button>
      </header>

      {message && (
        <div className="inline-flex max-w-max items-center gap-2 rounded-pill border border-border-secondary bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-semantic-success" />
          {message}
        </div>
      )}

      {editing === 'new' && <AgentForm saving={saving} onSubmit={save} onCancel={() => setEditing(null)} />}
      {editing !== null && editing !== 'new' && <AgentForm agent={editing} saving={saving} onSubmit={save} onCancel={() => setEditing(null)} />}

      {loadState === 'loading' && <p className="text-[13px] text-text-muted">Agent 加载中...</p>}
      {loadState === 'error' && <p className="text-[13px] text-semantic-negative">Agent 设置无法加载。</p>}

      {loadState === 'ready' && (
        <div className="grid gap-3 xl:grid-cols-2">
          {orderedAgents.map((agent) => {
            const builtin = agent.source === 'builtin'

            return (
              <article key={agent.id} className="flex flex-col gap-4 rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[16px] font-semibold text-text-base">{agent.name}</h2>
                      <span
                        className={cn(
                          'rounded-pill border px-2 py-0.5 text-[12px] font-medium',
                          builtin ? 'border-border-secondary bg-bg-input text-text-muted' : 'border-border-primary bg-bg-hover text-brand'
                        )}
                      >
                        {agent.source}
                      </span>
                      {!agent.enabled && <span className="rounded-pill border border-border-input bg-bg-input px-2 py-0.5 text-[12px] text-text-muted">已禁用</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">{agent.description}</p>
                  </div>
                  <Bot className={cn('h-5 w-5 shrink-0', builtin ? 'text-text-muted' : 'text-brand')} />
                </div>

                <dl className="grid gap-2 text-[12px] text-text-secondary">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-muted">力度</dt>
                    <dd className="rounded-pill bg-bg-input px-2 py-0.5">{agent.effort}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-muted">最大轮次</dt>
                    <dd className="font-mono text-[12px] text-brand">{agent.maxTurns}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  {listTools(agent).slice(0, 5).map((tool) => (
                    <span key={tool} className="rounded-pill border border-border-input bg-bg-input px-2 py-1 text-[12px] font-medium text-text-secondary">
                      {tool}
                    </span>
                  ))}
                  {listTools(agent).length > 5 && <span className="rounded-pill border border-border-input bg-bg-input px-2 py-1 text-[12px] text-text-muted">+{listTools(agent).length - 5}</span>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {listSkills(agent).slice(0, 4).map((skill) => (
                    <span key={skill} className="rounded-pill border border-border-secondary bg-bg-card px-2 py-1 text-[12px] text-text-muted">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap justify-end gap-2">
                  {builtin ? (
                    <span className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-1.5 text-[13px] font-medium text-text-muted">
                      <Lock className="h-4 w-4" />
                      内置
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(agent)}
                        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-1.5 text-[13px] font-medium text-text-base transition hover:border-border-primary"
                        aria-label={`编辑 ${agent.name}`}
                      >
                        <Pencil className="h-4 w-4 text-brand" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(agent)}
                        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-1.5 text-[13px] font-medium text-semantic-negative transition hover:border-border-primary"
                        aria-label={`删除 ${agent.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {deleting && (
        <div role="alertdialog" aria-modal="true" aria-label={`删除 Agent ${deleting.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-pop">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-semantic-negative" />
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-text-base">删除 Agent {deleting.name}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">这将从本地注册表中删除该自定义 Agent 配置。</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-base"
              >
                取消
              </button>
              <button type="button" onClick={() => void confirmDelete()} className="rounded-lg bg-semantic-negative px-3 py-2 text-[13px] font-semibold text-white">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
