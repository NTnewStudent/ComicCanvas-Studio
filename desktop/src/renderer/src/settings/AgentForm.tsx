import { useMemo, useState, type FormEvent } from 'react'
import { Bot, BrainCircuit, Save, ShieldCheck, Wrench, X } from 'lucide-react'

import type { AgentContextPolicy, AgentDefinition, AgentEffort, AgentGatewayPolicy, AgentPermissionPolicy, AgentTriggerKind, AgentTriggerPolicy } from '../../../../../shared/agents'
import type { ToolPermissionKind } from '../../../../../shared/tools'
import { cn } from '../lib/cn'

export interface AgentFormProps {
  agent?: AgentDefinition | undefined
  onSubmit: (input: AgentDefinition) => Promise<void> | void
  onCancel: () => void
  saving?: boolean
}

const toolOptions = [
  { id: 'canvas.queryGraph', label: 'canvas.queryGraph', description: '读取当前画布图。' },
  { id: 'canvas.proposePlan', label: 'canvas.proposePlan', description: '起草声明式画布计划。' },
  { id: 'canvas.createNode', label: 'canvas.createNode', description: '创建文本、图片或视频节点。' },
  { id: 'canvas.connectNodes', label: 'canvas.connectNodes', description: '连接兼容的画布节点。' },
  { id: 'canvas.updateNodeData', label: 'canvas.updateNodeData', description: '更新节点配置。' },
  { id: 'canvas.deleteNode', label: 'canvas.deleteNode', description: '删除画布节点。' },
  { id: 'canvas.runNode', label: 'canvas.runNode', description: '排队节点生成任务。' }
] as const

const permissionOptions: Array<{ value: ToolPermissionKind; label: string }> = [
  { value: 'canvas.read', label: '画布读取' },
  { value: 'canvas.write', label: '画布写入' },
  { value: 'file.read', label: '文件读取' },
  { value: 'network', label: '网络访问' },
  { value: 'provider.spend', label: '供应商消费' },
  { value: 'diagnostics', label: '诊断' },
  { value: 'destructive', label: '破坏性操作' }
]

const channelOptions: AgentGatewayPolicy['allowedChannels'] = ['text', 'image', 'video']
const triggerOptions: Array<{ value: AgentTriggerKind; label: string }> = [
  { value: 'manual', label: '手动运行' },
  { value: 'mention', label: '@提及' },
  { value: 'canvasChat', label: '画布对话' },
  { value: 'workflowEvent', label: '工作流事件' }
]

function slugAgentId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')

  return `agent-${slug || 'custom'}`
}

function initialTools(agent?: AgentDefinition): string[] {
  if (!agent || agent.allowedTools === '*') {
    return []
  }

  return agent.allowedTools
}

function initialSkills(agent?: AgentDefinition): string {
  if (!agent) {
    return ''
  }

  return agent.allowedSkills === '*' ? '*' : agent.allowedSkills.join(', ')
}

function parseSkills(value: string): string[] | '*' {
  const trimmed = value.trim()

  if (trimmed === '*') {
    return '*'
  }

  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function toggleItem(current: string[], item: string, checked: boolean): string[] {
  if (checked) {
    return current.includes(item) ? current : [...current, item]
  }

  return current.filter((value) => value !== item)
}

function defaultContextPolicy(agent?: AgentDefinition): AgentContextPolicy {
  return (
    agent?.contextPolicy ?? {
      includeCanvasGraph: true,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 4000
    }
  )
}

function defaultPermissionPolicy(agent?: AgentDefinition): AgentPermissionPolicy {
  return agent?.permissionPolicy ?? { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true }
}

function defaultTriggerPolicy(agent?: AgentDefinition): AgentTriggerPolicy {
  return agent?.triggerPolicy ?? { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false }
}

/**
 * Renders the custom agent create/edit form.
 * @param props - Existing agent, submit handler, cancel handler, and saving flag.
 * @returns Agent settings form.
 * @throws Error never intentionally; validation errors are represented through form state.
 * @see docs/api-contracts/agents.md
 */
export function AgentForm({ agent, onSubmit, onCancel, saving = false }: AgentFormProps): JSX.Element {
  const [name, setName] = useState(agent?.name ?? '')
  const [description, setDescription] = useState(agent?.description ?? '')
  const [instructions, setInstructions] = useState(agent?.instructions ?? '')
  const [allowAllTools, setAllowAllTools] = useState(agent?.allowedTools === '*')
  const [selectedTools, setSelectedTools] = useState<string[]>(initialTools(agent))
  const [allowedSkills, setAllowedSkills] = useState(initialSkills(agent))
  const [modelId, setModelId] = useState(agent?.gatewayPolicy.modelId ?? '')
  const [allowedChannels, setAllowedChannels] = useState<AgentGatewayPolicy['allowedChannels']>(agent?.gatewayPolicy.allowedChannels ?? ['text'])
  const [contextPolicy, setContextPolicy] = useState<AgentContextPolicy>(defaultContextPolicy(agent))
  const [permissionPolicy, setPermissionPolicy] = useState<AgentPermissionPolicy>(defaultPermissionPolicy(agent))
  const [triggerPolicy, setTriggerPolicy] = useState<AgentTriggerPolicy>(defaultTriggerPolicy(agent))
  const [maxTurns, setMaxTurns] = useState(agent?.maxTurns ?? 6)
  const [effort, setEffort] = useState<AgentEffort>(agent?.effort ?? 'medium')
  const [enabled, setEnabled] = useState(agent?.enabled ?? true)
  const [error, setError] = useState<string | null>(null)
  const generatedId = useMemo(() => agent?.id ?? slugAgentId(name), [agent?.id, name])

  function updateContextPolicy(key: keyof AgentContextPolicy, value: boolean | number): void {
    setContextPolicy((current) => ({ ...current, [key]: value }))
  }

  function updatePermissionKind(kind: ToolPermissionKind, checked: boolean): void {
    setPermissionPolicy((current) => ({
      ...current,
      allowedPermissionKinds: toggleItem(current.allowedPermissionKinds, kind, checked) as ToolPermissionKind[]
    }))
  }

  function updateTriggerKind(kind: AgentTriggerKind, checked: boolean): void {
    setTriggerPolicy((current) => {
      const allowedTriggers = toggleItem(current.allowedTriggers, kind, checked) as AgentTriggerKind[]
      const defaultTrigger = allowedTriggers.includes(current.defaultTrigger) ? current.defaultTrigger : (allowedTriggers[0] ?? 'manual')

      return { ...current, allowedTriggers, defaultTrigger }
    })
  }

  function submitForm(): void {
    if (name.trim().length === 0 || instructions.trim().length === 0) {
      setError('名称和指令为必填项。')
      return
    }

    if (triggerPolicy.allowedTriggers.length === 0) {
      setError('至少选择一个调用时机。')
      return
    }

    const safeMaxTurns = Math.max(1, Math.trunc(maxTurns))
    const gatewayPolicy: AgentGatewayPolicy = {
      allowedChannels: allowedChannels.length > 0 ? allowedChannels : ['text'],
      ...(modelId.trim().length > 0 ? { modelId: modelId.trim() } : {})
    }

    setError(null)
    void onSubmit({
      id: generatedId,
      source: agent?.source ?? 'user',
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      allowedTools: allowAllTools ? '*' : selectedTools,
      allowedSkills: parseSkills(allowedSkills),
      gatewayPolicy,
      contextPolicy: {
        ...contextPolicy,
        maxContextTokens: Math.max(512, Math.trunc(contextPolicy.maxContextTokens))
      },
      permissionPolicy,
      triggerPolicy,
      maxTurns: safeMaxTurns,
      effort,
      enabled
    })
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    submitForm()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold leading-tight text-text-base">{agent ? '编辑 Agent' : '添加 Agent'}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">为用户 Agent 定义指令、工具访问、上下文范围和模型路由。</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-input bg-bg-input text-text-secondary transition hover:border-border-primary hover:text-text-base"
          aria-label="取消 Agent 编辑"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          Agent 名称
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          Agent ID
          <input
            value={generatedId}
            readOnly
            className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 font-mono text-[13px] text-text-secondary outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
        描述
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
        指令
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={5}
          className="min-h-28 resize-y rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] leading-relaxed text-text-base outline-none focus:ring-1 focus:ring-brand"
        />
      </label>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border-secondary bg-bg-input/60 p-3">
        <legend className="px-1 text-[12px] font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-brand" />
            工具访问
          </span>
        </legend>
        <label className="inline-flex items-center gap-2 rounded-lg border border-border-input bg-bg-card px-3 py-2 text-[13px] font-medium text-text-secondary">
          <input
            type="checkbox"
            aria-label="允许所有工具"
            checked={allowAllTools}
            onChange={(event) => setAllowAllTools(event.target.checked)}
            className="h-4 w-4 accent-[var(--cc-accent-gold)]"
          />
          允许所有工具
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          {toolOptions.map((tool) => (
            <label key={tool.id} className={cn('flex items-start gap-2 rounded-lg border border-border-input bg-bg-card px-3 py-2 text-[13px] text-text-secondary', allowAllTools && 'opacity-55')}>
              <input
                type="checkbox"
                aria-label={tool.label}
                disabled={allowAllTools}
                checked={selectedTools.includes(tool.id)}
                onChange={(event) => setSelectedTools((current) => toggleItem(current, tool.id, event.target.checked))}
                className="mt-0.5 h-4 w-4 accent-[var(--cc-accent-gold)]"
              />
              <span>
                <span className="block font-mono text-[12px] text-text-base">{tool.label}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-text-muted">{tool.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
        允许的技能
        <input
          value={allowedSkills}
          onChange={(event) => setAllowedSkills(event.target.value)}
          placeholder="storyboard, shot-list"
          className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
        />
      </label>

      <fieldset className="grid gap-3 rounded-lg border border-border-secondary bg-bg-input/60 p-3 md:grid-cols-2">
        <legend className="px-1 text-[12px] font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-brand" />
            模型与运行策略
          </span>
        </legend>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          模型 ID
          <input
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            placeholder="使用网关默认值"
            className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          力度
          <select
            value={effort}
            onChange={(event) => setEffort(event.target.value as AgentEffort)}
            className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          最大轮次
          <input
            type="number"
            min={1}
            max={32}
            value={maxTurns}
            onChange={(event) => setMaxTurns(Number(event.target.value))}
            className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          />
        </label>
        <div className="flex flex-col gap-2 text-[12px] font-medium text-text-muted">
          渠道
          <div className="flex flex-wrap gap-2">
            {channelOptions.map((channel) => (
              <label key={channel} className="inline-flex items-center gap-2 rounded-pill border border-border-input bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={allowedChannels.includes(channel)}
                  onChange={(event) => setAllowedChannels((current) => toggleItem(current, channel, event.target.checked) as AgentGatewayPolicy['allowedChannels'])}
                  className="h-4 w-4 accent-[var(--cc-accent-gold)]"
                />
                {channel}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-border-secondary bg-bg-input/60 p-3 md:grid-cols-2">
        <legend className="px-1 text-[12px] font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-brand" />
            调用时机
          </span>
        </legend>
        <div className="flex flex-col gap-2 text-[12px] font-medium text-text-muted">
          可触发入口
          <div className="flex flex-wrap gap-2">
            {triggerOptions.map((trigger) => (
              <label key={trigger.value} className="inline-flex items-center gap-2 rounded-pill border border-border-input bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={triggerPolicy.allowedTriggers.includes(trigger.value)}
                  onChange={(event) => updateTriggerKind(trigger.value, event.target.checked)}
                  className="h-4 w-4 accent-[var(--cc-accent-gold)]"
                />
                {trigger.label}
              </label>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          默认入口
          <select
            value={triggerPolicy.defaultTrigger}
            onChange={(event) => setTriggerPolicy((current) => ({ ...current, defaultTrigger: event.target.value as AgentTriggerKind }))}
            className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          >
            {triggerPolicy.allowedTriggers.map((trigger) => (
              <option key={trigger} value={trigger}>{trigger}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary md:col-span-2">
          <input
            type="checkbox"
            checked={triggerPolicy.autoRun}
            onChange={(event) => setTriggerPolicy((current) => ({ ...current, autoRun: event.target.checked }))}
            className="h-4 w-4 accent-[var(--cc-accent-gold)]"
          />
          触发后自动运行
        </label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-border-secondary bg-bg-input/60 p-3 md:grid-cols-2">
        <legend className="px-1 text-[12px] font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <BrainCircuit className="h-3.5 w-3.5 text-brand" />
            上下文策略
          </span>
        </legend>
        {(
          [
            ['includeCanvasGraph', '画布图'],
            ['includeSelectedAssets', '已选资产'],
            ['includeRecentMessages', '最近消息'],
            ['includeKnowledge', '知识上下文']
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
            <input
              type="checkbox"
              checked={Boolean(contextPolicy[key])}
              onChange={(event) => updateContextPolicy(key, event.target.checked)}
              className="h-4 w-4 accent-[var(--cc-accent-gold)]"
            />
            {label}
          </label>
        ))}
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted md:col-span-2">
          最大上下文 Token 数
          <input
            type="number"
            min={512}
            step={256}
            value={contextPolicy.maxContextTokens}
            onChange={(event) => updateContextPolicy('maxContextTokens', Number(event.target.value))}
            className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border-secondary bg-bg-input/60 p-3">
        <legend className="px-1 text-[12px] font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            权限策略
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {permissionOptions.map((permission) => (
            <label key={permission.value} className="inline-flex items-center gap-2 rounded-pill border border-border-input bg-bg-card px-3 py-1.5 text-[13px] text-text-secondary">
              <input
                type="checkbox"
                checked={permissionPolicy.allowedPermissionKinds.includes(permission.value)}
                onChange={(event) => updatePermissionKind(permission.value, event.target.checked)}
                className="h-4 w-4 accent-[var(--cc-accent-gold)]"
              />
              {permission.label}
            </label>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
          <input
            type="checkbox"
            checked={permissionPolicy.requireAskForDestructive}
            onChange={(event) => setPermissionPolicy((current) => ({ ...current, requireAskForDestructive: event.target.checked }))}
            className="h-4 w-4 accent-[var(--cc-accent-gold)]"
          />
          破坏性操作前需确认
        </label>
      </fieldset>

      <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-[var(--cc-accent-gold)]" />
        已启用
      </label>

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
          type="button"
          onClick={submitForm}
          disabled={saving}
          className={cn(
            'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60'
          )}
        >
          <Save className="h-4 w-4" />
          保存 Agent
        </button>
      </div>
    </form>
  )
}
