/**
 * Append-only Agent Run Spine event repository.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'
import { z } from 'zod'

import {
  AGENT_ARTIFACT_KINDS,
  AGENT_RUN_EVENT_TYPES,
  type AgentRunEventPayloadMap,
  type AgentRunEventRecord,
  type AgentRunEventType
} from '../../../../../shared/agent-run-events'
import {
  decodeJson,
  encodeJson
} from './json'

interface AgentRunEventRow {
  id: string
  run_id: string
  sequence: number
  type: string
  payload_json: string
  created_at: number
}

const AGENT_RUN_EVENT_TYPE_SET = new Set<string>(AGENT_RUN_EVENT_TYPES)
const stringArraySchema = z.array(z.string())
const permissionSchema = z.object({
  kind: z.enum([
    'canvas.read',
    'canvas.write',
    'file.read',
    'file.write',
    'network',
    'provider.spend',
    'destructive',
    'diagnostics'
  ]),
  reason: z.string()
})
const responseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('answer'),
    summary: z.string(),
    text: z.string(),
    dropped: stringArraySchema
  }),
  z.object({
    type: z.literal('clarification'),
    summary: z.string(),
    question: z.string(),
    missing: stringArraySchema,
    dropped: stringArraySchema
  })
])
const EVENT_PAYLOAD_SCHEMAS = {
  'run.created': z.object({
    threadId: z.string(),
    workflowId: z.string(),
    agentId: z.string(),
    trigger: z.enum(['manual', 'mention', 'canvasChat', 'workflowEvent']),
    messageId: z.string(),
    jobId: z.string().optional(),
    policyProfileId: z.string(),
    gatewayId: z.string().optional(),
    modelId: z.string().optional()
  }),
  'run.started': z.object({
    status: z.literal('running'),
    jobId: z.string().optional(),
    resumedFromApproval: z.boolean().optional()
  }),
  'intent.analyzed': z.object({
    kind: z.enum([
      'smallTalk',
      'generalChat',
      'searchSummary',
      'requirementPlanning',
      'canvasOperation',
      'clarify'
    ]),
    summary: z.string(),
    requirements: stringArraySchema,
    missing: stringArraySchema,
    localCapabilities: stringArraySchema,
    recommendedAgentId: z.enum(['general-purpose', 'canvas-orchestrator']),
    executionMode: z.enum(['clarify', 'plan', 'direct']),
    complexity: z.enum(['low', 'medium', 'high'])
  }),
  'context.built': z.object({
    contextPackId: z.string(),
    tokenEstimate: z.number(),
    messagesIncluded: z.number(),
    sourceCount: z.number(),
    redactionCount: z.number()
  }),
  progress: z.object({
    message: z.string(),
    progress: z.number()
  }),
  'model.delta': z.object({ delta: z.string() }),
  'tool.started': z.object({
    callId: z.string(),
    toolId: z.string(),
    inputSummary: z.string().optional()
  }),
  'tool.completed': z.object({
    callId: z.string(),
    toolId: z.string(),
    invocationId: z.string().optional(),
    status: z.enum(['completed', 'failed', 'denied']),
    summary: z.string()
  }),
  'child.started': z.object({
    childTaskId: z.string(), roleId: z.string(), inputSummary: z.string(), effectiveTools: stringArraySchema
  }),
  'child.completed': z.object({
    childTaskId: z.string(), roleId: z.string(), outputSummary: z.string(), artifactIds: stringArraySchema
  }),
  'child.failed': z.object({
    childTaskId: z.string(), roleId: z.string(), errorClass: z.string(), outputSummary: z.string().optional(), artifactIds: stringArraySchema
  }),
  'permission.requested': z.object({
    callId: z.string(),
    toolId: z.string(),
    reason: z.string(),
    requiredPermissions: z.array(permissionSchema),
    inputSummary: z.string().optional()
  }),
  'permission.resolved': z.object({
    callId: z.string(),
    decision: z.enum(['approved', 'denied']),
    approvedByLabel: z.string().optional(),
    deniedByLabel: z.string().optional(),
    scope: z.enum(['once', 'run', 'session']).optional(),
    requestedScope: z.enum(['once', 'run', 'session']).optional(),
    phase: z.enum(['queued', 'executing']).optional()
  }),
  'artifact.created': z.object({
    artifactId: z.string(),
    kind: z.enum(AGENT_ARTIFACT_KINDS),
    title: z.string(),
    summary: z.string()
  }),
  'plan.ready': z.object({
    messageId: z.string(),
    planId: z.string()
  }),
  'response.ready': z.object({
    messageId: z.string(),
    response: responseSchema
  }),
  'run.completed': z.object({ status: z.literal('completed') }),
  'run.failed': z.object({
    errorClass: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    checkpoint: z.string().optional()
  })
} satisfies Record<AgentRunEventType, z.ZodType>

/** Data required to append one immutable run event. */
export type AgentRunEventAppendInput<Type extends AgentRunEventType = AgentRunEventType> = {
  [EventType in Type]: {
    id: string
    runId: string
    type: EventType
    payload: AgentRunEventPayloadMap[EventType]
    createdAt: number
  }
}[Type]

/** Append and replay operations for one run's immutable event stream. */
export interface AgentRunEventRepository {
  append(input: AgentRunEventAppendInput): AgentRunEventRecord
  listByRunId(runId: string): AgentRunEventRecord[]
}

function decodePayload<Type extends AgentRunEventType>(
  payloadJson: string,
  schema: z.ZodType,
  fallback: AgentRunEventPayloadMap[Type]
): AgentRunEventPayloadMap[Type] {
  try {
    const decoded = decodeJson<unknown>(payloadJson)
    const result = schema.safeParse(decoded)
    return result.success ? result.data as AgentRunEventPayloadMap[Type] : fallback
  } catch {
    // Corrupt durable JSON must degrade to visible replay data instead of aborting the stream.
    return fallback
  }
}

function createRecord<Type extends AgentRunEventType>(
  row: AgentRunEventRow,
  type: Type,
  schema: z.ZodType,
  fallback: AgentRunEventPayloadMap[Type]
): AgentRunEventRecord<Type> {
  return {
    id: row.id,
    runId: row.run_id,
    sequence: row.sequence,
    type,
    payload: decodePayload(row.payload_json, schema, fallback),
    createdAt: row.created_at
  }
}

function isAgentRunEventType(type: string): type is AgentRunEventType {
  return AGENT_RUN_EVENT_TYPE_SET.has(type)
}

function rowToRecord(row: AgentRunEventRow): AgentRunEventRecord | null {
  if (!isAgentRunEventType(row.type)) {
    return null
  }

  switch (row.type) {
    case 'run.created':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        threadId: 'unavailable',
        workflowId: 'unavailable',
        agentId: 'unavailable',
        trigger: 'manual',
        messageId: 'unavailable',
        policyProfileId: 'unavailable'
      })
    case 'run.started':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], { status: 'running' })
    case 'intent.analyzed':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        kind: 'clarify',
        summary: 'Event payload unavailable.',
        requirements: [],
        missing: [],
        localCapabilities: [],
        recommendedAgentId: 'general-purpose',
        executionMode: 'clarify',
        complexity: 'low'
      })
    case 'context.built':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        contextPackId: 'unavailable',
        tokenEstimate: 0,
        messagesIncluded: 0,
        sourceCount: 0,
        redactionCount: 0
      })
    case 'progress':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        message: 'Event payload unavailable.',
        progress: 0
      })
    case 'model.delta':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        delta: 'Event payload unavailable.'
      })
    case 'tool.started':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        callId: 'unavailable',
        toolId: 'unavailable',
        inputSummary: 'Event payload unavailable.'
      })
    case 'tool.completed':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        callId: 'unavailable',
        toolId: 'unavailable',
        status: 'failed',
        summary: 'Event payload unavailable.'
      })
    case 'child.started':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        childTaskId: 'unavailable', roleId: 'unavailable', inputSummary: 'Event payload unavailable.', effectiveTools: []
      })
    case 'child.completed':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        childTaskId: 'unavailable', roleId: 'unavailable', outputSummary: 'Event payload unavailable.', artifactIds: []
      })
    case 'child.failed':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        childTaskId: 'unavailable', roleId: 'unavailable', errorClass: 'event_payload_unavailable', artifactIds: []
      })
    case 'permission.requested':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        callId: 'unavailable',
        toolId: 'unavailable',
        reason: 'Event payload unavailable.',
        requiredPermissions: []
      })
    case 'permission.resolved':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        callId: 'unavailable',
        decision: 'denied',
        deniedByLabel: 'Event payload unavailable.'
      })
    case 'artifact.created':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        artifactId: 'unavailable',
        kind: 'diagnosticReport',
        title: 'Unavailable artifact',
        summary: 'Event payload unavailable.'
      })
    case 'plan.ready':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        messageId: 'unavailable',
        planId: 'unavailable'
      })
    case 'response.ready':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        messageId: 'unavailable',
        response: {
          type: 'answer',
          summary: 'Event payload unavailable.',
          text: 'Event payload unavailable.',
          dropped: []
        }
      })
    case 'run.completed':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        status: 'completed'
      })
    case 'run.failed':
      return createRecord(row, row.type, EVENT_PAYLOAD_SCHEMAS[row.type], {
        errorClass: 'event_payload_unavailable',
        message: 'Event payload unavailable.',
        retryable: false
      })
  }
}

/**
 * Creates the append-only event repository.
 * @param db - Open SQLite database handle.
 * @returns Event append and ordered replay operations.
 * @throws Error when an event ID or run sequence violates persistence invariants.
 * @see docs/api-contracts/agents.md
 */
export function createAgentRunEventRepository(db: BetterSqliteDatabase): AgentRunEventRepository {
  const appendEvent = db.prepare(`
    INSERT INTO agent_run_events (id, run_id, sequence, type, payload_json, created_at)
    SELECT @id, @runId, COALESCE(MAX(sequence), 0) + 1, @type, @payloadJson, @createdAt
    FROM agent_run_events
    WHERE run_id = @runId
  `)
  const selectById = db.prepare('SELECT * FROM agent_run_events WHERE id = ?')
  const selectByRun = db.prepare('SELECT * FROM agent_run_events WHERE run_id = ? ORDER BY sequence ASC')

  return {
    append(input) {
      appendEvent.run({
        id: input.id,
        runId: input.runId,
        type: input.type,
        payloadJson: encodeJson(input.payload),
        createdAt: input.createdAt
      })

      const row = selectById.get(input.id) as AgentRunEventRow | undefined
      if (!row) {
        // An acknowledged insert without a readable event would make replay incomplete.
        throw new Error(`Agent run event was not persisted: ${input.id}`)
      }

      const record = rowToRecord(row)
      if (!record) {
        // Repository writes only known event types, so an invalid read-back signals corruption.
        throw new Error(`Agent run event has an invalid persisted type: ${row.type}`)
      }
      return record
    },
    listByRunId(runId) {
      const records: AgentRunEventRecord[] = []
      for (const row of selectByRun.all(runId) as AgentRunEventRow[]) {
        const record = rowToRecord(row)
        if (record) {
          records.push(record)
        }
      }
      return records
    }
  }
}
