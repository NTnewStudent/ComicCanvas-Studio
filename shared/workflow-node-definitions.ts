/**
 * Workflow node definitions shared by renderer menus, tools, and future Agents.
 * @see docs/api-contracts/canvas-plan.md
 */

import { NODE_CONNECTION_MATRIX } from './connection-matrix'
import type { GatewayCapability, GatewayChannel, GatewayConfigView } from './gateway'
import type { NodeType } from './nodes'
import type { RunAction } from './plan'

export type WorkflowNodeCapability =
  | 'prompt'
  | 'image'
  | 'video'
  | 'audio'
  | 'assetReference'
  | 'style'
  | 'compose'
  | 'enhance'
  | 'mux'
  | 'legacy'

export type WorkflowNodeCategory = 'Base' | 'Context' | 'AI Generation' | 'Post Tools' | 'Unavailable'

export interface WorkflowNodeDefinition {
  /** Shared node type. */
  type: NodeType
  /** User-visible label for menus and command surfaces. */
  label: string
  /** Group shown in add menus and command surfaces. */
  category: WorkflowNodeCategory
  /** Stable capabilities consumed by manual UI and future Agent tools. */
  capabilities: WorkflowNodeCapability[]
  /** Upstream node types accepted by this node. */
  allowedInputs: NodeType[]
  /** Downstream node types accepted from this node. */
  allowedOutputs: NodeType[]
  /** Whether this node can be manually added in local Phase A. */
  addable: boolean
  /** Whether this node can appear in connect-to-create menus. */
  connectCreate: boolean
  /** Whether this node has a local run action. */
  runnable: boolean
  /** CanvasPlan run action, when runnable. */
  runAction: RunAction | null
  /** Clear product-facing unavailable reason. */
  unavailableReason?: string
}

export interface WorkflowFeatureFlags {
  disabledNodeTypes?: readonly NodeType[]
}

export interface WorkflowNodeDefinitionFilter {
  featureFlags?: WorkflowFeatureFlags
}

export interface WorkflowModelOption {
  id: string
  label: string
  channel: GatewayChannel | 'tool'
  gatewayId: string
  gatewayName: string
  enabled: boolean
  capabilities: GatewayCapability[]
}

export interface WorkflowCapabilityFlags {
  text: boolean
  image: boolean
  video: boolean
  imageEdit: boolean
  videoFirstFrame: boolean
  videoLastFrame: boolean
  tools: boolean
}

export interface WorkflowModelCatalog {
  models: {
    text: WorkflowModelOption[]
    image: WorkflowModelOption[]
    video: WorkflowModelOption[]
    tool: WorkflowModelOption[]
  }
  availableModelIds: string[]
  capabilityFlags: WorkflowCapabilityFlags
}

type DefinitionSeed = Omit<WorkflowNodeDefinition, 'allowedInputs' | 'allowedOutputs'>

const PHASE_A_MJ_UNAVAILABLE_REASON = 'MJ node/component is out of scope for local Phase A.'

const DEFINITION_SEEDS: readonly DefinitionSeed[] = [
  {
    type: 'text',
    label: 'Text Node',
    category: 'Base',
    capabilities: ['prompt'],
    addable: true,
    connectCreate: true,
    runnable: true,
    runAction: 'textPolish',
  },
  {
    type: 'image',
    label: 'Image Node',
    category: 'Base',
    capabilities: ['image', 'assetReference'],
    addable: true,
    connectCreate: true,
    runnable: true,
    runAction: 'imageRun',
  },
  {
    type: 'video',
    label: 'Video Node',
    category: 'Base',
    capabilities: ['video', 'assetReference'],
    addable: true,
    connectCreate: true,
    runnable: true,
    runAction: 'videoRun',
  },
  {
    type: 'character',
    label: 'Character Node',
    category: 'Context',
    capabilities: ['prompt', 'image', 'assetReference'],
    addable: true,
    connectCreate: true,
    runnable: false,
    runAction: null,
  },
  {
    type: 'scene',
    label: 'Scene Node',
    category: 'Context',
    capabilities: ['prompt', 'image', 'assetReference'],
    addable: true,
    connectCreate: true,
    runnable: false,
    runAction: null,
  },
  {
    type: 'audio',
    label: 'Audio Node',
    category: 'Base',
    capabilities: ['audio', 'assetReference'],
    addable: true,
    connectCreate: true,
    runnable: false,
    runAction: null,
  },
  {
    type: 'imageConfigV2',
    label: 'Image V2',
    category: 'AI Generation',
    capabilities: ['prompt', 'image', 'style', 'assetReference'],
    addable: true,
    connectCreate: true,
    runnable: true,
    runAction: 'imageRun',
  },
  {
    type: 'videoConfigV2',
    label: 'Video V2',
    category: 'AI Generation',
    capabilities: ['prompt', 'video', 'style', 'assetReference'],
    addable: true,
    connectCreate: true,
    runnable: true,
    runAction: 'videoRun',
  },
  {
    type: 'videoCompose',
    label: 'Video Compose',
    category: 'Post Tools',
    capabilities: ['video', 'compose'],
    addable: true,
    connectCreate: true,
    runnable: true,
    runAction: 'videoComposeRun',
  },
  {
    type: 'superResolution',
    label: 'Super Resolution',
    category: 'Post Tools',
    capabilities: ['video', 'enhance'],
    addable: true,
    connectCreate: true,
    runnable: true,
    runAction: 'superResolutionRun',
  },
  {
    type: 'muxAudioVideo',
    label: 'Mux Audio Video',
    category: 'Post Tools',
    capabilities: ['video', 'audio', 'mux'],
    addable: true,
    connectCreate: true,
    runnable: true,
    runAction: 'muxAudioVideoRun',
  },
  {
    type: 'mjImage',
    label: 'MJ Image',
    category: 'Unavailable',
    capabilities: ['image', 'legacy'],
    addable: false,
    connectCreate: false,
    runnable: false,
    runAction: null,
    unavailableReason: PHASE_A_MJ_UNAVAILABLE_REASON,
  },
]

function inputsFor(type: NodeType): NodeType[] {
  return (Object.entries(NODE_CONNECTION_MATRIX) as Array<[NodeType, readonly NodeType[]]>)
    .filter(([, targets]) => targets.includes(type))
    .map(([source]) => source)
}

function hydrateDefinition(seed: DefinitionSeed): WorkflowNodeDefinition {
  return {
    ...seed,
    allowedInputs: inputsFor(seed.type),
    allowedOutputs: [...NODE_CONNECTION_MATRIX[seed.type]],
  }
}

const WORKFLOW_NODE_DEFINITIONS: readonly WorkflowNodeDefinition[] = DEFINITION_SEEDS.map(hydrateDefinition)

function disabledNodeTypes(filter: WorkflowNodeDefinitionFilter = {}): Set<NodeType> {
  return new Set(filter.featureFlags?.disabledNodeTypes ?? [])
}

function applyDefinitionFilter(definition: WorkflowNodeDefinition, disabled: Set<NodeType>): WorkflowNodeDefinition {
  if (!disabled.has(definition.type)) return definition
  return {
    ...definition,
    addable: false,
    connectCreate: false,
    runnable: false,
    unavailableReason: 'Disabled by feature flag.',
  }
}

function enabledDefinitions(filter: WorkflowNodeDefinitionFilter = {}): readonly WorkflowNodeDefinition[] {
  const disabled = disabledNodeTypes(filter)
  return WORKFLOW_NODE_DEFINITIONS.map((definition) => applyDefinitionFilter(definition, disabled))
}

function modelOption(config: GatewayConfigView, channel: GatewayChannel, modelId: string): WorkflowModelOption {
  return {
    id: modelId,
    label: `${config.name} · ${modelId}`,
    channel,
    gatewayId: config.id,
    gatewayName: config.name,
    enabled: config.enabled,
    capabilities: [...config.capabilities],
  }
}

function uniqueModelIds(models: WorkflowModelCatalog['models']): string[] {
  const ids = new Set<string>()
  for (const channelModels of [models.text, models.image, models.video]) {
    for (const model of channelModels) ids.add(model.id)
  }
  return [...ids]
}

function toolModelOptions(): WorkflowModelOption[] {
  return [
    { id: 'videoComposeRun', label: 'Video Compose Tool', channel: 'tool', gatewayId: 'local-tools', gatewayName: 'Local Tools', enabled: true, capabilities: [] },
    { id: 'muxAudioVideoRun', label: 'Mux Audio Video Tool', channel: 'tool', gatewayId: 'local-tools', gatewayName: 'Local Tools', enabled: true, capabilities: [] },
    { id: 'superResolutionRun', label: 'Super Resolution Tool', channel: 'tool', gatewayId: 'local-tools', gatewayName: 'Local Tools', enabled: true, capabilities: [] },
  ]
}

/**
 * Returns all known workflow node definitions, including unavailable legacy types.
 * @returns Immutable node definition list.
 */
export function getWorkflowNodeDefinitions(): readonly WorkflowNodeDefinition[] {
  return WORKFLOW_NODE_DEFINITIONS
}

/**
 * Returns node definitions after applying runtime feature flags.
 * @param filter - Optional feature flag filter.
 * @returns Node definitions with disabled types marked unavailable.
 */
export function filterWorkflowNodeDefinitions(filter: WorkflowNodeDefinitionFilter = {}): readonly WorkflowNodeDefinition[] {
  return enabledDefinitions(filter)
}

/**
 * Returns one node definition by type.
 * @param type - Shared node type.
 * @returns Node definition for the requested type.
 * @throws Error when a shared node type has no definition.
 */
export function getNodeDefinition(type: NodeType): WorkflowNodeDefinition {
  const definition = WORKFLOW_NODE_DEFINITIONS.find((candidate) => candidate.type === type)
  if (!definition) {
    throw new Error(`Workflow node definition missing for ${type}`)
  }
  return definition
}

/**
 * Returns node definitions that can be added manually in the local canvas.
 * @returns Addable node definitions in menu order.
 */
export function getAddableNodeDefinitions(filter: WorkflowNodeDefinitionFilter = {}): readonly WorkflowNodeDefinition[] {
  return enabledDefinitions(filter).filter((definition) => definition.addable)
}

/**
 * Returns node definitions that can be created from a source-node connection gesture.
 * @param sourceType - Source node type that drives connection filtering.
 * @returns Connect-create targets that are both available and matrix-valid.
 */
export function getConnectCreateNodeDefinitions(sourceType: NodeType, filter: WorkflowNodeDefinitionFilter = {}): readonly WorkflowNodeDefinition[] {
  const allowedOutputs = NODE_CONNECTION_MATRIX[sourceType]
  const definitionByType = new Map(enabledDefinitions(filter).map((definition) => [definition.type, definition]))
  return allowedOutputs
    .map((type) => definitionByType.get(type) ?? getNodeDefinition(type))
    .filter((definition) => definition.connectCreate)
}

/**
 * Returns node definitions with local run actions.
 * @returns Runnable node definitions.
 */
export function getRunnableNodeDefinitions(filter: WorkflowNodeDefinitionFilter = {}): readonly WorkflowNodeDefinition[] {
  return enabledDefinitions(filter).filter((definition) => definition.runnable)
}

/**
 * Builds a renderer-safe model catalog from enabled gateway configuration.
 * @param gateways - Gateway configuration views.
 * @returns Channel model lists and aggregate capability flags.
 */
export function buildModelCatalog(gateways: readonly GatewayConfigView[]): WorkflowModelCatalog {
  const enabledGateways = gateways.filter((gateway) => gateway.enabled)
  const models: WorkflowModelCatalog['models'] = {
    text: [],
    image: [],
    video: [],
    tool: toolModelOptions(),
  }

  for (const gateway of enabledGateways) {
    for (const channel of ['text', 'image', 'video'] as const) {
      const modelId = gateway.modelMap[channel]
      if (modelId && gateway.capabilities.includes(channel)) {
        models[channel].push(modelOption(gateway, channel, modelId))
      }
    }
  }

  const capabilities = new Set(enabledGateways.flatMap((gateway) => gateway.capabilities))
  return {
    models,
    availableModelIds: uniqueModelIds(models),
    capabilityFlags: {
      text: capabilities.has('text'),
      image: capabilities.has('image'),
      video: capabilities.has('video'),
      imageEdit: capabilities.has('image.edit'),
      videoFirstFrame: capabilities.has('video.firstFrame'),
      videoLastFrame: capabilities.has('video.lastFrame'),
      tools: models.tool.some((model) => model.enabled),
    },
  }
}
