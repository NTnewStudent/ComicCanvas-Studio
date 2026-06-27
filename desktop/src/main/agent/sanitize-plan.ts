/**
 * Sanitizes untrusted orchestrator output before CanvasPlan application.
 * @see docs/api-contracts/canvas-plan.md
 */

import { canConnect } from '../../../../shared/connection-matrix'
import type { EdgeType, ImageRole, NodeType } from '../../../../shared/nodes'
import type { CanvasPlan, PlanEdge, PlanNode, PlanRunStep, RunAction } from '../../../../shared/plan'

const NODE_TYPES = new Set<NodeType>([
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
  'muxAudioVideo'
])
const EDGE_TYPES = new Set<EdgeType>(['promptOrder', 'imageOrder', 'imageRole', 'outputLink', 'reference', 'default'])
const IMAGE_ROLES = new Set<ImageRole>(['first_frame', 'last_frame', 'reference'])
const RUN_ACTIONS = new Set<RunAction>([
  'imageRun',
  'videoRun',
  'textPolish'
])
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const DROP = Symbol('drop')

type DroppedRecords = string[]
type SanitizedValue = string | number | boolean | null | SanitizedValue[] | { [key: string]: SanitizedValue }

const executablePatterns: ReadonlyArray<RegExp> = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<\/?script\b[^>]*>/gi,
  /javascript:[^\s?]+/gi,
  /\b(?:import|require|eval|Function)\s*\([^)]*\)/gi,
  /\b(?:window|document|globalThis|process)\s*\.[A-Za-z_$][\w$]*(?:\s*\([^)]*\))?/gi,
  /\brm\s+-rf\b[^\n\r;]*/gi,
  /\bcurl\b[^\n\r;|]*\|\s*sh\b[^\n\r;]*/gi,
  /\bpowershell(?:\.exe)?\b[^\n\r;]*/gi,
  /\bcmd\.exe\b[^\n\r;]*/gi
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+([?.!,;:])/g, '$1').trim()
}

function stripExecutableText(value: string, location: string, dropped: DroppedRecords): string {
  let next = value

  for (const pattern of executablePatterns) {
    next = next.replace(pattern, '')
  }

  next = normalizeText(next)

  if (next !== value) {
    dropped.push(`${location}:executable_string_stripped`)
  }

  return next
}

function formatRef(ref: string): string {
  return ref.length > 0 ? ref : '<missing-ref>'
}

function sanitizeJsonValue(value: unknown, location: string, dropped: DroppedRecords): SanitizedValue | typeof DROP {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    return stripExecutableText(value, location, dropped)
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value
    }

    dropped.push(`${location}:non_finite_number`)
    return DROP
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    const sanitizedArray: SanitizedValue[] = []

    value.forEach((entry, index) => {
      const sanitized = sanitizeJsonValue(entry, `${location}[${index}]`, dropped)

      if (sanitized !== DROP) {
        sanitizedArray.push(sanitized)
      }
    })

    return sanitizedArray
  }

  if (isRecord(value)) {
    const sanitizedRecord: { [key: string]: SanitizedValue } = {}

    for (const [key, entry] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        dropped.push(`${location}.${key}:unsafe_key`)
        continue
      }

      if (/^on[A-Z]/u.test(key)) {
        dropped.push(`${location}.${key}:executable_string_stripped`)
        continue
      }

      const sanitized = sanitizeJsonValue(entry, `${location}.${key}`, dropped)

      if (sanitized !== DROP) {
        sanitizedRecord[key] = sanitized
      }
    }

    return sanitizedRecord
  }

  dropped.push(`${location}:unsupported_value`)
  return DROP
}

function sanitizeStringField(source: Record<string, unknown>, key: string, location: string, dropped: DroppedRecords): string {
  const value = source[key]

  if (typeof value !== 'string') {
    dropped.push(`${location}:invalid_string`)
    return ''
  }

  return stripExecutableText(value, location, dropped)
}

function sanitizeOptionalQuestion(value: unknown, kind: CanvasPlan['kind'], dropped: DroppedRecords): string | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    const question = stripExecutableText(value, 'question', dropped)
    return question.length > 0 ? question : null
  }

  if (kind === 'clarify') {
    dropped.push('question:invalid_string')
    return 'Please clarify the canvas workflow you want to create.'
  }

  return null
}

function sanitizeDroppedRecords(value: unknown, dropped: DroppedRecords): DroppedRecords {
  if (!Array.isArray(value)) {
    return []
  }

  const records: DroppedRecords = []

  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      dropped.push(`dropped[${index}]:invalid_record`)
      return
    }

    const sanitized = stripExecutableText(entry, `dropped[${index}]`, dropped)

    if (sanitized.length > 0) {
      records.push(sanitized)
    }
  })

  return records
}

function sanitizeNode(entry: unknown, index: number, dropped: DroppedRecords): PlanNode | null {
  if (!isRecord(entry)) {
    dropped.push(`node[${index}]:invalid_object`)
    return null
  }

  const ref = sanitizeStringField(entry, 'ref', `node[${index}].ref`, dropped)

  if (ref.length === 0) {
    dropped.push('node:<missing-ref>:missing_ref')
    return null
  }

  if (!NODE_TYPES.has(entry.type as NodeType)) {
    dropped.push(`node:${formatRef(ref)}:unsupported_type`)
    return null
  }

  const title = sanitizeStringField(entry, 'title', `node:${formatRef(ref)}:title`, dropped)
  const dataValue = isRecord(entry.data) ? sanitizeJsonValue(entry.data, `node:${formatRef(ref)}:data`, dropped) : {}
  const data = isRecord(dataValue) ? dataValue : {}

  if (!isRecord(entry.data)) {
    dropped.push(`node:${formatRef(ref)}:data:invalid_object`)
  }

  return {
    ref,
    type: entry.type as NodeType,
    title,
    data
  }
}

function sanitizeNodes(value: unknown, dropped: DroppedRecords): PlanNode[] {
  if (!Array.isArray(value)) {
    dropped.push('nodes:invalid_array')
    return []
  }

  const nodes: PlanNode[] = []
  const seenRefs = new Set<string>()

  value.forEach((entry, index) => {
    const node = sanitizeNode(entry, index, dropped)

    if (!node) {
      return
    }

    if (seenRefs.has(node.ref)) {
      dropped.push(`node:${formatRef(node.ref)}:duplicate_ref`)
      return
    }

    seenRefs.add(node.ref)
    nodes.push(node)
  })

  return nodes
}

function sanitizeEdge(entry: unknown, index: number, nodesByRef: ReadonlyMap<string, PlanNode>, dropped: DroppedRecords): PlanEdge | null {
  if (!isRecord(entry)) {
    dropped.push(`edge[${index}]:invalid_object`)
    return null
  }

  const source = sanitizeStringField(entry, 'source', `edge[${index}].source`, dropped)
  const target = sanitizeStringField(entry, 'target', `edge[${index}].target`, dropped)
  const edgeLabel = `${formatRef(source)}->${formatRef(target)}`

  if (!EDGE_TYPES.has(entry.edgeType as EdgeType)) {
    dropped.push(`edge:${edgeLabel}:unsupported_edge_type`)
    return null
  }

  const sourceNode = nodesByRef.get(source)
  const targetNode = nodesByRef.get(target)

  if (!sourceNode || !targetNode) {
    dropped.push(`edge:${edgeLabel}:missing_node`)
    return null
  }

  if (!canConnect(sourceNode.type, targetNode.type)) {
    dropped.push(`edge:${edgeLabel}:connection_rejected`)
    return null
  }

  const edge: PlanEdge = { source, target, edgeType: entry.edgeType as EdgeType }

  if (typeof entry.imageRole === 'string') {
    if (!IMAGE_ROLES.has(entry.imageRole as ImageRole)) {
      dropped.push(`edge:${edgeLabel}:unsupported_image_role`)
      return null
    }

    edge.imageRole = entry.imageRole as ImageRole
  }

  return edge
}

function sanitizeEdges(value: unknown, nodesByRef: ReadonlyMap<string, PlanNode>, dropped: DroppedRecords): PlanEdge[] {
  if (!Array.isArray(value)) {
    dropped.push('edges:invalid_array')
    return []
  }

  const edges: PlanEdge[] = []

  value.forEach((entry, index) => {
    const edge = sanitizeEdge(entry, index, nodesByRef, dropped)

    if (edge) {
      edges.push(edge)
    }
  })

  return edges
}

function sanitizeRunStep(entry: unknown, index: number, nodesByRef: ReadonlyMap<string, PlanNode>, dropped: DroppedRecords): PlanRunStep | null {
  if (!isRecord(entry)) {
    dropped.push(`runStep[${index}]:invalid_object`)
    return null
  }

  const ref = sanitizeStringField(entry, 'ref', `runStep[${index}].ref`, dropped)

  if (!RUN_ACTIONS.has(entry.action as RunAction)) {
    dropped.push(`runStep:${formatRef(ref)}:unsupported_action`)
    return null
  }

  if (!nodesByRef.has(ref)) {
    dropped.push(`runStep:${formatRef(ref)}:missing_node`)
    return null
  }

  return { ref, action: entry.action as RunAction }
}

function sanitizeRunSteps(value: unknown, nodesByRef: ReadonlyMap<string, PlanNode>, dropped: DroppedRecords): PlanRunStep[] {
  if (!Array.isArray(value)) {
    dropped.push('runSteps:invalid_array')
    return []
  }

  const runSteps: PlanRunStep[] = []

  value.forEach((entry, index) => {
    const runStep = sanitizeRunStep(entry, index, nodesByRef, dropped)

    if (runStep) {
      runSteps.push(runStep)
    }
  })

  return runSteps
}

function clarifyPlan(dropped: DroppedRecords): CanvasPlan {
  return {
    kind: 'clarify',
    summary: '',
    nodes: [],
    edges: [],
    runSteps: [],
    question: 'Please clarify the canvas workflow you want to create.',
    dropped
  }
}

/**
 * Converts untrusted planner output into a safe declarative CanvasPlan.
 * @param input - Unknown planner output, usually model/tool JSON.
 * @returns A sanitized CanvasPlan with all dropped records preserved for audit.
 * @see docs/api-contracts/canvas-plan.md
 */
export function sanitizePlan(input: unknown): CanvasPlan {
  const dropped: DroppedRecords = []

  if (!isRecord(input)) {
    return clarifyPlan(['plan:<root>:invalid_object'])
  }

  const inheritedDropped = sanitizeDroppedRecords(input.dropped, dropped)
  const kind: CanvasPlan['kind'] = input.kind === 'plan' || input.kind === 'clarify' ? input.kind : 'clarify'

  if (input.kind !== 'plan' && input.kind !== 'clarify') {
    dropped.push('kind:unsupported_value')
  }

  const summary = typeof input.summary === 'string' ? stripExecutableText(input.summary, 'summary', dropped) : ''

  if (typeof input.summary !== 'string') {
    dropped.push('summary:invalid_string')
  }

  const nodes = sanitizeNodes(input.nodes, dropped)
  const nodesByRef = new Map(nodes.map((node) => [node.ref, node]))
  const edges = sanitizeEdges(input.edges, nodesByRef, dropped)
  const runSteps = sanitizeRunSteps(input.runSteps, nodesByRef, dropped)
  const question = sanitizeOptionalQuestion(input.question, kind, dropped)

  return {
    kind,
    summary,
    nodes,
    edges,
    runSteps,
    question,
    dropped: [...inheritedDropped, ...dropped]
  }
}
