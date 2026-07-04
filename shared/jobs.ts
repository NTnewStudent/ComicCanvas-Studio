/**
 * Durable job runtime contracts shared by renderer, main process, and agent code.
 * @see docs/api-contracts/jobs.md
 */

import type { AgentResponse } from './agents'

export type JobType =
  | 'canvas.generateImage'
  | 'canvas.generateVideo'
  | 'canvas.polishText'
  | 'canvas.generateAudio'
  | 'canvas.composeVideo'
  | 'canvas.upscaleVideo'
  | 'canvas.muxAudioVideo'
  | 'agent.run'
  | 'gateway.test'
  | 'knowledge.ingest'
  | 'knowledge.rebuild'
  | 'plugin.reload'
  | 'skill.reload'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'canceled'

export type JobActorType = 'user' | 'agent' | 'system'

export interface JobActor {
  type: JobActorType
  id: string
}

export interface JobCreateInput {
  type: JobType
  targetId?: string
  payload: Record<string, unknown>
  requestedBy: JobActor
  idempotencyKey?: string
}

export interface JobTicket {
  jobId: string
  status: 'pending'
  createdAt: number
}

export interface JobError {
  errorClass: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export type JobResult =
  | { kind: 'asset'; assetId: string; metadata?: Record<string, unknown> }
  | { kind: 'text'; text: string; usage?: Record<string, unknown> }
  | { kind: 'agentRun'; runId: string; planId?: string; response?: AgentResponse }
  | { kind: 'report'; summary: string; data?: Record<string, unknown> }

export interface JobRecord {
  id: string
  type: JobType
  status: JobStatus
  targetId?: string
  progress: number
  result?: JobResult
  error?: JobError
  createdAt: number
  updatedAt: number
}

export interface JobListFilter {
  status?: JobStatus
  type?: JobType
  targetId?: string
  limit?: number
}

export type JobTerminalEvent =
  | { channel: 'job.completed'; jobId: string; result: JobResult; emittedAt: number }
  | { channel: 'job.failed'; jobId: string; error: JobError; emittedAt: number }

export interface JobProgressEvent {
  channel: 'job.progress'
  jobId: string
  progress: number
  message?: string
  emittedAt: number
}

export interface JobRecoveryReport {
  inspected: number
  requeued: string[]
  failed: string[]
}
