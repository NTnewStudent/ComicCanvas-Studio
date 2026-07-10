import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { ToolPermission } from '../shared/tools'
import { createToolRuntime, defineTool } from '../desktop/src/main/tools/runtime'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve() {
      resolvePromise?.()
    }
  }
}

const actor = { type: 'agent' as const, id: 'orchestrator' }

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (predicate()) {
      return
    }
    await Promise.resolve()
  }
}

describe('M4 ToolRuntime', () => {
  it('validates tool input and returns a safe failed invocation record', async () => {
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-1',
      clock: () => 1_782_800_000_000,
      tools: [
        defineTool({
          descriptor: {
            id: 'test.echo',
            name: 'Echo',
            description: 'Echoes validated text.',
            category: 'custom',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.echo.input',
            outputSchemaRef: 'test.echo.output',
            permissions: [],
            concurrency: 'readonly',
            enabled: true
          },
          inputSchema: z.object({ text: z.string() }),
          outputSchema: z.object({ text: z.string() }),
          renderToolUseMessage: (input) => `Echo ${input.text}`,
          call(input) {
            return { text: input.text }
          }
        })
      ]
    })

    const result = await runtime.invoke({
      toolId: 'test.echo',
      input: { text: 42 },
      actor,
      traceId: 'trace-1'
    })

    expect(result.record).toMatchObject({
      invocationId: 'invoke-1',
      toolId: 'test.echo',
      actor,
      traceId: 'trace-1',
      status: 'failed',
      createdAt: 1_782_800_000_000
    })
    expect(result.error).toEqual({
      errorClass: 'tool_input_invalid',
      message: 'Tool input failed schema validation.',
      retryable: false
    })
  })

  it('denies permissioned tools before calling them', async () => {
    let calls = 0
    const canvasWritePermission: ToolPermission = { kind: 'canvas.write', reason: 'Mutates the canvas graph.' }
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-2',
      clock: () => 1_782_800_000_100,
      permissionPolicy: () => ({
        decision: 'deny',
        decisionReason: 'Canvas writes are disabled for this agent.',
        requiredPermissions: [canvasWritePermission]
      }),
      tools: [
        defineTool({
          descriptor: {
            id: 'test.write',
            name: 'Write',
            description: 'Writes something.',
            category: 'canvas',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.write.input',
            outputSchemaRef: 'test.write.output',
            permissions: [canvasWritePermission],
            concurrency: 'serial-write',
            enabled: true
          },
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ ok: z.boolean() }),
          renderToolUseMessage: () => 'Write',
          call() {
            calls += 1
            return { ok: true }
          }
        })
      ]
    })

    const result = await runtime.invoke({
      toolId: 'test.write',
      input: { value: 'blocked' },
      actor,
      traceId: 'trace-2'
    })

    expect(calls).toBe(0)
    expect(result.record.status).toBe('denied')
    expect(result.error).toEqual({
      errorClass: 'tool_permission_denied',
      message: 'Canvas writes are disabled for this agent.',
      retryable: false,
      details: {
        decision: 'deny',
        requiredPermissions: [canvasWritePermission]
      }
    })
  })

  it('returns ask permission decisions as safe audit details without executing the tool', async () => {
    let calls = 0
    const canvasWritePermission: ToolPermission = { kind: 'canvas.write', reason: 'Mutates the canvas graph.' }
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-ask',
      clock: () => 1_782_800_000_150,
      permissionPolicy: () => ({
        decision: 'ask',
        decisionReason: 'Creating nodes requires confirmation.',
        requiredPermissions: [canvasWritePermission]
      }),
      tools: [
        defineTool({
          descriptor: {
            id: 'test.askWrite',
            name: 'Ask Write',
            description: 'Writes after confirmation.',
            category: 'canvas',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.askWrite.input',
            outputSchemaRef: 'test.askWrite.output',
            permissions: [canvasWritePermission],
            concurrency: 'serial-write',
            enabled: true
          },
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ ok: z.boolean() }),
          renderToolUseMessage: () => 'Ask write',
          call() {
            calls += 1
            return { ok: true }
          }
        })
      ]
    })

    const result = await runtime.invoke({
      toolId: 'test.askWrite',
      input: { value: 'needs approval' },
      actor,
      traceId: 'trace-ask'
    })

    expect(calls).toBe(0)
    expect(result.record.status).toBe('denied')
    expect(result.error).toEqual({
      errorClass: 'tool_permission_denied',
      message: 'Creating nodes requires confirmation.',
      retryable: false,
      details: {
        decision: 'ask',
        requiredPermissions: [canvasWritePermission]
      }
    })
  })

  it('reuses approved tool permissions for later matching calls in the same runtime session', async () => {
    let calls = 0
    const canvasWritePermission: ToolPermission = { kind: 'canvas.write', reason: 'Mutates the canvas graph.' }
    const runtime = createToolRuntime({
      idFactory: (() => {
        let next = 0
        return () => `invoke-approved-${(next += 1)}`
      })(),
      clock: () => 1_782_800_000_175,
      permissionPolicy: () => ({
        decision: 'ask',
        decisionReason: 'Creating nodes requires confirmation.',
        requiredPermissions: [canvasWritePermission]
      }),
      tools: [
        defineTool({
          descriptor: {
            id: 'test.askWrite',
            name: 'Ask Write',
            description: 'Writes after confirmation.',
            category: 'canvas',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.askWrite.input',
            outputSchemaRef: 'test.askWrite.output',
            permissions: [canvasWritePermission],
            concurrency: 'serial-write',
            enabled: true
          },
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ ok: z.boolean(), value: z.string() }),
          renderToolUseMessage: () => 'Ask write',
          call(input) {
            calls += 1
            return { ok: true, value: input.value }
          }
        })
      ]
    })

    const approved = await runtime.invoke({
      toolId: 'test.askWrite',
      input: { value: 'first approved call' },
      actor,
      traceId: 'trace-approved-first',
      approvedInvocation: {
        toolId: 'test.askWrite',
        input: { value: 'first approved call' },
        approvedBy: { type: 'user', id: 'user-local' }
      }
    })
    const reused = await runtime.invoke({
      toolId: 'test.askWrite',
      input: { value: 'second call' },
      actor,
      traceId: 'trace-approved-second'
    })

    expect(approved.record.status).toBe('completed')
    expect(reused.record.status).toBe('completed')
    expect(reused.output).toEqual({ ok: true, value: 'second call' })
    expect(calls).toBe(2)
  })

  it('keeps run-scoped approvals inside the approving run trace', async () => {
    let calls = 0
    const permission: ToolPermission = { kind: 'canvas.write', reason: 'Mutates the canvas graph.' }
    const runtime = createToolRuntime({
      permissionPolicy: () => ({
        decision: 'ask',
        decisionReason: 'Creating nodes requires confirmation.',
        requiredPermissions: [permission]
      }),
      tools: [
        defineTool({
          descriptor: {
            id: 'test.runScopedWrite',
            name: 'Run scoped write',
            description: 'Writes after run approval.',
            category: 'canvas',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.runScopedWrite.input',
            outputSchemaRef: 'test.runScopedWrite.output',
            permissions: [permission],
            concurrency: 'serial-write',
            enabled: true
          },
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ ok: z.boolean() }),
          renderToolUseMessage: () => 'Run scoped write',
          call() {
            calls += 1
            return { ok: true }
          }
        })
      ]
    })

    const approved = await runtime.invoke({
      toolId: 'test.runScopedWrite',
      input: { value: 'approved' },
      actor,
      traceId: 'run-1',
      approvedInvocation: {
        toolId: 'test.runScopedWrite',
        input: { value: 'approved' },
        approvedBy: { type: 'user', id: 'user-local' },
        scope: 'run'
      }
    })
    const sameRun = await runtime.invoke({
      toolId: 'test.runScopedWrite',
      input: { value: 'same run' },
      actor,
      traceId: 'run-1'
    })
    const otherRun = await runtime.invoke({
      toolId: 'test.runScopedWrite',
      input: { value: 'other run' },
      actor,
      traceId: 'run-2'
    })

    expect(approved.record.status).toBe('completed')
    expect(sameRun.record.status).toBe('completed')
    expect(otherRun.record.status).toBe('denied')
    expect(calls).toBe(2)
  })

  it('uses an injected grant store as the reusable approval source of truth', async () => {
    let calls = 0
    let hasChecks = 0
    const permission: ToolPermission = { kind: 'network', reason: 'Uses network.' }
    const runtime = createToolRuntime({
      permissionGrantStore: {
        remember() {},
        has() {
          hasChecks += 1
          return true
        }
      },
      permissionPolicy: () => ({
        decision: 'ask',
        decisionReason: 'Network access requires confirmation.',
        requiredPermissions: [permission]
      }),
      tools: [
        defineTool({
          descriptor: {
            id: 'test.persistedNetwork',
            name: 'Persisted network',
            description: 'Uses a persisted approval.',
            category: 'web',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.persistedNetwork.input',
            outputSchemaRef: 'test.persistedNetwork.output',
            permissions: [permission],
            concurrency: 'readonly',
            enabled: true
          },
          inputSchema: z.object({ query: z.string() }),
          outputSchema: z.object({ ok: z.boolean() }),
          renderToolUseMessage: () => 'Persisted network',
          call() {
            calls += 1
            return { ok: true }
          }
        })
      ]
    })

    const result = await runtime.invoke({
      toolId: 'test.persistedNetwork',
      input: { query: 'latest' },
      actor,
      traceId: 'run-persisted'
    })

    expect(result.record.status).toBe('completed')
    expect(hasChecks).toBe(1)
    expect(calls).toBe(1)
  })

  it('runs read-only tools in parallel and write tools serially', async () => {
    const starts: string[] = []
    const readOne = deferred()
    const readTwo = deferred()
    const writeOne = deferred()
    const writeTwo = deferred()
    const gates = new Map([
      ['read-1', readOne],
      ['read-2', readTwo],
      ['write-1', writeOne],
      ['write-2', writeTwo]
    ])
    const runtime = createToolRuntime({
      idFactory: (() => {
        let next = 0
        return () => `invoke-${(next += 1)}`
      })(),
      clock: () => 1_782_800_000_200,
      tools: [
        defineTool({
          descriptor: {
            id: 'test.read',
            name: 'Read',
            description: 'Reads concurrently.',
            category: 'custom',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.read.input',
            outputSchemaRef: 'test.read.output',
            permissions: [],
            concurrency: 'readonly',
            enabled: true
          },
          inputSchema: z.object({ id: z.string() }),
          outputSchema: z.object({ id: z.string() }),
          renderToolUseMessage: (input) => `Read ${input.id}`,
          async *call(input) {
            starts.push(input.id)
            yield { message: `started ${input.id}`, progress: 10 }
            await gates.get(input.id)?.promise
            return { id: input.id }
          }
        }),
        defineTool({
          descriptor: {
            id: 'test.write',
            name: 'Write',
            description: 'Writes serially.',
            category: 'custom',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.write.input',
            outputSchemaRef: 'test.write.output',
            permissions: [{ kind: 'canvas.write', reason: 'Mutates state.' }],
            concurrency: 'serial-write',
            enabled: true
          },
          inputSchema: z.object({ id: z.string() }),
          outputSchema: z.object({ id: z.string() }),
          renderToolUseMessage: (input) => `Write ${input.id}`,
          async *call(input) {
            starts.push(input.id)
            yield { message: `started ${input.id}`, progress: 10 }
            await gates.get(input.id)?.promise
            return { id: input.id }
          }
        })
      ]
    })

    const readA = runtime.invoke({ toolId: 'test.read', input: { id: 'read-1' }, actor, traceId: 'trace-read-1' })
    const readB = runtime.invoke({ toolId: 'test.read', input: { id: 'read-2' }, actor, traceId: 'trace-read-2' })
    await Promise.resolve()
    expect(starts).toEqual(['read-1', 'read-2'])
    readOne.resolve()
    readTwo.resolve()
    await Promise.all([readA, readB])

    starts.length = 0
    const writeA = runtime.invoke({ toolId: 'test.write', input: { id: 'write-1' }, actor, traceId: 'trace-write-1' })
    const writeB = runtime.invoke({ toolId: 'test.write', input: { id: 'write-2' }, actor, traceId: 'trace-write-2' })
    await waitFor(() => starts.length > 0)
    expect(starts).toEqual(['write-1'])
    writeOne.resolve()
    await writeA
    await waitFor(() => starts.length > 1)
    expect(starts).toEqual(['write-1', 'write-2'])
    writeTwo.resolve()
    await writeB
  })

  it('disables and re-enables tools before invocation', async () => {
    let calls = 0
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-toggle',
      clock: () => 1_782_800_000_300,
      tools: [
        defineTool({
          descriptor: {
            id: 'test.toggle',
            name: 'Toggle',
            description: 'Can be disabled from settings.',
            category: 'custom',
            owner: { kind: 'builtin', id: 'core' },
            inputSchemaRef: 'test.toggle.input',
            outputSchemaRef: 'test.toggle.output',
            permissions: [],
            concurrency: 'readonly',
            enabled: true
          },
          inputSchema: z.object({}),
          outputSchema: z.object({ ok: z.boolean() }),
          renderToolUseMessage: () => 'Toggle',
          call() {
            calls += 1
            return { ok: true }
          }
        })
      ]
    })

    expect(runtime.disable('test.toggle')).toMatchObject({ id: 'test.toggle', enabled: false })
    expect(runtime.list(true).find((tool) => tool.id === 'test.toggle')).toMatchObject({ enabled: false })

    const disabled = await runtime.invoke({
      toolId: 'test.toggle',
      input: {},
      actor,
      traceId: 'trace-disabled'
    })

    expect(disabled.record.status).toBe('failed')
    expect(disabled.error).toMatchObject({ errorClass: 'tool_not_found' })
    expect(calls).toBe(0)

    expect(runtime.enable('test.toggle')).toMatchObject({ id: 'test.toggle', enabled: true })

    const enabled = await runtime.invoke({
      toolId: 'test.toggle',
      input: {},
      actor,
      traceId: 'trace-enabled'
    })

    expect(enabled.record.status).toBe('completed')
    expect(calls).toBe(1)
  })
})
