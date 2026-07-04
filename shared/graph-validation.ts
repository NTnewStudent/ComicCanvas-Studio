/**
 * Graph validation helpers shared by draft save, strict run, and future Agent tools.
 * @see docs/api-contracts/canvas-plan.md
 */

import { canConnect } from './connection-matrix'
import { isCanvasNodeType, type CanvasGraphNode, type CanvasGraphSnapshot } from './graph'
import type { CanvasNodeData } from './nodes'
import type { StylePresetView } from './styles'

export type GraphValidationMode = 'lenient' | 'strict'

export type GraphValidationIssueCode =
  | 'unsupported_node_type'
  | 'invalid_edge'
  | 'missing_asset'
  | 'unavailable_asset'
  | 'unavailable_style'
  | 'disabled_style'
  | 'unavailable_model'

export interface GraphValidationIssue {
  code: GraphValidationIssueCode
  severity: 'warning' | 'error'
  message: string
  nodeId?: string
  edgeId?: string
  refId?: string
}

export interface GraphValidationSummary {
  unsupportedNodes: number
  invalidEdges: number
  unavailableModels: number
  unavailableStyles: number
  unavailableAssets: number
}

export interface GraphValidationContext {
  assets?: {
    hasUsableAsset(assetId: string): boolean
  }
  styles?: {
    styles: StylePresetView[]
    projectDefaultStylePresetId?: string | null
  }
  availableModelIds?: Iterable<string>
}

export interface GraphValidationResult {
  mode: GraphValidationMode
  valid: boolean
  issues: GraphValidationIssue[]
  warningSummary: GraphValidationSummary
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function issueSeverity(mode: GraphValidationMode): 'warning' | 'error' {
  return mode === 'strict' ? 'error' : 'warning'
}

function pushAssetIssue(issues: GraphValidationIssue[], mode: GraphValidationMode, node: CanvasGraphNode, assetId: string, context: GraphValidationContext): void {
  if (!context.assets || context.assets.hasUsableAsset(assetId)) return
  issues.push({
    code: 'unavailable_asset',
    severity: issueSeverity(mode),
    message: `Asset ${assetId} is unavailable.`,
    nodeId: node.id,
    refId: assetId,
  })
}

function referencedAssetIds(data: CanvasNodeData): string[] {
  const record = readRecord(data)
  const ids = new Set<string>()
  for (const key of ['assetId', 'firstFrameAssetId', 'lastFrameAssetId', 'firstFrameAssetV2Id', 'lastFrameAssetV2Id']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      ids.add(value)
    }
  }
  const references = record.referenceAssets
  if (Array.isArray(references)) {
    for (const reference of references) {
      const id = readRecord(reference).id
      if (typeof id === 'string' && id.trim().length > 0) {
        ids.add(id)
      }
    }
  }
  return [...ids]
}

function validateNodeReferences(graph: CanvasGraphSnapshot, mode: GraphValidationMode, context: GraphValidationContext, issues: GraphValidationIssue[]): void {
  const models = context.availableModelIds ? new Set(context.availableModelIds) : null
  const styles = context.styles?.styles ?? []
  const projectDefaultStylePresetId = context.styles?.projectDefaultStylePresetId ?? null

  for (const node of graph.nodes) {
    const data = readRecord(node.data)
    const modelId = data.modelId
    if (models && typeof modelId === 'string' && modelId.trim().length > 0 && !models.has(modelId)) {
      issues.push({
        code: 'unavailable_model',
        severity: issueSeverity(mode),
        message: `Model ${modelId} is unavailable.`,
        nodeId: node.id,
        refId: modelId,
      })
    }

    const stylePresetId = typeof data.stylePresetId === 'string' && data.stylePresetId.trim().length > 0
      ? data.stylePresetId
      : projectDefaultStylePresetId
    if (stylePresetId) {
      const style = styles.find((candidate) => candidate.id === stylePresetId)
      if (!style) {
        issues.push({
          code: 'unavailable_style',
          severity: issueSeverity(mode),
          message: `Style preset ${stylePresetId} is unavailable.`,
          nodeId: node.id,
          refId: stylePresetId,
        })
      } else if (!style.enabled) {
        issues.push({
          code: 'disabled_style',
          severity: issueSeverity(mode),
          message: `Style preset ${stylePresetId} is disabled.`,
          nodeId: node.id,
          refId: stylePresetId,
        })
      }
    }

    for (const assetId of referencedAssetIds(node.data)) {
      pushAssetIssue(issues, mode, node, assetId, context)
    }
  }
}

function summarize(issues: GraphValidationIssue[]): GraphValidationSummary {
  return {
    unsupportedNodes: issues.filter((issue) => issue.code === 'unsupported_node_type').length,
    invalidEdges: issues.filter((issue) => issue.code === 'invalid_edge').length,
    unavailableModels: issues.filter((issue) => issue.code === 'unavailable_model').length,
    unavailableStyles: issues.filter((issue) => issue.code === 'unavailable_style' || issue.code === 'disabled_style').length,
    unavailableAssets: issues.filter((issue) => issue.code === 'unavailable_asset' || issue.code === 'missing_asset').length,
  }
}

/**
 * Validates graph references using lenient draft-save or strict runtime semantics.
 * @param graph - Canvas graph snapshot to validate.
 * @param mode - Lenient mode yields warnings; strict mode yields blocking errors.
 * @param context - Optional asset, style, and model availability providers.
 * @returns Validation issues and aggregate warning/debug summary.
 */
export function validateCanvasGraph(
  graph: CanvasGraphSnapshot,
  mode: GraphValidationMode,
  context: GraphValidationContext = {}
): GraphValidationResult {
  const issues: GraphValidationIssue[] = []
  const nodes = graph.nodes.filter((node) => {
    const supported = isCanvasNodeType(String(node.type))
    if (!supported) {
      issues.push({
        code: 'unsupported_node_type',
        severity: issueSeverity(mode),
        message: `Node ${node.id} uses unsupported type ${String(node.type)}.`,
        nodeId: node.id,
      })
    }
    return supported
  })
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  for (const edge of graph.edges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target || !canConnect(source.type, target.type)) {
      issues.push({
        code: 'invalid_edge',
        severity: issueSeverity(mode),
        message: `Edge ${edge.id} is invalid for the current graph.`,
        edgeId: edge.id,
      })
    }
  }

  validateNodeReferences({ ...graph, nodes }, mode, context, issues)

  return {
    mode,
    valid: mode === 'lenient' || issues.every((issue) => issue.severity !== 'error'),
    issues,
    warningSummary: summarize(issues),
  }
}
