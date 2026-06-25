/**
 * 存储设置表单 — 设置页"存储"选项卡
 * 管理 S3 兼容存储的配置（endpoint / bucket / 凭证 / 连接测试）。
 * @see docs/api-contracts/storage-config.md
 */
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Save, TestTube, XCircle } from 'lucide-react'
import type { StorageConfigInput, StorageConnectionTestResult } from '../../../../../shared/ipc'
import { cn } from '../lib/cn'

/** Provider 预设选项 */
interface ProviderPreset {
  id: string
  label: string
  endpoint: string
  region: string
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 's3', label: 'S3 通用', endpoint: '', region: '' },
  { id: 'r2', label: 'Cloudflare R2', endpoint: 'https://<account>.r2.cloudflarestorage.com', region: 'auto' },
  { id: 'cos', label: '腾讯云 COS', endpoint: 'https://cos.<region>.myqcloud.com', region: '' },
  { id: 'oss', label: '阿里云 OSS', endpoint: 'https://oss-<region>.aliyuncs.com', region: '' }
]

type TestState = 'idle' | 'testing' | 'ok' | 'error'

/**
 * 创建空白存储配置表单数据。
 * @returns 默认空 StorageConfigInput。
 */
function createEmptyForm(): StorageConfigInput {
  return {
    provider: 's3',
    endpoint: '',
    region: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    publicUrlPrefix: ''
  }
}

export default function StorageSettingsForm(): JSX.Element {
  const [form, setForm] = useState<StorageConfigInput>(createEmptyForm)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  /** 加载已有配置 */
  useEffect(() => {
    window.comicCanvas
      .getStorageConfig()
      .then((config) => {
        if (config) {
          setForm(config)
        }
      })
      .catch(() => {
        // 首次启动尚无配置，保持空表单
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  /** 更新表单字段 */
  const setField = useCallback(<K extends keyof StorageConfigInput>(key: K, value: StorageConfigInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    // 字段变动后清除保存成功提示
    setSaved(false)
  }, [])

  /** 应用 Provider 预设 */
  const applyPreset = useCallback((preset: ProviderPreset) => {
    setForm((prev) => {
      const next: StorageConfigInput = { ...prev, provider: preset.id }
      // 仅在有值时覆盖，避免空字符串覆盖已有值
      if (preset.endpoint) next.endpoint = preset.endpoint
      if (preset.region) next.region = preset.region
      return next
    })
    setSaved(false)
  }, [])

  /** 测试连接 */
  const handleTestConnection = useCallback(async () => {
    setTestState('testing')
    setTestError('')
    try {
      const result: StorageConnectionTestResult = await window.comicCanvas.testStorageConnection(form)
      if (result.ok) {
        setTestState('ok')
      } else {
        setTestState('error')
        // 显示 provider 返回的错误信息
        setTestError(result.error ?? '连接失败')
      }
    } catch (err: unknown) {
      setTestState('error')
      // 捕获 IPC 调用异常
      setTestError(err instanceof Error ? err.message : '未知错误')
    }
  }, [form])

  /** 保存配置 */
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await window.comicCanvas.saveStorageConfig(form)
      setSaved(true)
    } catch {
      // 保存失败时不弹错误，后续可集成 toast
    } finally {
      setSaving(false)
    }
  }, [form])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-text-secondary" size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Provider 选择 */}
      <div>
        <label className="block text-sm font-medium text-text-base mb-2">存储类型</label>
        <div className="flex flex-wrap gap-2">
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors duration-200 border',
                form.provider === preset.id
                  ? 'bg-bg-card border-border-primary text-text-base'
                  : 'border-border-secondary text-text-secondary hover:text-text-base hover:border-border-primary'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoint */}
      <div>
        <label className="block text-sm font-medium text-text-base mb-1">Endpoint URL</label>
        <input
          type="text"
          value={form.endpoint}
          onChange={(e) => setField('endpoint', e.target.value)}
          placeholder="https://s3.amazonaws.com"
          className="w-full px-3 py-2 rounded-md bg-bg-input border border-border-secondary text-text-base text-sm placeholder:text-text-secondary focus:outline-none focus:border-border-primary"
        />
      </div>

      {/* Region */}
      <div>
        <label className="block text-sm font-medium text-text-base mb-1">Region</label>
        <input
          type="text"
          value={form.region ?? ''}
          onChange={(e) => setField('region', e.target.value)}
          placeholder={form.provider === 'r2' ? 'auto' : 'us-east-1'}
          className="w-full px-3 py-2 rounded-md bg-bg-input border border-border-secondary text-text-base text-sm placeholder:text-text-secondary focus:outline-none focus:border-border-primary"
        />
      </div>

      {/* Bucket */}
      <div>
        <label className="block text-sm font-medium text-text-base mb-1">Bucket 名称</label>
        <input
          type="text"
          value={form.bucket}
          onChange={(e) => setField('bucket', e.target.value)}
          placeholder="my-bucket"
          className="w-full px-3 py-2 rounded-md bg-bg-input border border-border-secondary text-text-base text-sm placeholder:text-text-secondary focus:outline-none focus:border-border-primary"
        />
      </div>

      {/* Access Key ID */}
      <div>
        <label className="block text-sm font-medium text-text-base mb-1">Access Key ID</label>
        <input
          type="text"
          value={form.accessKeyId}
          onChange={(e) => setField('accessKeyId', e.target.value)}
          placeholder="AKIA..."
          className="w-full px-3 py-2 rounded-md bg-bg-input border border-border-secondary text-text-base text-sm placeholder:text-text-secondary focus:outline-none focus:border-border-primary"
        />
      </div>

      {/* Secret Access Key */}
      <div>
        <label className="block text-sm font-medium text-text-base mb-1">Secret Access Key</label>
        <input
          type="password"
          value={form.secretAccessKey}
          onChange={(e) => setField('secretAccessKey', e.target.value)}
          placeholder="••••••••••••"
          className="w-full px-3 py-2 rounded-md bg-bg-input border border-border-secondary text-text-base text-sm placeholder:text-text-secondary focus:outline-none focus:border-border-primary"
        />
      </div>

      {/* Public URL Prefix (optional) */}
      <div>
        <label className="block text-sm font-medium text-text-base mb-1">
          公开 URL 前缀
          <span className="text-text-secondary font-normal ml-1">（可选）</span>
        </label>
        <input
          type="text"
          value={form.publicUrlPrefix ?? ''}
          onChange={(e) => setField('publicUrlPrefix', e.target.value)}
          placeholder="https://cdn.example.com"
          className="w-full px-3 py-2 rounded-md bg-bg-input border border-border-secondary text-text-base text-sm placeholder:text-text-secondary focus:outline-none focus:border-border-primary"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testState === 'testing'}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 border',
            testState === 'testing'
              ? 'opacity-60 cursor-not-allowed border-border-secondary text-text-secondary'
              : 'border-border-primary text-text-base hover:bg-bg-hover'
          )}
        >
          {testState === 'testing' ? <Loader2 className="animate-spin" size={16} /> : <TestTube size={16} />}
          测试连接
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200',
            'bg-bg-card border border-border-primary text-text-base hover:bg-bg-hover',
            saving && 'opacity-60 cursor-not-allowed'
          )}
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          保存配置
        </button>

        {/* 状态反馈 */}
        {testState === 'ok' && (
          <span className="flex items-center gap-1 text-sm text-green-400">
            <CheckCircle2 size={16} />
            连接成功
          </span>
        )}
        {testState === 'error' && (
          <span className="flex items-center gap-1 text-sm text-red-400" title={testError}>
            <XCircle size={16} />
            {testError || '连接失败'}
          </span>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-400">
            <CheckCircle2 size={16} />
            已保存
          </span>
        )}
      </div>
    </div>
  )
}
