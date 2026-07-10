import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { AgentResponse } from '../shared/agents'
import { projectAgentRunSnapshot } from '../shared/agent-run-projector'
import type { CanvasPlan } from '../shared/plan'
import type { ToolDescriptor } from '../shared/tools'
import { createAgentRunSpine } from '../desktop/src/main/agent/run-spine'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentArtifactRepository } from '../desktop/src/main/db/repositories/agent-artifact.repo'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'
import { createAgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'
import { createAgentRunRepository } from '../desktop/src/main/db/repositories/agent-run.repo'
import { createChildAgentTaskRepository } from '../desktop/src/main/db/repositories/child-agent-task.repo'
import { createJobRepository } from '../desktop/src/main/db/repositories/job.repo'
import { createJobEventBus } from '../desktop/src/main/jobs/events'
import { createJobQueue } from '../desktop/src/main/jobs/queue'
import { createJobWorker } from '../desktop/src/main/jobs/worker'
import { createDefaultOrchestratorPlanner, createOrchestratorRuntime, runOrchestrator } from '../desktop/src/main/agent/orchestrator'
import { createGatewayAgentPlanner } from '../desktop/src/main/agent/gateway-loop-model'
import { createToolRuntime, defineTool } from '../desktop/src/main/tools/runtime'

const samplePlan: CanvasPlan = {
  kind: 'plan',
  summary: 'Create one image node for a spaceship scene.',
  nodes: [
    {
      ref: 'prompt-1',
      type: 'text',
      title: 'Prompt',
      data: {
        content: '宇宙飞船穿过金色星云'
      }
    },
    {
      ref: 'image-1',
      type: 'imageConfigV2',
      title: '宇宙飞船',
      data: {
        promptOverride: '宇宙飞船穿过金色星云',
        modelId: 'stub-image',
        orientation: 'landscape'
      }
    }
  ],
  edges: [{ source: 'prompt-1', target: 'image-1', edgeType: 'promptOrder' }],
  runSteps: [{ ref: 'image-1', action: 'imageRun' }],
  question: null,
  dropped: []
}

const queryGraphTool: ToolDescriptor = {
  id: 'canvas.queryGraph',
  name: 'Query graph',
  description: 'Reads graph.',
  category: 'canvas',
  owner: { kind: 'builtin', id: 'core' },
  inputSchemaRef: 'canvas.queryGraph.input',
  outputSchemaRef: 'canvas.queryGraph.output',
  permissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }],
  concurrency: 'readonly',
  enabled: true
}

const writeTool: ToolDescriptor = {
  id: 'canvas.createNode',
  name: 'Create node',
  description: 'Writes graph.',
  category: 'canvas',
  owner: { kind: 'builtin', id: 'core' },
  inputSchemaRef: 'canvas.createNode.input',
  outputSchemaRef: 'canvas.createNode.output',
  permissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }],
  concurrency: 'serial-write',
  enabled: true
}

afterEach(() => {
  vi.useRealTimers()
})

function createDeferredResponse(): { promise: Promise<AgentResponse>; resolve: (response: AgentResponse) => void } {
  let resolveResponse: ((response: AgentResponse) => void) | undefined
  const promise = new Promise<AgentResponse>((resolve) => {
    resolveResponse = resolve
  })

  return {
    promise,
    resolve(response) {
      resolveResponse?.(response)
    }
  }
}

describe('M4 orchestrator AsyncGenerator runtime', () => {
  it('answers low-signal greetings without creating canvas nodes', () => {
    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-greeting',
      messageId: 'message-greeting',
      message: '你好',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response).toMatchObject({
      type: 'answer',
      summary: '用户只是打招呼或进行低负担寒暄。',
      dropped: []
    })
    expect(response.type).toBe('answer')
    if (response.type !== 'answer') throw new Error('expected_answer_response')
    expect(response.text).toContain('你好')
    expect(response.text).toContain('画布')
  })

  it('returns a visible search capability gap when no web search tool has run', () => {
    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-search',
      messageId: 'message-search',
      message: '搜索一下今天 OpenAI 最新新闻',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response).toMatchObject({
      type: 'answer',
      summary: '用户提出了依赖当前互联网信息的问题。',
      dropped: ['web.search:not_executed']
    })
    expect(response.type).toBe('answer')
    if (response.type !== 'answer') throw new Error('expected_search_gap_answer')
    expect(response.text).toContain('联网搜索')
    expect(response.text).toContain('没有执行')
  })

  it('does not turn current canvas read requests into generation plans in deterministic fallback', () => {
    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-current-canvas-query',
      messageId: 'message-current-canvas-query',
      message: '查一下当前画布有哪些节点',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response).toMatchObject({
      type: 'answer',
      summary: '用户请求读取当前画布状态。',
      dropped: ['canvas.queryGraph:not_executed']
    })
    expect(response.type).toBe('answer')
    if (response.type !== 'answer') throw new Error('expected_canvas_query_answer')
    expect(response.text).toContain('当前画布')
    expect(response.text).toContain('不会创建')
  })

  it('asks one key question for system capability design requests', () => {
    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-planning',
      messageId: 'message-planning',
      message: '帮我设计当前系统的 Agent 能力',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response).toMatchObject({
      type: 'clarification',
      summary: '用户提出了系统能力或产品方案设计请求。',
      missing: ['成功标准', '执行边界', '是否允许改代码']
    })
    expect(response.type).toBe('clarification')
    if (response.type !== 'clarification') throw new Error('expected_requirement_planning_clarification')
    expect(response.question).toContain('优先')
  })

  it('asks for task type when the request is too vague to route safely', () => {
    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-clarify',
      messageId: 'message-clarify',
      message: '帮我弄一下',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response).toMatchObject({
      type: 'clarification',
      question: '请补充你希望我完成的任务类型：聊天、联网总结、需求分析，或操作当前画布。',
      missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束']
    })
    expect(response.type).toBe('clarification')
    if (response.type !== 'clarification') throw new Error('expected_clarify_response')
  })

  it('answers ordinary non-canvas questions as an answer response without asking for canvas task details', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-30T12:00:00+08:00'))

    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-weekday',
      messageId: 'message-weekday',
      message: '今天星期几',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response).toMatchObject({
      type: 'answer',
      summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
      text: '今天是星期二。',
      dropped: []
    })
    expect(response.type).toBe('answer')
    if (response.type !== 'answer') {
      throw new Error('expected_answer_response')
    }
    expect(response.text).not.toContain('请补充')
    expect(response.text).not.toContain('任务类型')
    expect(response.text).not.toContain('目标产物')
  })

  it('answers tomorrow weekday questions locally', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00+08:00'))

    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-tomorrow-weekday',
      messageId: 'message-tomorrow-weekday',
      message: '明天星期几',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response).toMatchObject({
      type: 'answer',
      summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
      text: '明天是星期四。',
      dropped: []
    })
  })

  it('creates a direct text-node plan for simple text node requests without generation run steps', () => {
    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-direct-text',
      messageId: 'message-direct-text',
      message: '创建一个文本节点',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response).toMatchObject({
      type: 'canvasPlan',
      plan: {
        kind: 'plan',
        summary: 'Directly create one text node for: 创建一个文本节点',
        nodes: [{ ref: 'text-1', type: 'text', title: '文本节点', data: { label: '文本节点', content: '创建一个文本节点' } }],
        edges: [],
        runSteps: [],
        question: null,
        dropped: []
      }
    })
  })

  it('keeps direct image and video node requests as reference nodes instead of generation nodes', () => {
    const imageResponse = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-direct-image',
      messageId: 'message-direct-image',
      message: '创建一个图片节点',
      agentId: 'general-purpose',
    }) as AgentResponse
    const videoResponse = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-direct-video',
      messageId: 'message-direct-video',
      message: '创建一个视频节点',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(imageResponse.type).toBe('canvasPlan')
    expect(videoResponse.type).toBe('canvasPlan')
    expect(imageResponse.type === 'canvasPlan' ? imageResponse.plan.nodes.map((node) => node.type) : []).toEqual(['image'])
    expect(videoResponse.type === 'canvasPlan' ? videoResponse.plan.nodes.map((node) => node.type) : []).toEqual(['video'])
    expect(imageResponse.type === 'canvasPlan' ? imageResponse.plan.runSteps : []).toEqual([])
    expect(videoResponse.type === 'canvasPlan' ? videoResponse.plan.runSteps : []).toEqual([])
  })

  it('routes explicit image generation requests through imageConfigV2 generation nodes', () => {
    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-generate-image',
      messageId: 'message-generate-image',
      message: '生成图片',
      agentId: 'general-purpose',
    }) as AgentResponse

    expect(response.type).toBe('canvasPlan')
    expect(response.type === 'canvasPlan' ? response.plan.nodes.map((node) => node.type) : []).toEqual(['text', 'imageConfigV2'])
    expect(response.type === 'canvasPlan' ? response.plan.runSteps : []).toEqual([{ ref: 'image-1', action: 'imageRun' }])
  })

  it('defaults comic-drama requests to migrated context plus image/video generation config run vocabulary', () => {
    const response = createDefaultOrchestratorPlanner().proposePlan({
      runId: 'run-comic',
      messageId: 'message-comic',
      message: '做一个雨夜侦探漫画短剧，包含角色、场景、图片、配音、视频合成和音视频合成',
      agentId: 'orchestrator',
    }) as AgentResponse

    expect(response.type).toBe('canvasPlan')
    const plan = response.type === 'canvasPlan' ? response.plan : null
    expect(plan).not.toBeNull()
    if (!plan) {
      throw new Error('expected_canvas_plan')
    }
    expect(plan.kind).toBe('plan')
    expect(plan.question).toBeNull()
    expect(plan.nodes.map((node) => node.type)).toEqual([
      'text',
      'character',
      'scene',
      'imageConfigV2',
      'videoConfigV2',
      'audio',
      'videoCompose',
      'muxAudioVideo',
    ])
    expect(plan.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'story', target: 'character' }),
        expect.objectContaining({ source: 'story', target: 'scene' }),
        expect.objectContaining({ source: 'character', target: 'key-image' }),
        expect.objectContaining({ source: 'scene', target: 'key-image' }),
        expect.objectContaining({ source: 'key-image', target: 'video-gen' }),
        expect.objectContaining({ source: 'video-gen', target: 'compose' }),
        expect.objectContaining({ source: 'voice', target: 'mux' }),
      ])
    )
    expect(plan.runSteps).toEqual([
      { ref: 'key-image', action: 'imageRun' },
      { ref: 'video-gen', action: 'videoRun' },
    ])
    expect(JSON.stringify(plan)).not.toMatch(/onRun|function|window\.|eval/u)
  })

  it('runs as an AsyncGenerator and returns a CanvasPlan after streaming progress', async () => {
    const stream = runOrchestrator({
      runId: 'run-1',
      messageId: 'message-1',
      message: '生成宇宙飞船图片节点',
      agentId: 'orchestrator',
      planIdFactory: () => 'plan-1',
      planner: {
        async *proposePlan() {
          await Promise.resolve()
          yield { type: 'progress', message: 'Analyzing request', progress: 20 }
          yield { type: 'progress', message: 'Drafting CanvasPlan', progress: 80 }
          return { type: 'canvasPlan', plan: samplePlan }
        }
      }
    })
    const events: unknown[] = []
    let next = await stream.next()

    while (!next.done) {
      events.push(next.value)
      next = await stream.next()
    }

    expect(events).toEqual([
      { type: 'progress', runId: 'run-1', message: 'Starting orchestration', progress: 5 },
      { type: 'progress', runId: 'run-1', message: '理解输入：用户提出了明确的画布或生成工作流需求。；复杂度=high；先提供任务计划；将交给 canvas-orchestrator。', progress: 15 },
      { type: 'progress', runId: 'run-1', message: '检查本地能力：canvas.queryGraph、canvas.proposePlan、canvas.createNode、canvas.connectNodes、canvas.runNode', progress: 25 },
      { type: 'progress', runId: 'run-1', message: 'Analyzing request', progress: 20 },
      { type: 'progress', runId: 'run-1', message: 'Drafting CanvasPlan', progress: 80 },
      { type: 'plan', runId: 'run-1', messageId: 'message-1', planId: 'plan-1', plan: samplePlan }
    ])
    expect(next.value).toEqual({
      runId: 'run-1',
      messageId: 'message-1',
      planId: 'plan-1',
      response: { type: 'canvasPlan', plan: samplePlan },
      plan: samplePlan
    })
  })

  it('returns a pending chat ticket before model work and stores the plan after the agent job completes', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-orchestrator-'))
    const dbPath = join(tempDir, 'orchestrator.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const jobs = createJobRepository(db)
      const events = createJobEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-agent-1',
        clock: () => 1_782_700_000_000
      })
      const deferred = createDeferredResponse()
      let plannerStarted = false
      let plannerLoopToolIds: string[] = []
      let plannerLoopMessages: string[] = []
      const runtime = createOrchestratorRuntime({
        queue,
        events,
        listTools: () => [queryGraphTool],
        idFactory: (prefix) => `${prefix}-1`,
        planIdFactory: () => 'plan-async-1',
        planner: {
          async proposePlan(input) {
            plannerStarted = true
            plannerLoopToolIds = input.loop?.allowedTools.map((tool) => tool.id) ?? []
            plannerLoopMessages = input.loop?.messages.map((message) => message.content) ?? []
            return deferred.promise
          }
        }
      })
      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'agent-worker',
        clock: () => 1_782_700_000_010,
        handlers: {
          'agent.run': runtime.createJobHandler()
        }
      })

      const ticket = runtime.chatSend({ message: '生成宇宙飞船图片节点', agentId: 'orchestrator', requestedBy: 'user-1' })

      expect(ticket).toEqual({ runId: 'run-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' })
      expect(runtime.getRun('run-1')).toMatchObject({
        runId: 'run-1',
        status: 'pending',
        trace: {
          intentAnalysis: {
            kind: 'canvasOperation',
            requirements: ['Generate image configuration nodes.']
          }
        }
      })
      expect(plannerStarted).toBe(false)
      expect(runtime.getPlan('message-1')).toBeNull()

      const running = worker.runNext()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(plannerStarted).toBe(true)
      expect(plannerLoopToolIds).toEqual(['canvas.queryGraph'])
      expect(plannerLoopMessages).toEqual(expect.arrayContaining(['生成宇宙飞船图片节点']))

      deferred.resolve({ type: 'canvasPlan', plan: samplePlan })
      expect(await running).toBe('job-agent-1')

      expect(runtime.getPlan('message-1')).toEqual(samplePlan)
      expect(jobs.getById('job-agent-1')?.result).toEqual({ kind: 'agentRun', runId: 'run-1', planId: 'plan-async-1' })
      expect(events.getTerminalEvents()).toEqual([
        {
          channel: 'job.completed',
          jobId: 'job-agent-1',
          result: { kind: 'agentRun', runId: 'run-1', planId: 'plan-async-1' },
          emittedAt: 1_782_700_000_010
        }
      ])
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('runs agent.run tickets through the selected agent policy and context override', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agent-run-'))
    const dbPath = join(tempDir, 'agent-run.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const jobs = createJobRepository(db)
      const agentRuns = createAgentRunRepository(db)
      const events = createJobEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-agent-run-1',
        clock: () => 1_782_700_001_000
      })
      let plannerContextBudget = 0
      const runtime = createOrchestratorRuntime({
        queue,
        events,
        listTools: () => [queryGraphTool],
        idFactory: (prefix) => `${prefix}-agent-run-1`,
        planIdFactory: () => 'plan-agent-run-1',
        planner: {
          proposePlan(input) {
            plannerContextBudget = input.loop?.tokenEstimate ?? -1
            expect(input.agent?.contextPolicy.maxContextTokens).toBe(32)
            expect(input.trigger).toBe('canvasChat')
          return { type: 'canvasPlan', plan: samplePlan }
          }
        },
        agentRuns
      })
      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'agent-run-worker',
        clock: () => 1_782_700_001_010,
        handlers: {
          'agent.run': runtime.createJobHandler()
        }
      })

      const ticket = runtime.agentRun({
        agentId: 'orchestrator',
        message: '生成宇宙飞船图片节点',
        contextPolicyOverride: { maxContextTokens: 32 }
      })

      expect(ticket).toEqual({ runId: 'run-agent-run-1', jobId: 'job-agent-run-1', status: 'pending' })
      expect(runtime.getRun('run-agent-run-1')).toMatchObject({
        runId: 'run-agent-run-1',
        status: 'pending',
        trace: {
          agentId: 'orchestrator',
          jobId: 'job-agent-run-1',
          messageId: 'message-agent-run-1',
          trigger: 'canvasChat'
        }
      })

      expect(await worker.runNext()).toBe('job-agent-run-1')

      expect(plannerContextBudget).toBeGreaterThan(0)
      expect(runtime.getRun('run-agent-run-1')).toMatchObject({
        runId: 'run-agent-run-1',
        status: 'completed',
        trace: {
          agentId: 'orchestrator',
          planId: 'plan-agent-run-1',
          intentAnalysis: {
            kind: 'canvasOperation',
            executionMode: 'plan',
            requirements: ['Generate image configuration nodes.'],
            recommendedAgentId: 'canvas-orchestrator'
          },
          capabilityCheck: {
            localCapabilities: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode', 'canvas.connectNodes', 'canvas.runNode'],
            selectedAgentId: 'canvas-orchestrator'
          }
        }
      })

      const recoveredRuntime = createOrchestratorRuntime({
        queue,
        events,
        listTools: () => [queryGraphTool],
        idFactory: (prefix) => `${prefix}-recovered`,
        planIdFactory: () => 'plan-recovered',
        planner: {
          proposePlan() {
          return { type: 'canvasPlan', plan: samplePlan }
          }
        },
        agentRuns
      })

      expect(recoveredRuntime.getRun('run-agent-run-1')).toMatchObject({
        runId: 'run-agent-run-1',
        status: 'completed',
        trace: {
          messageId: 'message-agent-run-1',
          planId: 'plan-agent-run-1',
          agentId: 'orchestrator',
          jobId: 'job-agent-run-1',
          trigger: 'canvasChat',
          intentAnalysis: {
            kind: 'canvasOperation',
            summary: '用户提出了明确的画布或生成工作流需求。',
            requirements: ['Generate image configuration nodes.'],
            missing: [],
            localCapabilities: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode', 'canvas.connectNodes', 'canvas.runNode'],
            recommendedAgentId: 'canvas-orchestrator',
            executionMode: 'plan',
            complexity: 'high'
          },
          capabilityCheck: {
            localCapabilities: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode', 'canvas.connectNodes', 'canvas.runNode'],
            selectedAgentId: 'canvas-orchestrator',
            executionMode: 'plan',
            complexity: 'high'
          }
        }
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('marks agent runs as approval_required when a tool call needs ask permission', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agent-approval-'))
    const dbPath = join(tempDir, 'agent-approval.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const jobs = createJobRepository(db)
      const events = createJobEventBus()
      let nextJob = 0
      const queue = createJobQueue({
        jobs,
        idFactory: () => `job-agent-approval-${(nextJob += 1)}`,
        clock: () => 1_782_700_002_000
      })
      let createNodeCalls = 0
      const toolRuntime = createToolRuntime({
        idFactory: () => 'invoke-agent-approval',
        clock: () => 1_782_700_002_001,
        permissionPolicy: () => ({
          decision: 'ask',
          decisionReason: 'Creating nodes requires confirmation.',
          requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }]
        }),
        tools: [
          defineTool({
            descriptor: writeTool,
            inputSchema: z.object({ type: z.string() }),
            outputSchema: z.object({ nodeId: z.string() }),
            renderToolUseMessage: () => 'Create node',
            call() {
              createNodeCalls += 1
              return { nodeId: 'node-approved' }
            }
          })
        ]
      })
      let modelTurns = 0
      const planner = createGatewayAgentPlanner({
        gateways: {
          invoke() {
            modelTurns += 1
            if (modelTurns > 1) {
              return Promise.resolve({
                kind: 'text',
                text: JSON.stringify({
                  kind: 'plan',
                  summary: 'Approved tool call completed.',
                  nodes: [{ ref: 'prompt-approved', type: 'text', title: 'Approved prompt', data: { content: 'done' } }],
                  edges: [],
                  runSteps: [],
                  question: null,
                  dropped: []
                })
              })
            }

            return Promise.resolve({
              kind: 'text',
              text: JSON.stringify({
                type: 'toolCalls',
                calls: [{ id: 'call-create', toolId: 'canvas.createNode', input: { type: 'text' } }]
              })
            })
          }
        },
        tools: toolRuntime,
        listTools: () => [writeTool]
      })
      const runtime = createOrchestratorRuntime({
        queue,
        events,
        listTools: () => [writeTool],
        idFactory: (prefix) => `${prefix}-approval-1`,
        planIdFactory: () => 'plan-approval-1',
        planner
      })
      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'agent-approval-worker',
        clock: () => 1_782_700_002_010,
        handlers: {
          'agent.run': runtime.createJobHandler()
        }
      })

      const ticket = runtime.agentRun({ agentId: 'orchestrator', message: '创建一个文本节点' })

      expect(await worker.runNext()).toBe('job-agent-approval-1')
      expect(createNodeCalls).toBe(0)
      expect(jobs.getById(ticket.jobId)?.error).toMatchObject({
        errorClass: 'agent_tool_approval_required',
        message: 'Tool requires user approval before execution.'
      })
      const terminalEvents = events.getTerminalEvents()
      expect(terminalEvents).toHaveLength(1)
      const terminalEvent = terminalEvents[0]
      if (!terminalEvent || terminalEvent.channel !== 'job.failed') {
        throw new Error('expected_failed_terminal_event')
      }
      expect(terminalEvent).toMatchObject({
        channel: 'job.failed',
        jobId: 'job-agent-approval-1',
        emittedAt: 1_782_700_002_010
      })
      expect(terminalEvent.error).toMatchObject({
        errorClass: 'agent_tool_approval_required',
        details: {
          pendingApproval: {
            callId: 'call-create',
            toolId: 'canvas.createNode',
            input: { type: 'text' },
            reason: 'Creating nodes requires confirmation.',
            requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }]
          }
        }
      })
      expect(runtime.getRun(ticket.runId)).toMatchObject({
        runId: 'run-approval-1',
        status: 'approval_required',
        trace: {
          errorClass: 'agent_tool_approval_required',
          pendingApproval: {
            callId: 'call-create',
            toolId: 'canvas.createNode',
            input: { type: 'text' }
          }
        }
      })
      const approvalTicket = runtime.approveTool({ runId: ticket.runId, callId: 'call-create', approvedBy: 'user-local' })

      expect(approvalTicket).toEqual({ runId: 'run-approval-1', jobId: 'job-agent-approval-2', status: 'pending' })
      expect(runtime.getRun(ticket.runId)).toMatchObject({
        runId: 'run-approval-1',
        status: 'pending'
      })

      expect(await worker.runNext()).toBe('job-agent-approval-2')
      expect(createNodeCalls).toBe(1)
      expect(runtime.getRun(ticket.runId)).toMatchObject({
        runId: 'run-approval-1',
        status: 'completed',
        trace: {
          planId: 'plan-approval-1'
        }
      })
      expect(runtime.getPlan('message-approval-1')).toMatchObject({
        kind: 'plan',
        summary: 'Approved tool call completed.',
        nodes: [{ ref: 'prompt-approved', type: 'text', title: 'Approved prompt', data: { content: 'done' } }]
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('persists successful visible transitions and replayable answer artifacts', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-orchestrator-spine-'))
    const dbPath = join(tempDir, 'orchestrator-spine.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const jobs = createJobRepository(db)
      const agentRuns = createAgentRunRepository(db)
      let spineId = 0
      const runSpine = createAgentRunSpine({
        runs: agentRuns,
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        idFactory: (prefix) => `${prefix}-spine-${++spineId}`,
        clock: (() => {
          let now = 1_782_700_010_000
          return () => now++
        })()
      })
      const events = createJobEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-spine-1',
        clock: () => 1_782_700_010_000
      })
      const runtime = createOrchestratorRuntime({
        queue,
        events,
        agentRuns,
        runSpine,
        listTools: () => [queryGraphTool],
        idFactory: (prefix) => `${prefix}-spine-1`,
        planIdFactory: () => 'plan-spine-1',
        planner: {
          async *proposePlan() {
            yield await Promise.resolve({ type: 'progress' as const, message: 'Model thinking', progress: 60 })
            return { type: 'answer', summary: 'Greeting', text: '你好，我在。', dropped: [] }
          }
        }
      })
      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'agent-spine-worker',
        clock: () => 1_782_700_010_050,
        handlers: { 'agent.run': runtime.createJobHandler() }
      })

      const ticket = runtime.agentRun({ agentId: 'general-purpose', message: '你好' })
      expect(await worker.runNext()).toBe('job-spine-1')

      const aggregate = runSpine.getSnapshot(ticket.runId)
      const eventTypes = aggregate?.events.map((event) => event.type) ?? []

      expect(eventTypes.slice(0, 4)).toEqual([
        'run.created',
        'intent.analyzed',
        'run.started',
        'context.built'
      ])
      expect(eventTypes.filter((type) => type === 'progress')).toHaveLength(4)
      expect(eventTypes.slice(-3)).toEqual([
        'response.ready',
        'artifact.created',
        'run.completed'
      ])
      expect(aggregate?.run.status).toBe('completed')
      expect(aggregate?.artifacts).toEqual([
        expect.objectContaining({ kind: 'answer', title: 'Answer', summary: 'Greeting' })
      ])
      expect(aggregate ? projectAgentRunSnapshot(aggregate).chatTurn.blocks : []).toContainEqual({
        kind: 'text',
        markdown: '你好，我在。',
        streaming: false
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('persists one visible terminal failure when orchestration throws', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-orchestrator-spine-failure-'))
    const dbPath = join(tempDir, 'orchestrator-spine-failure.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const jobs = createJobRepository(db)
      const agentRuns = createAgentRunRepository(db)
      let spineId = 0
      const runSpine = createAgentRunSpine({
        runs: agentRuns,
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        idFactory: (prefix) => `${prefix}-failure-${++spineId}`,
        clock: () => 1_782_700_011_000
      })
      const events = createJobEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-spine-failure',
        clock: () => 1_782_700_011_000
      })
      const runtime = createOrchestratorRuntime({
        queue,
        events,
        agentRuns,
        runSpine,
        idFactory: (prefix) => `${prefix}-spine-failure`,
        planner: {
          proposePlan() {
            throw new Error('Gateway unavailable.')
          }
        }
      })
      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'agent-spine-failure-worker',
        clock: () => 1_782_700_011_010,
        handlers: { 'agent.run': runtime.createJobHandler() }
      })

      const ticket = runtime.agentRun({ agentId: 'general-purpose', message: '请回答' })
      expect(await worker.runNext()).toBe('job-spine-failure')

      const aggregate = runSpine.getSnapshot(ticket.runId)
      expect(aggregate?.run).toMatchObject({
        status: 'failed',
        errorClass: 'Gateway unavailable.',
        lastCheckpoint: 'run.failed'
      })
      expect(aggregate?.events.filter((event) => event.type === 'run.failed')).toHaveLength(1)
      expect(aggregate ? projectAgentRunSnapshot(aggregate).inspector.error : undefined).toEqual({
        errorClass: 'Gateway unavailable.',
        message: 'Gateway unavailable.',
        retryable: false
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
