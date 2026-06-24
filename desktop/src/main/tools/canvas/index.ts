/**
 * Built-in canvas tools for ToolRuntime.
 * @see docs/api-contracts/tools-plugins.md
 * @see docs/api-contracts/canvas-plan.md
 */

import { z } from 'zod'

import { canConnect } from '../../../../../shared/connection-matrix'
import type { CanvasGraphNode, CanvasGraphSnapshot } from '../../../../../shared/graph'
import type { JobTicket } from '../../../../../shared/jobs'
import type { CanvasEdgeData, NodeType } from '../../../../../shared/nodes'
import type { ToolActor, ToolDescriptor, ToolPermission } from '../../../../../shared/tools'
import type { JobQueue } from '../../jobs/queue'
import { defineTool, type ToolDefinition } from '../runtime'

export interface CanvasGraphStore {
  getGraph(): CanvasGraphSnapshot
  setGraph(graph: CanvasGraphSnapshot): void
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

const positionSchema = z.object({ x: z.number(), y: z.number() })
const viewportSchema = z.object({ x: z.number(), y: z.number(), zoom: z.number() })
const nodeTypeSchema = z.enum(['text', 'image', 'video'])
const orientationSchema = z.enum(['landscape', 'portrait', 'square'])
const statusSchema = z.enum(['idle', 'pending', 'running', 'done', 'error'])
const edgeTypeSchema = z.enum(['promptOrder', 'imageRole', 'default'])
const imageRoleSchema = z.enum(['first_frame', 'last_frame', 'reference'])

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

const nodeDataSchema = z.union([textDataSchema, imageDataSchema, videoDataSchema])

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

const jobTicketSchema = z.object({
  jobId: z.string(),
  status: z.literal('pending'),
  createdAt: z.number()
})

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

function assertCanConnect(graph: CanvasGraphSnapshot, sourceId: string, targetId: string): void {
  const source = getNode(graph, sourceId)
  const target = getNode(graph, targetId)

  if (!canConnect(source.type, target.type)) {
    throw new Error('Connection rejected by shared connection matrix.')
  }
}

function defaultQueueTicket(createdAt: number): JobTicket {
  return { jobId: 'job-queue-unavailable', status: 'pending', createdAt }
}

function jobTypeForNode(type: NodeType): 'canvas.generateImage' | 'canvas.generateVideo' {
  if (type === 'video') {
    return 'canvas.generateVideo'
  }

  return 'canvas.generateImage'
}

function updateGraph(options: CanvasToolsOptions, mutator: (graph: CanvasGraphSnapshot) => void): CanvasGraphSnapshot {
  const graph = cloneGraph(options.graphStore.getGraph())
  mutator(graph)
  options.graphStore.setGraph(graph)
  return graph
}

function actorFromTool(actor: ToolActor): ToolActor {
  return actor
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
        summary: z.string(),
        plan: planSchema.optional()
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
        position: positionSchema,
        data: nodeDataSchema
      }),
      outputSchema: z.object({ nodeId: z.string() }),
      renderToolUseMessage: (input) => `Create ${input.type} node`,
      call(input) {
        const nodeId = idFactory('node')
        updateGraph(options, (draft) => {
          draft.nodes.push({ id: nodeId, type: input.type, position: input.position, data: input.data })
        })

        return { nodeId }
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
        source: z.string(),
        target: z.string(),
        edgeType: edgeTypeSchema,
        imageRole: imageRoleSchema.optional()
      }),
      outputSchema: z.object({ edgeId: z.string() }),
      renderToolUseMessage: (input) => `Connect ${input.source} to ${input.target}`,
      call(input) {
        const edgeId = idFactory('edge')
        updateGraph(options, (draft) => {
          assertCanConnect(draft, input.source, input.target)
          const data: CanvasEdgeData = {
            edgeType: input.edgeType,
            createdAt: clock(),
            ...(input.imageRole ? { imageRole: input.imageRole } : {})
          }
          draft.edges.push({ id: edgeId, source: input.source, target: input.target, data })
        })

        return { edgeId }
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
        nodeId: z.string(),
        data: z.record(z.string(), z.unknown())
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
        id: 'canvas.deleteNode',
        name: 'Delete Canvas Node',
        description: 'Deletes a canvas node and its attached edges.',
        inputSchemaRef: 'canvas.deleteNode.input',
        outputSchemaRef: 'canvas.deleteNode.output',
        permissions: [{ kind: 'destructive', reason: 'Deletes a node from the canvas graph.' }, canvasWritePermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({ nodeId: z.string() }),
      outputSchema: z.object({ nodeId: z.string(), deletedEdgeIds: z.array(z.string()) }),
      renderToolUseMessage: (input) => `Delete ${input.nodeId}`,
      checkPermissions: () => ({
        decision: 'allow',
        decisionReason: 'Allowed for built-in orchestrator graph cleanup.',
        requiredPermissions: [{ kind: 'destructive', reason: 'Deletes a node from the canvas graph.' }, canvasWritePermission]
      }),
      call(input) {
        const deletedEdgeIds: string[] = []
        updateGraph(options, (draft) => {
          getNode(draft, input.nodeId)
          draft.edges = draft.edges.filter((edge) => {
            const shouldDelete = edge.source === input.nodeId || edge.target === input.nodeId
            if (shouldDelete) {
              deletedEdgeIds.push(edge.id)
            }
            return !shouldDelete
          })
          draft.nodes = draft.nodes.filter((node) => node.id !== input.nodeId)
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
      inputSchema: z.object({ nodeId: z.string() }),
      outputSchema: jobTicketSchema,
      renderToolUseMessage: (input) => `Run ${input.nodeId}`,
      call(input, ctx) {
        const node = getNode(options.graphStore.getGraph(), input.nodeId)

        if (node.type === 'text') {
          throw new Error('Text nodes do not enqueue generation jobs.')
        }

        const ticket = options.queue?.enqueue({
          type: jobTypeForNode(node.type),
          targetId: input.nodeId,
          payload: { nodeId: input.nodeId },
          requestedBy: actorFromTool(ctx.actor)
        }) ?? defaultQueueTicket(clock())

        return ticket
      }
    })
  ]
}
