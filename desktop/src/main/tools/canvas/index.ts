/**
 * Built-in canvas tools for ToolRuntime.
 * @see docs/api-contracts/tools-plugins.md
 * @see docs/api-contracts/canvas-plan.md
 */

import { z } from 'zod'

import {
  connectCanvasNodes,
  createCanvasNode,
  deleteCanvasNode,
  duplicateCanvasNode,
} from '../../../../../shared/canvas-actions'
import type { CanvasGraphNode, CanvasGraphSnapshot } from '../../../../../shared/graph'
import { validateCanvasGraph } from '../../../../../shared/graph-validation'
import type { JobTicket } from '../../../../../shared/jobs'
import type { CanvasEdgeData, CanvasNodeData, NodeType } from '../../../../../shared/nodes'
import type { ToolActor, ToolDescriptor, ToolPermission } from '../../../../../shared/tools'
import { getNodeDefinition, type WorkflowRunAction } from '../../../../../shared/workflow-node-definitions'
import type { JobQueue } from '../../jobs/queue'
import { defineTool, ToolExecutionError, type ToolDefinition } from '../runtime'

export interface CanvasGraphStore {
  getGraph(workflowId?: string): CanvasGraphSnapshot
  setGraph(graph: CanvasGraphSnapshot, workflowId?: string): void
}

export interface CanvasToolsOptions {
  graphStore: CanvasGraphStore
  queue?: Pick<JobQueue, 'enqueue'>
  idFactory?: (prefix: 'node' | 'edge' | 'plan') => string
  clock?: () => number
}

const canvasReadPermission: ToolPermission = { kind: 'canvas.read', reason: 'Reads the current canvas graph.' }
const canvasWritePermission: ToolPermission = { kind: 'canvas.write', reason: 'Creates or mutates canvas graph nodes.' }
const canvasEdgeWritePermission: ToolPermission = { kind: 'canvas.write', reason: 'Creates or mutates canvas graph edges.' }
const providerSpendPermission: ToolPermission = { kind: 'provider.spend', reason: 'May enqueue provider-backed generation jobs.' }

const positionSchema = z.object({
  x: z.number().describe('Canvas X coordinate in pixels.'),
  y: z.number().describe('Canvas Y coordinate in pixels.')
})
const viewportSchema = z.object({
  x: z.number().describe('Viewport pan X offset.'),
  y: z.number().describe('Viewport pan Y offset.'),
  zoom: z.number().describe('Viewport zoom level.')
})
const nodeTypeSchema = z.enum([
  'text',
  'image',
  'video',
  'character',
  'scene',
  'audio',
  'imageConfigV2',
  'videoConfigV2',
  'videoCompose',
  'superResolution',
  'muxAudioVideo',
  'mjImage'
]).describe('Canvas node type identifier.')
const orientationSchema = z.enum(['landscape', 'portrait', 'square']).describe('Media orientation.')
const statusSchema = z.enum(['idle', 'pending', 'running', 'done', 'error']).describe('Node run status.')
const edgeTypeSchema = z.enum(['promptOrder', 'imageOrder', 'imageRole', 'outputLink', 'reference', 'default']).describe('Semantic edge type from the connection matrix.')
const imageRoleSchema = z.enum(['first_frame', 'last_frame', 'reference']).describe('Image role when edgeType is imageRole.')

const textDataSchema = z.object({
  label: z.string(),
  content: z.string()
})

const imageDataSchema = z.object({
  label: z.string(),
  promptOverride: z.string(),
  modelId: z.string(),
  orientation: orientationSchema,
  assetId: z.string().nullable(),
  status: statusSchema
})

const videoDataSchema = z.object({
  label: z.string(),
  promptOverride: z.string(),
  modelId: z.string(),
  orientation: orientationSchema,
  durationSeconds: z.number(),
  firstFrameAssetId: z.string().nullable(),
  lastFrameAssetId: z.string().nullable(),
  assetId: z.string().nullable(),
  status: statusSchema
})

const semanticDataSchema = z.object({
  label: z.string()
}).passthrough()

const nodeDataSchema: z.ZodType<CanvasNodeData> = z.union([textDataSchema, imageDataSchema, videoDataSchema, semanticDataSchema])

const graphNodeSchema = z.object({
  id: z.string(),
  type: nodeTypeSchema,
  position: positionSchema,
  data: nodeDataSchema
})

const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  data: z.object({
    edgeType: edgeTypeSchema,
    imageRole: imageRoleSchema.optional(),
    createdAt: z.number()
  })
})

const graphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  viewport: viewportSchema
})

const graphValidationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(['warning', 'error']),
  message: z.string(),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
  refId: z.string().optional()
})

const graphValidationSummarySchema = z.object({
  unsupportedNodes: z.number(),
  invalidEdges: z.number(),
  unavailableModels: z.number(),
  unavailableStyles: z.number(),
  unavailableAssets: z.number()
})

const graphValidationResultSchema = z.object({
  mode: z.enum(['lenient', 'strict']),
  valid: z.boolean(),
  issues: z.array(graphValidationIssueSchema),
  warningSummary: graphValidationSummarySchema
})

const jobTicketSchema = z.object({
  jobId: z.string(),
  status: z.literal('pending'),
  createdAt: z.number()
})

type CanvasRunJobType =
  | 'canvas.generateImage'
  | 'canvas.generateVideo'
  | 'canvas.polishText'
  | 'canvas.generateAudio'
  | 'canvas.composeVideo'
  | 'canvas.upscaleVideo'
  | 'canvas.muxAudioVideo'

const planSchema = z.object({
  kind: z.enum(['plan', 'clarify']),
  summary: z.string(),
  nodes: z.array(
    z.object({
      ref: z.string(),
      type: nodeTypeSchema,
      title: z.string(),
      data: z.record(z.string(), z.unknown())
    })
  ),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      edgeType: edgeTypeSchema,
      imageRole: imageRoleSchema.optional()
    })
  ),
  runSteps: z.array(
    z.object({
      ref: z.string(),
      action: z.enum(['imageRun', 'videoRun', 'textPolish'])
    })
  ),
  question: z.string().nullable(),
  dropped: z.array(z.string())
})

function descriptor(input: Omit<ToolDescriptor, 'category' | 'owner' | 'enabled'>): ToolDescriptor {
  return {
    ...input,
    category: 'canvas',
    owner: { kind: 'builtin', id: 'core' },
    enabled: true
  }
}

function cloneGraph(graph: CanvasGraphSnapshot): CanvasGraphSnapshot {
  return structuredClone(graph)
}

function getNode(graph: CanvasGraphSnapshot, nodeId: string): CanvasGraphNode {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId)

  if (!node) {
    throw new Error(`Canvas node not found: ${nodeId}`)
  }

  return node
}

function defaultQueueTicket(createdAt: number): JobTicket {
  return { jobId: 'job-queue-unavailable', status: 'pending', createdAt }
}

function jobTypeForRunAction(action: WorkflowRunAction): CanvasRunJobType {
  if (action === 'imageRun') return 'canvas.generateImage'
  if (action === 'videoRun') return 'canvas.generateVideo'
  if (action === 'textPolish') return 'canvas.polishText'
  if (action === 'videoComposeRun') return 'canvas.composeVideo'
  if (action === 'superResolutionRun') return 'canvas.upscaleVideo'
  if (action === 'muxAudioVideoRun') return 'canvas.muxAudioVideo'
  return 'canvas.generateImage'
}

function updateGraph(options: CanvasToolsOptions, mutator: (graph: CanvasGraphSnapshot) => void): CanvasGraphSnapshot {
  const graph = cloneGraph(options.graphStore.getGraph())
  mutator(graph)
  options.graphStore.setGraph(graph)
  return graph
}

function withRenamedLabel(data: CanvasNodeData, label: string): CanvasNodeData {
  return { ...data, label } as CanvasNodeData
}

function selectedFragment(graph: CanvasGraphSnapshot, nodeIds: string[], edgeIds: string[] = []): CanvasGraphSnapshot {
  const selectedNodeIds = new Set(nodeIds)
  const selectedEdgeIds = new Set(edgeIds)
  const nodes = graph.nodes.filter((node) => selectedNodeIds.has(node.id))
  const edges = graph.edges.filter(
    (edge) => selectedEdgeIds.has(edge.id) || (selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target))
  )

  return { nodes, edges, viewport: graph.viewport }
}

function throwConnectFailure(reason: 'node_not_found' | 'connection_not_allowed' | 'duplicate_edge', source: string, target: string): never {
  throw new ToolExecutionError({
    code: 'invalid_edge',
    message: reason === 'duplicate_edge'
      ? 'Duplicate canvas edge rejected.'
      : reason === 'node_not_found'
        ? 'Canvas node not found for connection.'
        : 'Connection rejected by shared connection matrix.',
    details: { source, target }
  })
}

function sortSelectedNodes(graph: CanvasGraphSnapshot, nodeIds: string[]): CanvasGraphNode[] {
  const selected = new Set(nodeIds)
  return graph.nodes.filter((node) => selected.has(node.id)).sort((left, right) => left.position.y - right.position.y || left.position.x - right.position.x || left.id.localeCompare(right.id))
}

function actorFromTool(actor: ToolActor): ToolActor {
  return actor
}

function enqueueRunJob(options: CanvasToolsOptions, input: { nodeId: string; type: CanvasRunJobType }, actor: ToolActor, createdAt: number): JobTicket {
  if (!options.queue) {
    return defaultQueueTicket(createdAt)
  }

  try {
    return options.queue.enqueue({
      type: input.type,
      targetId: input.nodeId,
      payload: { nodeId: input.nodeId },
      requestedBy: actorFromTool(actor)
    })
  } catch (error) {
    // Queue failures are usually transient persistence/runtime failures and can be retried.
    throw new ToolExecutionError({
      code: 'job_enqueue_failed',
      message: 'Failed to enqueue canvas job.',
      retryable: true,
      details: {
        nodeId: input.nodeId,
        cause: error instanceof Error ? error.message : 'unknown'
      }
    })
  }
}

/**
 * Creates built-in canvas tools for the shared ToolRuntime.
 * @param options - Graph store, optional queue, and deterministic factories.
 * @returns Tool definitions for graph query, mutation, planning, and node runs.
 * @throws Error never intentionally during construction; tool invocation returns safe failures.
 * @see docs/api-contracts/tools-plugins.md
 */
export function createCanvasTools(options: CanvasToolsOptions): ToolDefinition<unknown, unknown>[] {
  const idFactory = options.idFactory ?? ((prefix: 'node' | 'edge' | 'plan') => `${prefix}-${crypto.randomUUID()}`)
  const clock = options.clock ?? Date.now

  return [
    defineTool({
      descriptor: descriptor({
        id: 'canvas.queryGraph',
        name: 'Query Canvas Graph',
        description: 'Reads the current canvas graph snapshot.',
        inputSchemaRef: 'canvas.queryGraph.input',
        outputSchemaRef: 'canvas.graph.output',
        permissions: [canvasReadPermission],
        concurrency: 'readonly'
      }),
      inputSchema: z.object({}),
      outputSchema: graphSchema,
      renderToolUseMessage: () => 'Query canvas graph',
      call() {
        return cloneGraph(options.graphStore.getGraph())
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.proposePlan',
        name: 'Propose Canvas Plan',
        description: 'Returns a declarative CanvasPlan draft without mutating the graph.',
        inputSchemaRef: 'canvas.proposePlan.input',
        outputSchemaRef: 'canvas.plan.output',
        permissions: [canvasReadPermission],
        concurrency: 'readonly'
      }),
      inputSchema: z.object({
        summary: z.string().describe('Short human-readable summary of the proposed plan.'),
        plan: planSchema.optional().describe('Optional full CanvasPlan draft; omit to return a clarify shell.')
      }),
      outputSchema: planSchema,
      renderToolUseMessage: () => 'Propose canvas plan',
      call(input) {
        return input.plan ?? {
          kind: 'clarify',
          summary: input.summary,
          nodes: [],
          edges: [],
          runSteps: [],
          question: null,
          dropped: []
        }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.validateGraph',
        name: 'Validate Canvas Graph',
        description: 'Validates the current or provided canvas graph using shared graph rules.',
        inputSchemaRef: 'canvas.validateGraph.input',
        outputSchemaRef: 'canvas.validateGraph.output',
        permissions: [canvasReadPermission],
        concurrency: 'readonly'
      }),
      inputSchema: z.object({
        mode: z.enum(['lenient', 'strict']).optional().describe('Validation strictness; defaults to strict.'),
        graph: graphSchema.optional().describe('Graph to validate; defaults to the persisted canvas graph.')
      }),
      outputSchema: graphValidationResultSchema,
      renderToolUseMessage: () => 'Validate canvas graph',
      call(input) {
        const graph = input.graph ? input.graph as CanvasGraphSnapshot : options.graphStore.getGraph()
        return validateCanvasGraph(graph, input.mode ?? 'strict')
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.createNode',
        name: 'Create Canvas Node',
        description: 'Creates a text, image, or video node on the canvas.',
        inputSchemaRef: 'canvas.createNode.input',
        outputSchemaRef: 'canvas.createNode.output',
        permissions: [canvasWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        type: nodeTypeSchema,
        position: positionSchema.describe('Initial node position on the canvas.'),
        data: nodeDataSchema.optional().describe('Optional node data payload; defaults are applied per node type.')
      }),
      outputSchema: z.object({ nodeId: z.string() }),
      renderToolUseMessage: (input) => `Create ${input.type} node`,
      call(input) {
        const nodeId = idFactory('node')
        updateGraph(options, (draft) => {
          const next = createCanvasNode(draft, {
            nodeId,
            type: input.type,
            position: input.position,
            ...(input.data ? { data: input.data } : {})
          })
          draft.nodes = next.graph.nodes
        })

        return { nodeId }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.duplicateNode',
        name: 'Duplicate Canvas Node',
        description: 'Duplicates a canvas node with copied data and an offset position.',
        inputSchemaRef: 'canvas.duplicateNode.input',
        outputSchemaRef: 'canvas.duplicateNode.output',
        permissions: [canvasWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        nodeId: z.string().describe('Existing canvas node ID to duplicate.'),
        offset: positionSchema.optional().describe('XY offset from the source node; defaults to (32, 32).')
      }),
      outputSchema: z.object({ nodeId: z.string() }),
      renderToolUseMessage: (input) => `Duplicate ${input.nodeId}`,
      call(input) {
        const nodeId = idFactory('node')
        const offset = input.offset ?? { x: 32, y: 32 }
        updateGraph(options, (draft) => {
          const next = duplicateCanvasNode(draft, { nodeId: input.nodeId, newNodeId: nodeId, offset })
          draft.nodes = next.graph.nodes
        })

        return { nodeId }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.renameNode',
        name: 'Rename Canvas Node',
        description: 'Renames a canvas node by updating its shared label field.',
        inputSchemaRef: 'canvas.renameNode.input',
        outputSchemaRef: 'canvas.renameNode.output',
        permissions: [canvasWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        nodeId: z.string().describe('Canvas node ID to rename.'),
        label: z.string().min(1).describe('New display label for the node.')
      }),
      outputSchema: z.object({ nodeId: z.string(), label: z.string() }),
      renderToolUseMessage: (input) => `Rename ${input.nodeId}`,
      call(input) {
        updateGraph(options, (draft) => {
          const node = getNode(draft, input.nodeId)
          node.data = withRenamedLabel(node.data, input.label)
        })

        return { nodeId: input.nodeId, label: input.label }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.setNodePosition',
        name: 'Set Canvas Node Position',
        description: 'Moves a canvas node to an exact persisted canvas position.',
        inputSchemaRef: 'canvas.setNodePosition.input',
        outputSchemaRef: 'canvas.setNodePosition.output',
        permissions: [canvasWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        nodeId: z.string().describe('Canvas node ID to move.'),
        position: positionSchema.describe('Target canvas position.')
      }),
      outputSchema: z.object({ nodeId: z.string(), position: positionSchema }),
      renderToolUseMessage: (input) => `Move ${input.nodeId}`,
      call(input) {
        updateGraph(options, (draft) => {
          const node = getNode(draft, input.nodeId)
          node.position = input.position
        })

        return { nodeId: input.nodeId, position: input.position }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.connectNodes',
        name: 'Connect Canvas Nodes',
        description: 'Creates a validated edge between two canvas nodes.',
        inputSchemaRef: 'canvas.connectNodes.input',
        outputSchemaRef: 'canvas.connectNodes.output',
        permissions: [canvasEdgeWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        source: z.string().describe('Source node ID.'),
        target: z.string().describe('Target node ID.'),
        edgeType: edgeTypeSchema,
        imageRole: imageRoleSchema.optional()
      }),
      outputSchema: z.object({ edgeId: z.string() }),
      renderToolUseMessage: (input) => `Connect ${input.source} to ${input.target}`,
      call(input) {
        const edgeId = idFactory('edge')
        updateGraph(options, (draft) => {
          const next = connectCanvasNodes(draft, {
            edgeId,
            source: input.source,
            target: input.target,
            edgeType: input.edgeType,
            createdAt: clock(),
            ...(input.imageRole ? { imageRole: input.imageRole } : {})
          })
          if (!next.ok) {
            throwConnectFailure(next.reason, input.source, input.target)
          }
          draft.edges = next.graph.edges
        })

        return { edgeId }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.connectToCreate',
        name: 'Connect To Created Canvas Node',
        description: 'Creates a target node and a validated edge from an existing source node.',
        inputSchemaRef: 'canvas.connectToCreate.input',
        outputSchemaRef: 'canvas.connectToCreate.output',
        permissions: [canvasWritePermission, canvasEdgeWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        source: z.string().describe('Existing source node ID.'),
        type: nodeTypeSchema,
        position: positionSchema.describe('Position for the newly created target node.'),
        data: nodeDataSchema.optional().describe('Optional data for the new node.'),
        edgeType: edgeTypeSchema,
        imageRole: imageRoleSchema.optional()
      }),
      outputSchema: z.object({ nodeId: z.string(), edgeId: z.string() }),
      renderToolUseMessage: (input) => `Create ${input.type} from ${input.source}`,
      call(input) {
        const nodeId = idFactory('node')
        const edgeId = idFactory('edge')
        updateGraph(options, (draft) => {
          const nodeGraph = createCanvasNode(draft, {
            nodeId,
            type: input.type,
            position: input.position,
            ...(input.data ? { data: input.data } : {})
          }).graph
          const next = connectCanvasNodes(nodeGraph, {
            edgeId,
            source: input.source,
            target: nodeId,
            edgeType: input.edgeType,
            createdAt: clock(),
            ...(input.imageRole ? { imageRole: input.imageRole } : {})
          })
          if (!next.ok) {
            throwConnectFailure(next.reason, input.source, nodeId)
          }
          draft.nodes = next.graph.nodes
          draft.edges = next.graph.edges
        })

        return { nodeId, edgeId }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.deleteEdge',
        name: 'Delete Canvas Edge',
        description: 'Deletes one persisted canvas edge.',
        inputSchemaRef: 'canvas.deleteEdge.input',
        outputSchemaRef: 'canvas.deleteEdge.output',
        permissions: [{ kind: 'destructive', reason: 'Deletes an edge from the canvas graph.' }, canvasEdgeWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({ edgeId: z.string().describe('Persisted edge ID to delete.') }),
      outputSchema: z.object({ edgeId: z.string() }),
      renderToolUseMessage: (input) => `Delete edge ${input.edgeId}`,
      checkPermissions: () => ({
        decision: 'allow',
        decisionReason: 'Allowed for built-in orchestrator graph cleanup.',
        requiredPermissions: [{ kind: 'destructive', reason: 'Deletes an edge from the canvas graph.' }, canvasEdgeWritePermission]
      }),
      call(input) {
        updateGraph(options, (draft) => {
          if (!draft.edges.some((edge) => edge.id === input.edgeId)) {
            throw new Error(`Canvas edge not found: ${input.edgeId}`)
          }
          draft.edges = draft.edges.filter((edge) => edge.id !== input.edgeId)
        })

        return { edgeId: input.edgeId }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.updateEdge',
        name: 'Update Canvas Edge',
        description: 'Updates persisted canvas edge semantic data.',
        inputSchemaRef: 'canvas.updateEdge.input',
        outputSchemaRef: 'canvas.updateEdge.output',
        permissions: [canvasEdgeWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        edgeId: z.string().describe('Persisted edge ID to update.'),
        data: z.object({
          edgeType: edgeTypeSchema.optional(),
          imageRole: imageRoleSchema.nullable().optional(),
          promptOrder: z.number().optional(),
          imageOrder: z.number().optional()
        }).describe('Partial edge data fields to merge.')
      }),
      outputSchema: z.object({ edgeId: z.string() }),
      renderToolUseMessage: (input) => `Update edge ${input.edgeId}`,
      call(input) {
        updateGraph(options, (draft) => {
          const edge = draft.edges.find((candidate) => candidate.id === input.edgeId)
          if (!edge) {
            throw new Error(`Canvas edge not found: ${input.edgeId}`)
          }
          const nextData: CanvasEdgeData = {
            ...edge.data,
            ...(input.data.edgeType ? { edgeType: input.data.edgeType } : {}),
            ...(input.data.imageRole ? { imageRole: input.data.imageRole } : {}),
            ...(typeof input.data.promptOrder === 'number' ? { promptOrder: input.data.promptOrder } : {}),
            ...(typeof input.data.imageOrder === 'number' ? { imageOrder: input.data.imageOrder } : {})
          }
          if (input.data.imageRole === null) {
            delete nextData.imageRole
          }
          edge.data = nextData
        })

        return { edgeId: input.edgeId }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.updateNodeData',
        name: 'Update Canvas Node Data',
        description: 'Merges partial data into an existing canvas node.',
        inputSchemaRef: 'canvas.updateNodeData.input',
        outputSchemaRef: 'canvas.updateNodeData.output',
        permissions: [canvasWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        nodeId: z.string().describe('Canvas node ID to patch.'),
        data: z.record(z.string(), z.unknown()).describe('Partial node data merged into the existing payload.')
      }),
      outputSchema: z.object({ nodeId: z.string() }),
      renderToolUseMessage: (input) => `Update ${input.nodeId}`,
      call(input) {
        updateGraph(options, (draft) => {
          const node = getNode(draft, input.nodeId)
          node.data = { ...node.data, ...input.data }
        })

        return { nodeId: input.nodeId }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.extractSelection',
        name: 'Extract Canvas Selection',
        description: 'Returns a selected graph fragment for snippet save or Agent review.',
        inputSchemaRef: 'canvas.extractSelection.input',
        outputSchemaRef: 'canvas.graph.output',
        permissions: [canvasReadPermission],
        concurrency: 'readonly'
      }),
      inputSchema: z.object({
        nodeIds: z.array(z.string()).describe('Node IDs to include in the extracted fragment.'),
        edgeIds: z.array(z.string()).optional().describe('Optional edge IDs; internal edges between selected nodes are kept.')
      }),
      outputSchema: graphSchema,
      renderToolUseMessage: () => 'Extract canvas selection',
      call(input) {
        return selectedFragment(options.graphStore.getGraph(), input.nodeIds, input.edgeIds)
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.duplicateSelection',
        name: 'Duplicate Canvas Selection',
        description: 'Duplicates selected nodes and internal selected edges.',
        inputSchemaRef: 'canvas.duplicateSelection.input',
        outputSchemaRef: 'canvas.duplicateSelection.output',
        permissions: [canvasWritePermission, canvasEdgeWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        nodeIds: z.array(z.string()).describe('Node IDs to duplicate.'),
        edgeIds: z.array(z.string()).optional().describe('Optional internal edge IDs to duplicate with the selection.'),
        offset: positionSchema.optional().describe('XY offset applied to duplicated nodes.')
      }),
      outputSchema: z.object({ nodeIds: z.array(z.string()), edgeIds: z.array(z.string()) }),
      renderToolUseMessage: () => 'Duplicate canvas selection',
      call(input) {
        const offset = input.offset ?? { x: 32, y: 32 }
        const createdNodeIds: string[] = []
        const createdEdgeIds: string[] = []
        updateGraph(options, (draft) => {
          const fragment = selectedFragment(draft, input.nodeIds, input.edgeIds)
          const idMap = new Map<string, string>()
          for (const node of fragment.nodes) {
            const nodeId = idFactory('node')
            idMap.set(node.id, nodeId)
            createdNodeIds.push(nodeId)
            const next = duplicateCanvasNode(draft, { nodeId: node.id, newNodeId: nodeId, offset })
            draft.nodes = next.graph.nodes
          }
          for (const edge of fragment.edges) {
            const source = idMap.get(edge.source)
            const target = idMap.get(edge.target)
            if (!source || !target) continue
            const edgeId = idFactory('edge')
            createdEdgeIds.push(edgeId)
            draft.edges.push({ id: edgeId, source, target, data: { ...edge.data, createdAt: clock() } })
          }
        })

        return { nodeIds: createdNodeIds, edgeIds: createdEdgeIds }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.deleteSelection',
        name: 'Delete Canvas Selection',
        description: 'Deletes selected nodes and edges from the canvas graph.',
        inputSchemaRef: 'canvas.deleteSelection.input',
        outputSchemaRef: 'canvas.deleteSelection.output',
        permissions: [{ kind: 'destructive', reason: 'Deletes selected graph items.' }, canvasWritePermission, canvasEdgeWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        nodeIds: z.array(z.string()).optional().describe('Node IDs to delete.'),
        edgeIds: z.array(z.string()).optional().describe('Edge IDs to delete; edges attached to deleted nodes are removed.')
      }),
      outputSchema: z.object({ deletedNodeIds: z.array(z.string()), deletedEdgeIds: z.array(z.string()) }),
      renderToolUseMessage: () => 'Delete canvas selection',
      checkPermissions: () => ({
        decision: 'allow',
        decisionReason: 'Allowed for built-in orchestrator graph cleanup.',
        requiredPermissions: [{ kind: 'destructive', reason: 'Deletes selected graph items.' }, canvasWritePermission, canvasEdgeWritePermission]
      }),
      call(input) {
        const deletedNodeIds: string[] = []
        const deletedEdgeIds: string[] = []
        const nodeIds = new Set(input.nodeIds ?? [])
        const edgeIds = new Set(input.edgeIds ?? [])
        updateGraph(options, (draft) => {
          draft.nodes = draft.nodes.filter((node) => {
            const deleted = nodeIds.has(node.id)
            if (deleted) deletedNodeIds.push(node.id)
            return !deleted
          })
          draft.edges = draft.edges.filter((edge) => {
            const deleted = edgeIds.has(edge.id) || nodeIds.has(edge.source) || nodeIds.has(edge.target)
            if (deleted) deletedEdgeIds.push(edge.id)
            return !deleted
          })
        })

        return { deletedNodeIds, deletedEdgeIds }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.layoutSelection',
        name: 'Layout Canvas Selection',
        description: 'Applies a deterministic grid layout to selected canvas nodes.',
        inputSchemaRef: 'canvas.layoutSelection.input',
        outputSchemaRef: 'canvas.layoutSelection.output',
        permissions: [canvasWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({
        nodeIds: z.array(z.string()).describe('Node IDs to lay out in a grid.'),
        origin: positionSchema.optional().describe('Top-left origin of the grid.'),
        columns: z.number().int().positive().optional().describe('Column count; defaults to sqrt(n).'),
        gap: positionSchema.optional().describe('Horizontal and vertical spacing between nodes.')
      }),
      outputSchema: z.object({ nodeIds: z.array(z.string()) }),
      renderToolUseMessage: () => 'Layout canvas selection',
      call(input) {
        const columns = input.columns ?? Math.max(1, Math.ceil(Math.sqrt(input.nodeIds.length)))
        const origin = input.origin ?? { x: 0, y: 0 }
        const gap = input.gap ?? { x: 320, y: 220 }
        updateGraph(options, (draft) => {
          const selected = sortSelectedNodes(draft, input.nodeIds)
          selected.forEach((node, index) => {
            node.position = {
              x: origin.x + (index % columns) * gap.x,
              y: origin.y + Math.floor(index / columns) * gap.y
            }
          })
        })

        return { nodeIds: input.nodeIds }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.deleteNode',
        name: 'Delete Canvas Node',
        description: 'Deletes a canvas node and its attached edges.',
        inputSchemaRef: 'canvas.deleteNode.input',
        outputSchemaRef: 'canvas.deleteNode.output',
        permissions: [{ kind: 'destructive', reason: 'Deletes a node from the canvas graph.' }, canvasWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({ nodeId: z.string().describe('Canvas node ID to delete with its attached edges.') }),
      outputSchema: z.object({ nodeId: z.string(), deletedEdgeIds: z.array(z.string()) }),
      renderToolUseMessage: (input) => `Delete ${input.nodeId}`,
      checkPermissions: () => ({
        decision: 'allow',
        decisionReason: 'Allowed for built-in orchestrator graph cleanup.',
        requiredPermissions: [{ kind: 'destructive', reason: 'Deletes a node from the canvas graph.' }, canvasWritePermission]
      }),
      call(input) {
        let deletedEdgeIds: string[] = []
        updateGraph(options, (draft) => {
          const next = deleteCanvasNode(draft, { nodeId: input.nodeId })
          deletedEdgeIds = next.result.deletedEdgeIds
          draft.nodes = next.graph.nodes
          draft.edges = next.graph.edges
        })

        return { nodeId: input.nodeId, deletedEdgeIds }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'canvas.runNode',
        name: 'Run Canvas Node',
        description: 'Enqueues generation for an image or video canvas node.',
        inputSchemaRef: 'canvas.runNode.input',
        outputSchemaRef: 'canvas.runNode.output',
        permissions: [providerSpendPermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({ nodeId: z.string().describe('Runnable canvas node ID (imageConfigV2, videoConfigV2, text, etc.).') }),
      outputSchema: jobTicketSchema,
      renderToolUseMessage: (input) => `Run ${input.nodeId}`,
      call(input, ctx) {
        const node = getNode(options.graphStore.getGraph(), input.nodeId)
        const definition = getNodeDefinition(node.type)

        if (!definition.runnable || !definition.runAction) {
          const reason = definition.unavailableReason ?? 'No local runtime is registered for this node type.'
          throw new Error(`Runtime unavailable for ${node.type}: ${reason}`)
        }

        const ticket = enqueueRunJob(options, { nodeId: input.nodeId, type: jobTypeForRunAction(definition.runAction) }, ctx.actor, clock())

        return ticket
      }
    })
  ]
}
