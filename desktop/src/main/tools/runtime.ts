/**
 * ToolRuntime for built-in and plugin tools.
 * @see docs/api-contracts/tools-plugins.md
 */

import { randomUUID } from 'node:crypto'

import type { z } from 'zod'

import type {
  PermissionDecision,
  ToolActor,
  ToolDescriptor,
  ToolError,
  ToolInvocationRecord,
  ToolPermissionResult,
  ToolProgress
} from '../../../../shared/tools'

export interface ToolInvocationInput {
  toolId: string
  input: unknown
  actor: ToolActor
  traceId: string
  approvedInvocation?: {
    toolId: string
    input: unknown
    approvedBy: ToolActor
  }
}

export interface ToolInvocationResult {
  record: ToolInvocationRecord
  output?: unknown
  error?: ToolError
  progress: ToolProgress[]
}

export interface ToolExecutionContext {
  actor: ToolActor
  traceId: string
  invocationId: string
}

export type ToolCallResult<TOutput> = AsyncGenerator<ToolProgress, TOutput> | Promise<TOutput> | TOutput

export interface ToolDefinition<TInput, TOutput> {
  descriptor: ToolDescriptor
  inputSchema: z.ZodType<TInput>
  outputSchema: z.ZodType<TOutput>
  renderToolUseMessage(input: TInput): string
  validateInput?(input: TInput, ctx: ToolExecutionContext): Promise<void> | void
  checkPermissions?(input: TInput, ctx: ToolExecutionContext): Promise<ToolPermissionResult> | ToolPermissionResult
  call(input: TInput, ctx: ToolExecutionContext): ToolCallResult<TOutput>
}

export interface ToolRuntimeOptions {
  tools?: ToolDefinition<unknown, unknown>[]
  permissionPolicy?: (tool: ToolDefinition<unknown, unknown>, input: unknown, ctx: ToolExecutionContext) => ToolPermissionResult
  idFactory?: () => string
  clock?: () => number
}

export interface ToolRuntime {
  list(includeDisabled?: boolean): ToolDescriptor[]
  register(tool: ToolDefinition<unknown, unknown>): void
  enable(toolId: string): ToolDescriptor | ToolError
  disable(toolId: string): ToolDescriptor | ToolError
  invoke(input: ToolInvocationInput): Promise<ToolInvocationResult>
}

export interface ToolExecutionErrorOptions {
  code: string
  message: string
  retryable?: boolean
  details?: Record<string, unknown>
}

export class ToolExecutionError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly details?: Record<string, unknown>

  /**
   * Creates a structured tool-domain error preserved by ToolRuntime.
   * @param options - Stable code, user-safe message, retry hint, and details.
   * @see docs/api-contracts/tools-plugins.md
   */
  constructor(options: ToolExecutionErrorOptions) {
    super(options.message)
    this.name = 'ToolExecutionError'
    this.code = options.code
    this.retryable = options.retryable ?? false
    if (options.details) {
      this.details = options.details
    }
  }
}

function defaultPermissionDecision(tool: ToolDefinition<unknown, unknown>): ToolPermissionResult {
  const decision: PermissionDecision = tool.descriptor.permissions.some((permission) => permission.kind === 'destructive') ? 'ask' : 'allow'

  return {
    decision,
    decisionReason: decision === 'allow' ? 'Allowed by default policy.' : 'Tool requires explicit confirmation.',
    requiredPermissions: tool.descriptor.permissions
  }
}

function toolError(errorClass: string, message: string, retryable = false, code?: string, details?: Record<string, unknown>): ToolError {
  return {
    errorClass,
    ...(code ? { code } : {}),
    message,
    retryable,
    ...(details ? { details } : {})
  }
}

function createRecord(input: ToolInvocationInput, invocationId: string, createdAt: number, status: ToolInvocationRecord['status']): ToolInvocationRecord {
  return {
    invocationId,
    toolId: input.toolId,
    actor: input.actor,
    traceId: input.traceId,
    status,
    createdAt
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value)
}

function hasMatchingApproval(input: ToolInvocationInput): boolean {
  return input.approvedInvocation?.toolId === input.toolId
    && stableJson(input.approvedInvocation.input) === stableJson(input.input)
}

function cloneDescriptor(descriptor: ToolDescriptor): ToolDescriptor {
  const owner: ToolDescriptor['owner'] =
    descriptor.owner.kind === 'builtin'
      ? { kind: 'builtin', id: descriptor.owner.id }
      : { kind: 'plugin', id: descriptor.owner.id }

  return {
    ...descriptor,
    owner,
    permissions: descriptor.permissions.map((permission) => ({ ...permission }))
  }
}

function cloneToolDefinition(tool: ToolDefinition<unknown, unknown>): ToolDefinition<unknown, unknown> {
  return {
    ...tool,
    descriptor: cloneDescriptor(tool.descriptor)
  }
}

/**
 * Defines a typed tool and preserves its input/output schema relationship.
 * @param tool - Tool definition.
 * @returns The same tool definition with erased runtime generic details.
 * @throws Error never intentionally; schema errors occur during invocation.
 * @see docs/api-contracts/tools-plugins.md
 */
export function defineTool<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): ToolDefinition<unknown, unknown> {
  return tool
}

function isAsyncGenerator<TOutput>(value: ToolCallResult<TOutput>): value is AsyncGenerator<ToolProgress, TOutput> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value
}

/**
 * Creates the ToolRuntime used by agents and plugin tools.
 * @param options - Tool list, permission policy, ID factory, and clock.
 * @returns Runtime facade for listing, registering, and invoking tools.
 * @throws Error never intentionally during construction; invocation returns safe error records.
 * @see docs/api-contracts/tools-plugins.md
 */
export function createToolRuntime(options: ToolRuntimeOptions = {}): ToolRuntime {
  const toolsById = new Map<string, ToolDefinition<unknown, unknown>>()
  const idFactory = options.idFactory ?? (() => `tool-invocation-${randomUUID()}`)
  const clock = options.clock ?? Date.now
  let writeChain: Promise<void> = Promise.resolve()

  for (const tool of options.tools ?? []) {
    const registered = cloneToolDefinition(tool)
    toolsById.set(registered.descriptor.id, registered)
  }

  async function execute(input: ToolInvocationInput): Promise<ToolInvocationResult> {
    const invocationId = idFactory()
    const createdAt = clock()
    const tool = toolsById.get(input.toolId)

    if (!tool || !tool.descriptor.enabled) {
      return {
        record: createRecord(input, invocationId, createdAt, 'failed'),
        error: toolError('tool_not_found', 'Tool is missing, disabled, or quarantined.'),
        progress: []
      }
    }

    const ctx: ToolExecutionContext = { actor: input.actor, traceId: input.traceId, invocationId }
    const parsed = tool.inputSchema.safeParse(input.input)

    if (!parsed.success) {
      return {
        record: createRecord(input, invocationId, createdAt, 'failed'),
        error: toolError('tool_input_invalid', 'Tool input failed schema validation.'),
        progress: []
      }
    }

    try {
      await tool.validateInput?.(parsed.data, ctx)
    } catch {
      // Validation exceptions become safe tool-input failures rather than leaking implementation details.
      return {
        record: createRecord(input, invocationId, createdAt, 'failed'),
        error: toolError('tool_input_invalid', 'Tool input failed schema validation.'),
        progress: []
      }
    }

    const permission = tool.checkPermissions
      ? await tool.checkPermissions(parsed.data, ctx)
      : (options.permissionPolicy?.(tool, parsed.data, ctx) ?? defaultPermissionDecision(tool))

    if (permission.decision === 'ask' && hasMatchingApproval(input)) {
      // A prior approval resumes the exact same tool call; execution still stays inside ToolRuntime.
    } else if (permission.decision !== 'allow') {
      return {
        record: createRecord(input, invocationId, createdAt, 'denied'),
        error: toolError('tool_permission_denied', permission.decisionReason, false, undefined, {
          decision: permission.decision,
          requiredPermissions: permission.requiredPermissions
        }),
        progress: []
      }
    }

    const progress: ToolProgress[] = []

    try {
      const result = tool.call(parsed.data, ctx)
      let output: unknown

      if (isAsyncGenerator(result)) {
        let next = await result.next()

        while (!next.done) {
          progress.push(next.value)
          next = await result.next()
        }

        output = next.value
      } else {
        output = await result
      }

      const parsedOutput = tool.outputSchema.parse(output)

      return {
        record: createRecord(input, invocationId, createdAt, 'completed'),
        output: parsedOutput,
        progress
      }
    } catch (error) {
      // Runtime failures are reported as safe tool errors; individual tools own user-facing messages.
      if (error instanceof ToolExecutionError) {
        return {
          record: createRecord(input, invocationId, createdAt, 'failed'),
          error: toolError('tool_runtime_failed', error.message, error.retryable, error.code, error.details),
          progress
        }
      }
      const message = error instanceof Error ? error.message : 'Tool execution failed.'
      return {
        record: createRecord(input, invocationId, createdAt, 'failed'),
        error: toolError('tool_runtime_failed', message),
        progress
      }
    }
  }

  return {
    list(includeDisabled = false) {
      return Array.from(toolsById.values())
        .map((tool) => cloneDescriptor(tool.descriptor))
        .filter((descriptor) => includeDisabled || descriptor.enabled)
    },
    register(tool) {
      const registered = cloneToolDefinition(tool)
      toolsById.set(registered.descriptor.id, registered)
    },
    enable(toolId) {
      const tool = toolsById.get(toolId)

      if (!tool) {
        return toolError('tool_not_found', 'Tool is missing, disabled, or quarantined.')
      }

      tool.descriptor = { ...tool.descriptor, enabled: true }
      return cloneDescriptor(tool.descriptor)
    },
    disable(toolId) {
      const tool = toolsById.get(toolId)

      if (!tool) {
        return toolError('tool_not_found', 'Tool is missing, disabled, or quarantined.')
      }

      tool.descriptor = { ...tool.descriptor, enabled: false }
      return cloneDescriptor(tool.descriptor)
    },
    invoke(input) {
      const tool = toolsById.get(input.toolId)

      if (tool?.descriptor.concurrency === 'serial-write' || tool?.descriptor.concurrency === 'exclusive') {
        const runAfterWrites = writeChain.then(() => execute(input))
        // Keep later writes moving even if this invocation fails.
        writeChain = runAfterWrites.then(
          () => undefined,
          () => undefined
        )
        return runAfterWrites
      }

      return execute(input)
    }
  }
}
