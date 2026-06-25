import { useMemo, useState, type FormEvent } from 'react'
import { Bot, BrainCircuit, Save, ShieldCheck, Wrench, X } from 'lucide-react'

import type { AgentContextPolicy, AgentDefinition, AgentEffort, AgentGatewayPolicy, AgentPermissionPolicy } from '../../../../../shared/agents'
import type { ToolPermissionKind } from '../../../../../shared/tools'
import { cn } from '../lib/cn'

export interface AgentFormProps {
  agent?: AgentDefinition | undefined
  onSubmit: (input: AgentDefinition) => Promise<void> | void
  onCancel: () => void
  saving?: boolean
}

const toolOptions = [
  { id: 'canvas.queryGraph', label: 'canvas.queryGraph', description: 'Read the current canvas graph.' },
  { id: 'canvas.proposePlan', label: 'canvas.proposePlan', description: 'Draft declarative canvas plans.' },
  { id: 'canvas.createNode', label: 'canvas.createNode', description: 'Create text, image, or video nodes.' },
  { id: 'canvas.connectNodes', label: 'canvas.connectNodes', description: 'Connect compatible canvas nodes.' },
  { id: 'canvas.updateNodeData', label: 'canvas.updateNodeData', description: 'Update node configuration.' },
  { id: 'canvas.deleteNode', label: 'canvas.deleteNode', description: 'Remove canvas nodes.' },
  { id: 'canvas.runNode', label: 'canvas.runNode', description: 'Queue generation for a node.' }
] as const

const permissionOptions: Array<{ value: ToolPermissionKind; label: string }> = [
  { value: 'canvas.read', label: 'Canvas read' },
  { value: 'canvas.write', label: 'Canvas write' },
  { value: 'provider.spend', label: 'Provider spend' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'destructive', label: 'Destructive' }
]

const channelOptions: AgentGatewayPolicy['allowedChannels'] = ['text', 'image', 'video']

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
  const [selectedTools, setSelectedTools] = useState<string[]>(initialTools(agent))
  const [allowedSkills, setAllowedSkills] = useState(initialSkills(agent))
  const [modelId, setModelId] = useState(agent?.gatewayPolicy.modelId ?? '')
  const [allowedChannels, setAllowedChannels] = useState<AgentGatewayPolicy['allowedChannels']>(agent?.gatewayPolicy.allowedChannels ?? ['text'])
  const [contextPolicy, setContextPolicy] = useState<AgentContextPolicy>(defaultContextPolicy(agent))
  const [permissionPolicy, setPermissionPolicy] = useState<AgentPermissionPolicy>(defaultPermissionPolicy(agent))
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

  function submitForm(): void {
    if (name.trim().length === 0 || instructions.trim().length === 0) {
      setError('Name and instructions are required.')
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
      source: 'user',
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      allowedTools: selectedTools,
      allowedSkills: parseSkills(allowedSkills),
      gatewayPolicy,
      contextPolicy: {
        ...contextPolicy,
        maxContextTokens: Math.max(512, Math.trunc(contextPolicy.maxContextTokens))
      },
      permissionPolicy,
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
          <h2 className="text-[18px] font-semibold leading-tight text-text-base">{agent ? 'Edit agent' : 'Add agent'}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">Define instructions, tool access, context scope, and model routing for a user agent.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-input bg-bg-input text-text-secondary transition hover:border-border-primary hover:text-text-base"
          aria-label="Cancel agent edit"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          Agent name
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
        Description
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
        Instructions
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
            Tool access
          </span>
        </legend>
        <div className="grid gap-2 md:grid-cols-2">
          {toolOptions.map((tool) => (
            <label key={tool.id} className="flex items-start gap-2 rounded-lg border border-border-input bg-bg-card px-3 py-2 text-[13px] text-text-secondary">
              <input
                type="checkbox"
                aria-label={tool.label}
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
        Allowed skills
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
            Model and run policy
          </span>
        </legend>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          Model ID
          <input
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            placeholder="Use gateway default"
            className="min-h-10 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          Effort
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
          Max turns
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
          Channels
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
            <BrainCircuit className="h-3.5 w-3.5 text-brand" />
            Context policy
          </span>
        </legend>
        {(
          [
            ['includeCanvasGraph', 'Canvas graph'],
            ['includeSelectedAssets', 'Selected assets'],
            ['includeRecentMessages', 'Recent messages'],
            ['includeKnowledge', 'Knowledge context']
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
          Max context tokens
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
            Permission policy
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
          Ask before destructive actions
        </label>
      </fieldset>

      <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-[var(--cc-accent-gold)]" />
        Enabled
      </label>

      {error && <p className="text-[13px] text-semantic-negative">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-base transition hover:border-border-primary"
        >
          Cancel
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
          Save agent
        </button>
      </div>
    </form>
  )
}
