import { useMemo, useState } from 'react'
import { DownloadCloud, KeyRound, LinkIcon, Save, X } from 'lucide-react'

import type { GatewayCapability, GatewayConfigInput, GatewayConfigView, GatewayFetchedModel, GatewayFetchModelsRequest, GatewayFetchModelsResponse, GatewayModelMap, GatewayType } from '../../../../../shared/gateway'
import { cn } from '../lib/cn'

export interface GatewayFormProps {
  gateway?: GatewayConfigView | undefined
  onSubmit: (input: GatewayConfigInput) => Promise<void> | void
  onCancel: () => void
  fetchModels?: (input: GatewayFetchModelsRequest) => Promise<GatewayFetchModelsResponse>
  saving?: boolean
}

const gatewayTypes: Array<{ value: GatewayType; label: string }> = [
  { value: 'openai_compat', label: 'OpenAI 兼容' },
  { value: 'async_media_task', label: '异步媒体任务' },
  { value: 'stub', label: '桩供应商' }
]

const channelCapabilities: Array<{ channel: keyof GatewayModelMap; capability: GatewayCapability; label: string; inputLabel: string; dropLabel: string }> = [
  { channel: 'text', capability: 'text', label: '文本能力', inputLabel: '文本模型键', dropLabel: '文本' },
  { channel: 'image', capability: 'image', label: '图片能力', inputLabel: '图片模型键', dropLabel: '图片' },
  { channel: 'video', capability: 'video', label: '视频能力', inputLabel: '视频模型键', dropLabel: '视频' }
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

function uniqueModels(models: GatewayFetchedModel[]): GatewayFetchedModel[] {
  const unique = new Map<string, GatewayFetchedModel>()
  for (const model of models) {
    unique.set(model.id, model)
  }

  return Array.from(unique.values()).sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * Renders the gateway configuration form for create and edit flows.
 * @param props - Existing gateway, submit handler, cancel handler, and saving flag.
 * @returns Gateway settings form.
 * @throws Error never intentionally; validation errors are represented through form state.
 * @see docs/api-contracts/gateway-providers.md
 */
export function GatewayForm({ gateway, onSubmit, onCancel, fetchModels, saving = false }: GatewayFormProps): JSX.Element {
  const [name, setName] = useState(gateway?.name ?? '')
  const [type, setType] = useState<GatewayType>(gateway?.type ?? 'openai_compat')
  const [baseUrl, setBaseUrl] = useState(gateway?.baseUrl ?? '')
  const [secret, setSecret] = useState('')
  const [enabled, setEnabled] = useState(gateway?.enabled ?? true)
  const [capabilities, setCapabilities] = useState<GatewayCapability[]>(defaultCapabilities(gateway))
  const [modelMap, setModelMap] = useState<GatewayModelMap>(gateway?.modelMap ?? {})
  const [fetchedModels, setFetchedModels] = useState<GatewayFetchedModel[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelMessage, setModelMessage] = useState<string | null>(null)
  const hasExistingKey = Boolean(gateway?.keyRef)
  const submitDisabled = saving || name.trim().length === 0 || baseUrl.trim().length === 0
  const keyHint = useMemo(() => (hasExistingKey ? `使用 ${gateway?.keyRef}` : '新密钥将由密钥保险库存储'), [gateway?.keyRef, hasExistingKey])

  function updateModel(channel: keyof GatewayModelMap, value: string): void {
    setModelMap((current) => ({ ...current, [channel]: value }))
  }

  function assignModel(channel: keyof GatewayModelMap, modelId: string): void {
    const item = channelCapabilities.find((candidate) => candidate.channel === channel)
    if (item) {
      setCapabilities((current) => nextCapabilities(current, item.capability, true))
    }
    updateModel(channel, modelId)
  }

  async function loadRemoteModels(): Promise<void> {
    if (!fetchModels) {
      setModelMessage('当前环境未提供模型获取能力。')
      return
    }

    if (baseUrl.trim().length === 0) {
      setModelMessage('请先填写基础 URL。')
      return
    }

    setFetchingModels(true)
    setModelMessage(null)
    try {
      const auth = secret.trim().length > 0
        ? ({ mode: 'apiKey', secret: secret.trim() } as const)
        : gateway
          ? ({ mode: 'existingRef', keyRef: gateway.keyRef } as const)
          : ({ mode: 'none' } as const)
      const result = await fetchModels({
        ...(gateway ? { gatewayId: gateway.id } : {}),
        baseUrl: baseUrl.trim(),
        auth
      })
      setFetchedModels(uniqueModels(result.models))
      setModelMessage(result.models.length > 0 ? `已获取 ${result.models.length} 个模型，拖到下方分类即可。` : '没有获取到模型。')
    } catch {
      setModelMessage('模型列表获取失败，请检查 URL、Key 或网关兼容性。')
    } finally {
      setFetchingModels(false)
    }
  }

  function dropModel(event: React.DragEvent<HTMLElement>, channel: keyof GatewayModelMap): void {
    event.preventDefault()
    const modelId = event.dataTransfer.getData('text/plain')
    if (modelId.length > 0) {
      assignModel(channel, modelId)
    }
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

      <section className="flex flex-col gap-3 rounded-lg border border-border-secondary bg-bg-input/60 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-[12px] font-semibold text-text-secondary">OpenAI 模型列表</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-text-muted">从兼容 `/models` 接口获取模型，然后拖拽到文本、图片、视频分类。</p>
          </div>
          <button
            type="button"
            onClick={() => void loadRemoteModels()}
            disabled={fetchingModels || baseUrl.trim().length === 0}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-card px-3 py-2 text-[13px] font-medium text-text-base transition hover:border-border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DownloadCloud className="h-4 w-4 text-brand" />
            {fetchingModels ? '获取中...' : '获取模型列表'}
          </button>
        </div>

        <div className="min-h-20 rounded-lg border border-dashed border-border-input bg-bg-card/70 p-2">
          {fetchedModels.length === 0 ? (
            <p className="px-2 py-4 text-[12px] text-text-muted">模型池为空。填写 URL 和 API key 后点击获取。</p>
          ) : (
            <div className="flex max-h-36 flex-wrap gap-2 overflow-auto">
              {fetchedModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', model.id)}
                  onClick={() => setModelMessage(`拖拽 ${model.id} 到文本、图片或视频分类。`)}
                  className="cursor-grab rounded-pill border border-border-input bg-bg-input px-2 py-1 text-left font-mono text-[12px] text-text-secondary transition hover:border-brand hover:text-text-base active:cursor-grabbing"
                  aria-label={`模型 ${model.id}`}
                >
                  {model.id}
                </button>
              ))}
            </div>
          )}
        </div>
        {modelMessage && <p className="text-[12px] text-text-muted">{modelMessage}</p>}
      </section>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border-secondary bg-bg-input/60 p-3">
        <legend className="px-1 text-[12px] font-semibold text-text-secondary">能力与模型映射</legend>
        {channelCapabilities.map((item) => {
          const checked = capabilities.includes(item.capability)
          const assignedModel = modelValue(modelMap, item.channel)

          return (
            <div
              key={item.channel}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropModel(event, item.channel)}
              className="grid gap-2 rounded-lg border border-transparent p-2 transition hover:border-border-input md:grid-cols-[180px_1fr] md:items-center"
            >
              <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setCapabilities((current) => nextCapabilities(current, item.capability, event.target.checked))}
                  className="h-4 w-4 accent-[var(--cc-accent-gold)]"
                />
                {item.label}
              </label>
              <div className="flex flex-col gap-1.5">
                <div className={cn('rounded-lg border border-dashed px-3 py-2 text-[12px] transition', checked ? 'border-border-input bg-bg-card text-text-secondary' : 'border-border-input bg-bg-input text-text-muted opacity-70')}>
                  <span className="font-semibold">{item.dropLabel}分类：</span>
                  <span className="ml-1 font-mono">{assignedModel || '拖入模型或手动输入'}</span>
                </div>
                <input
                  aria-label={item.inputLabel}
                  value={assignedModel}
                  onChange={(event) => updateModel(item.channel, event.target.value)}
                  disabled={!checked}
                  className="min-h-9 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none transition focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
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
