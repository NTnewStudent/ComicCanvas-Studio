import { useMemo, useState } from 'react'
import { KeyRound, LinkIcon, Save, X } from 'lucide-react'

import type { GatewayCapability, GatewayConfigInput, GatewayConfigView, GatewayModelMap, GatewayType } from '../../../../../shared/gateway'
import { cn } from '../lib/cn'

export interface GatewayFormProps {
  gateway?: GatewayConfigView | undefined
  onSubmit: (input: GatewayConfigInput) => Promise<void> | void
  onCancel: () => void
  saving?: boolean
}

const gatewayTypes: Array<{ value: GatewayType; label: string }> = [
  { value: 'openai_compat', label: 'OpenAI 兼容' },
  { value: 'async_media_task', label: '异步媒体任务' },
  { value: 'stub', label: '桩供应商' }
]

const channelCapabilities: Array<{ channel: keyof GatewayModelMap; capability: GatewayCapability; label: string; inputLabel: string }> = [
  { channel: 'text', capability: 'text', label: '文本能力', inputLabel: '文本模型键' },
  { channel: 'image', capability: 'image', label: '图片能力', inputLabel: '图片模型键' },
  { channel: 'video', capability: 'video', label: '视频能力', inputLabel: '视频模型键' }
]

function defaultCapabilities(gateway?: GatewayConfigView): GatewayCapability[] {
  return gateway?.capabilities ?? ['text', 'image']
}

function modelValue(modelMap: GatewayModelMap, channel: keyof GatewayModelMap): string {
  return modelMap[channel] ?? ''
}

function nextCapabilities(current: GatewayCapability[], capability: GatewayCapability, checked: boolean): GatewayCapability[] {
  if (checked) {
    return current.includes(capability) ? current : [...current, capability]
  }

  return current.filter((item) => item !== capability)
}

function compactModelMap(modelMap: GatewayModelMap, capabilities: GatewayCapability[]): GatewayModelMap {
  const compact: GatewayModelMap = {}

  for (const item of channelCapabilities) {
    const value = modelValue(modelMap, item.channel).trim()
    if (capabilities.includes(item.capability) && value.length > 0) {
      compact[item.channel] = value
    }
  }

  return compact
}

/**
 * Renders the gateway configuration form for create and edit flows.
 * @param props - Existing gateway, submit handler, cancel handler, and saving flag.
 * @returns Gateway settings form.
 * @throws Error never intentionally; validation errors are represented through form state.
 * @see docs/api-contracts/gateway-providers.md
 */
export function GatewayForm({ gateway, onSubmit, onCancel, saving = false }: GatewayFormProps): JSX.Element {
  const [name, setName] = useState(gateway?.name ?? '')
  const [type, setType] = useState<GatewayType>(gateway?.type ?? 'openai_compat')
  const [baseUrl, setBaseUrl] = useState(gateway?.baseUrl ?? '')
  const [secret, setSecret] = useState('')
  const [enabled, setEnabled] = useState(gateway?.enabled ?? true)
  const [capabilities, setCapabilities] = useState<GatewayCapability[]>(defaultCapabilities(gateway))
  const [modelMap, setModelMap] = useState<GatewayModelMap>(gateway?.modelMap ?? {})
  const [error, setError] = useState<string | null>(null)
  const hasExistingKey = Boolean(gateway?.keyRef)
  const submitDisabled = saving || name.trim().length === 0 || baseUrl.trim().length === 0
  const keyHint = useMemo(() => (hasExistingKey ? `使用 ${gateway?.keyRef}` : '新密钥将由密钥保险库存储'), [gateway?.keyRef, hasExistingKey])

  function updateModel(channel: keyof GatewayModelMap, value: string): void {
    setModelMap((current) => ({ ...current, [channel]: value }))
  }

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (submitDisabled) {
      setError('名称和基础 URL 为必填项。')
      return
    }

    const auth =
      secret.trim().length > 0
        ? ({ mode: 'apiKey', secret: secret.trim() } as const)
        : hasExistingKey && gateway
          ? ({ mode: 'existingRef', keyRef: gateway.keyRef } as const)
          : ({ mode: 'none' } as const)

    setError(null)
    void onSubmit({
      ...(gateway ? { id: gateway.id } : {}),
      name: name.trim(),
      type,
      baseUrl: baseUrl.trim(),
      auth,
      capabilities,
      modelMap: compactModelMap(modelMap, capabilities),
      enabled
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold leading-tight text-text-base">{gateway ? '编辑网关' : '添加网关'}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">配置供应商 URL、密钥引用、能力和模型路由。</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-input bg-bg-input text-text-secondary transition hover:border-border-primary hover:text-text-base"
          aria-label="取消网关编辑"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
        网关名称
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
        网关类型
        <select
          value={type}
          onChange={(event) => setType(event.target.value as GatewayType)}
          className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
        >
          {gatewayTypes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
        基础 URL
        <span className="relative">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            className="min-h-10 w-full rounded-lg border border-border-input bg-bg-input py-2 pl-9 pr-3 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          />
        </span>
      </label>

      <div className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
        <label htmlFor="gateway-api-key">API key</label>
        <span className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            id="gateway-api-key"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={hasExistingKey ? '留空则保留当前密钥' : '本地桩网关可选'}
            className="min-h-10 w-full rounded-lg border border-border-input bg-bg-input py-2 pl-9 pr-3 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          />
        </span>
        <span className="text-[12px] font-normal text-text-muted">{keyHint}</span>
      </div>

      <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-[var(--cc-accent-gold)]" />
        已启用
      </label>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border-secondary bg-bg-input/60 p-3">
        <legend className="px-1 text-[12px] font-semibold text-text-secondary">能力与模型映射</legend>
        {channelCapabilities.map((item) => {
          const checked = capabilities.includes(item.capability)

          return (
            <div key={item.channel} className="grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
              <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setCapabilities((current) => nextCapabilities(current, item.capability, event.target.checked))}
                  className="h-4 w-4 accent-[var(--cc-accent-gold)]"
                />
                {item.label}
              </label>
              <input
                aria-label={item.inputLabel}
                value={modelValue(modelMap, item.channel)}
                onChange={(event) => updateModel(item.channel, event.target.value)}
                disabled={!checked}
                className="min-h-9 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none transition focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )
        })}
      </fieldset>

      {error && <p className="text-[13px] text-semantic-negative">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-base transition hover:border-border-primary"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitDisabled}
          className={cn(
            'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60'
          )}
        >
          <Save className="h-4 w-4" />
          保存网关
        </button>
      </div>
    </form>
  )
}
