import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'

import type { IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import type { SkillDefinition } from '../../../../../shared/skills'
import { cn } from '../lib/cn'

export interface SkillSettingsApi {
  listSkills: (request?: IpcRequestMap['skill.list']) => Promise<IpcResponseMap['skill.list']>
  reloadSkills: (request?: IpcRequestMap['skill.reload']) => Promise<IpcResponseMap['skill.reload']>
  enableSkill: (request: IpcRequestMap['skill.enable']) => Promise<IpcResponseMap['skill.enable']>
  disableSkill: (request: IpcRequestMap['skill.disable']) => Promise<IpcResponseMap['skill.disable']>
}

export interface SkillListProps {
  api?: SkillSettingsApi
}

type LoadState = 'loading' | 'ready' | 'error'

function skillApi(): SkillSettingsApi {
  return window.comicCanvas
}

function sourceLabel(source: SkillDefinition['source']): string {
  switch (source) {
    case 'builtin':
      return '内置'
    case 'user':
      return '用户'
    case 'plugin':
      return '插件'
    default:
      return source
  }
}

/**
 * Renders the skill registry settings surface (metadata-first, lazy instructions).
 * @param props - Optional API override for component tests.
 * @returns Skill management panel.
 * @throws Error never intentionally; request failures are shown inside the panel.
 * @see docs/api-contracts/skills.md
 */
export function SkillList({ api = skillApi() }: SkillListProps): JSX.Element {
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)

  const orderedSkills = useMemo(
    () => skills.slice().sort((left, right) => left.id.localeCompare(right.id)),
    [skills],
  )

  useEffect(() => {
    async function loadSkills(): Promise<void> {
      setLoadState('loading')

      try {
        const items = await api.listSkills({ includeDisabled: true })
        setSkills(items)
        setLoadState('ready')
      } catch {
        // Skill settings failures stay local to the panel and do not expose raw IPC details.
        setLoadState('error')
        setMessage('技能列表加载失败。')
      }
    }

    void loadSkills()
  }, [api])

  async function handleToggle(skill: SkillDefinition): Promise<void> {
    setMessage(null)
    try {
      const saved = skill.enabled
        ? await api.disableSkill({ skillId: skill.id })
        : await api.enableSkill({ skillId: skill.id })
      if ('errorClass' in saved) {
        setMessage('技能切换失败。')
        return
      }
      setSkills((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)))
      setMessage(`${saved.enabled ? '已启用' : '已禁用'} ${saved.name}`)
    } catch {
      setMessage('技能切换失败。')
    }
  }

  async function handleReload(): Promise<void> {
    setMessage(null)
    setReloading(true)

    try {
      const result = await api.reloadSkills({})
      const items = await api.listSkills({ includeDisabled: true })
      setSkills(items)
      setMessage(`已重新加载 ${result.reloadedSkillIds.length} 个技能`)
    } catch {
      // Reload failures should be recoverable without leaking transport or stack details.
      setMessage('技能重新加载失败。')
    } finally {
      setReloading(false)
    }
  }

  return (
    <section className="flex w-full max-w-6xl flex-col gap-5 rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-card">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">技能设置</p>
          <h1 className="text-[24px] font-bold leading-tight text-text-base">技能注册表</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            查看内置与用户技能元数据。指令正文仅在 Agent 运行时按需加载，不会全部注入上下文。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-secondary">
            <Sparkles className="h-4 w-4 text-brand" />
            {orderedSkills.length} 个技能
          </div>
          <button
            type="button"
            onClick={() => void handleReload()}
            disabled={reloading}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-secondary transition-colors',
              reloading ? 'opacity-60' : 'hover:bg-bg-hover',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', reloading && 'animate-spin')} />
            重新加载
          </button>
        </div>
      </header>

      {message && (
        <div className="inline-flex max-w-max items-center gap-2 rounded-pill border border-border-secondary bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-semantic-success" />
          {message}
        </div>
      )}

      {loadState === 'loading' && <p className="text-[13px] text-text-muted">技能加载中...</p>}
      {loadState === 'error' && <p className="text-[13px] text-semantic-negative">技能设置无法加载。</p>}

      {loadState === 'ready' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {orderedSkills.map((skill) => {
            const expanded = expandedSkillId === skill.id

            return (
              <article key={skill.id} className="flex flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[16px] font-semibold text-text-base">{skill.name}</h2>
                      <span className="rounded-pill border border-border-secondary bg-bg-input px-2 py-0.5 text-[12px] font-medium text-text-muted">
                        {sourceLabel(skill.source)}
                      </span>
                      {!skill.enabled && (
                        <span className="rounded-pill border border-border-input bg-bg-input px-2 py-0.5 text-[12px] text-text-secondary">
                          已禁用
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-text-secondary">{skill.description}</p>
                    <p className="mt-2 truncate font-mono text-[12px] text-brand">{skill.id}</p>
                  </div>
                  <BookOpen className="h-5 w-5 shrink-0 text-text-muted" />
                </div>
                <label className="inline-flex items-center gap-2 text-[12px] font-medium text-text-secondary">
                  <span className="sr-only">{skill.name} enabled</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={skill.enabled}
                    onChange={() => void handleToggle(skill)}
                    className="h-4 w-4 accent-brand"
                  />
                  {skill.enabled ? '已启用' : '已禁用'}
                </label>

                <div className="flex flex-wrap gap-2 text-[12px] text-text-muted">
                  <span className="rounded-pill border border-border-input bg-bg-input px-2 py-0.5">v{skill.version}</span>
                  <span className="rounded-pill border border-border-input bg-bg-input px-2 py-0.5">
                    {skill.references.length} 个引用
                  </span>
                  {skill.requiredTools.length > 0 && (
                    <span className="rounded-pill border border-border-input bg-bg-input px-2 py-0.5">
                      {skill.requiredTools.length} 个依赖工具
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedSkillId(expanded ? null : skill.id)}
                  className="self-start text-[12px] font-medium text-brand hover:underline"
                >
                  {expanded ? '收起详情' : '查看元数据'}
                </button>

                {expanded && (
                  <pre className="max-h-48 overflow-auto rounded-lg border border-border-input bg-bg-input p-3 text-[11px] leading-relaxed text-text-secondary">
                    {JSON.stringify(skill, null, 2)}
                  </pre>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
