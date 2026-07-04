import { useEffect, useState } from 'react'
import { CheckCircle2, FlaskConical, Plus, Power, Trash2 } from 'lucide-react'

import type { GatewayCapability, GatewayConfigInput, GatewayConfigView } from '../../../../../shared/gateway'
import type { IpcRequestMap, IpcResponseMap } from '../../../../../shared/ipc'
import { cn } from '../lib/cn'
import { GatewayForm } from './GatewayForm'

export interface GatewaySettingsApi {
  listGateways: () => Promise<GatewayConfigView[]>
  saveGateway: (input: GatewayConfigInput) => Promise<GatewayConfigView>
  deleteGateway: (request: IpcRequestMap['gateway.delete']) => Promise<IpcResponseMap['gateway.delete']>
  testGateway: (request: IpcRequestMap['gateway.test']) => Promise<IpcResponseMap['gateway.test']>
  fetchGatewayModels: (request: IpcRequestMap['gateway.fetchModels']) => Promise<IpcResponseMap['gateway.fetchModels']>
}

type LoadState = 'loading' | 'ready' | 'error'

function gatewayApi(): GatewaySettingsApi {
  return window.comicCanvas
}

function maskKeyRef(keyRef: string): string {
  if (keyRef.length <= 12) {
    return keyRef
  }

  return `${keyRef.slice(0, 8)}...${keyRef.slice(-4)}`
}

function inputFromView(gateway: GatewayConfigView, enabled = gateway.enabled): GatewayConfigInput {
  return {
    id: gateway.id,
    name: gateway.name,
    type: gateway.type,
    baseUrl: gateway.baseUrl,
    auth: { mode: 'existingRef', keyRef: gateway.keyRef },
    capabilities: gateway.capabilities,
    modelMap: gateway.modelMap,
    enabled
  }
}

function firstTestChannel(capabilities: GatewayCapability[]): IpcRequestMap['gateway.test']['channel'] {
  if (capabilities.includes('text')) {
    return 'text'
  }

  if (capabilities.includes('image')) {
    return 'image'
  }

  return 'video'
}

function modelBadges(gateway: GatewayConfigView): string[] {
  return [gateway.modelMap.text, gateway.modelMap.image, gateway.modelMap.video].filter((item): item is string => typeof item === 'string' && item.length > 0)
}

export interface GatewayListProps {
  api?: GatewaySettingsApi
}

/**
 * Renders gateway provider settings and routes actions through the typed preload API.
 * @param props - Optional API override for component tests.
 * @returns Gateway settings panel.
 * @throws Error never intentionally; request failures are shown as panel status.
 * @see docs/api-contracts/gateway-providers.md
 */
export function GatewayList({ api = gatewayApi() }: GatewayListProps): JSX.Element {
  const [gateways, setGateways] = useState<GatewayConfigView[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [editing, setEditing] = useState<GatewayConfigView | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<GatewayConfigView | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadGateways(): Promise<void> {
      setLoadState('loading')

      try {
        const items = await api.listGateways()
        setGateways(items)
        setLoadState('ready')
      } catch {
        setLoadState('error')
        setMessage('网关列表加载失败。')
      }
    }

    void load()
    async function load(): Promise<void> {
      await loadGateways()
    }
  }, [api])

  async function save(input: GatewayConfigInput): Promise<void> {
    setSaving(true)
    setMessage(null)

    try {
      const saved = await api.saveGateway(input)
      setGateways((current) => {
        const existing = current.findIndex((item) => item.id === saved.id)
        if (existing === -1) {
          return [...current, saved]
        }

        return current.map((item) => (item.id === saved.id ? saved : item))
      })
      setEditing(null)
      setMessage(`已保存 ${saved.name}`)
    } catch {
      setMessage('网关保存失败。')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnabled(gateway: GatewayConfigView): Promise<void> {
    await save(inputFromView(gateway, !gateway.enabled))
  }

  async function testGateway(gateway: GatewayConfigView): Promise<void> {
    setMessage(null)
    const ticket = await api.testGateway({ gatewayId: gateway.id, channel: firstTestChannel(gateway.capabilities) })
    setMessage(`测试已排队：${ticket.jobId}`)
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) {
      return
    }

    const target = deleting
    await api.deleteGateway({ gatewayId: target.id })
    setGateways((current) => current.filter((item) => item.id !== target.id))
    setDeleting(null)
    setMessage(`已删除 ${target.name}`)
  }

  return (
    <section className="flex w-full max-w-6xl flex-col gap-5 rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-card">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">网关设置</p>
          <h1 className="text-[24px] font-bold leading-tight text-text-base">供应商路由</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            管理文本、图片、视频生成的模型网关。密钥在界面中以保险库引用表示。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover"
          aria-label="添加网关"
        >
          <Plus className="h-4 w-4" />
          添加网关
        </button>
      </header>

      {message && (
        <div className="inline-flex max-w-max items-center gap-2 rounded-pill border border-border-secondary bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-semantic-success" />
          {message}
        </div>
      )}

      {editing === 'new' && <GatewayForm saving={saving} fetchModels={api.fetchGatewayModels} onSubmit={save} onCancel={() => setEditing(null)} />}
      {editing !== null && editing !== 'new' && <GatewayForm gateway={editing} saving={saving} fetchModels={api.fetchGatewayModels} onSubmit={save} onCancel={() => setEditing(null)} />}

      {loadState === 'loading' && <p className="text-[13px] text-text-muted">网关加载中...</p>}
      {loadState === 'error' && <p className="text-[13px] text-semantic-negative">网关设置无法加载。</p>}

      {loadState === 'ready' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {gateways.map((gateway) => (
            <article key={gateway.id} className="flex flex-col gap-4 rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold text-text-base">{gateway.name}</h2>
                  <p className="mt-1 truncate text-[12px] text-text-muted">{gateway.baseUrl}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-[12px] font-medium text-text-secondary">
                  <span className="sr-only">{gateway.name} enabled</span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`${gateway.name} enabled`}
                    checked={gateway.enabled}
                    onChange={() => void toggleEnabled(gateway)}
                    className="h-4 w-8 rounded-pill accent-[var(--cc-accent-gold)]"
                  />
                  <Power className={cn('h-4 w-4', gateway.enabled ? 'text-semantic-success' : 'text-text-muted')} />
                </label>
              </div>

              <dl className="grid gap-2 text-[12px] text-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-text-muted">类型</dt>
                  <dd className="rounded-pill bg-bg-input px-2 py-0.5">{gateway.type}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-text-muted">密钥</dt>
                  <dd className="font-mono text-[12px] text-brand">{maskKeyRef(gateway.keyRef)}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {modelBadges(gateway).map((model) => (
                  <span key={model} className="rounded-pill border border-border-input bg-bg-input px-2 py-1 text-[12px] font-medium text-text-secondary">
                    {model}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(gateway)}
                  className="inline-flex min-h-8 items-center justify-center rounded-lg border border-border-input bg-bg-input px-3 py-1.5 text-[13px] font-medium text-text-base transition hover:border-border-primary"
                  aria-label={`编辑 ${gateway.name}`}
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => void testGateway(gateway)}
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-1.5 text-[13px] font-medium text-text-base transition hover:border-border-primary"
                  aria-label={`测试 ${gateway.name}`}
                >
                  <FlaskConical className="h-4 w-4 text-brand" />
                  测试
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(gateway)}
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-3 py-1.5 text-[13px] font-medium text-semantic-negative transition hover:border-border-primary"
                  aria-label={`删除 ${gateway.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleting && (
        <div role="alertdialog" aria-modal="true" aria-label={`删除网关 ${deleting.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border-secondary bg-bg-surface p-5 shadow-pop">
            <h2 className="text-[16px] font-semibold text-text-base">删除网关 {deleting.name}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">这将从本地设置列表中删除该网关配置。</p>
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
