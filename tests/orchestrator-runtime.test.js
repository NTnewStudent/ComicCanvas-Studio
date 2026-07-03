import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createAgentRunRepository } from '../desktop/src/main/db/repositories/agent-run.repo';
import { createJobRepository } from '../desktop/src/main/db/repositories/job.repo';
import { createJobEventBus } from '../desktop/src/main/jobs/events';
import { createJobQueue } from '../desktop/src/main/jobs/queue';
import { createJobWorker } from '../desktop/src/main/jobs/worker';
import { createDefaultOrchestratorPlanner, createOrchestratorRuntime, runOrchestrator } from '../desktop/src/main/agent/orchestrator';
import { createGatewayAgentPlanner } from '../desktop/src/main/agent/gateway-loop-model';
import { createToolRuntime, defineTool } from '../desktop/src/main/tools/runtime';
const samplePlan = {
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
};
const queryGraphTool = {
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
};
const writeTool = {
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
};
function createDeferredPlan() {
    let resolvePlan;
    const promise = new Promise((resolve) => {
        resolvePlan = resolve;
    });
    return {
        promise,
        resolve(plan) {
            resolvePlan?.(plan);
        }
    };
}
describe('M4 orchestrator AsyncGenerator runtime', () => {
    it('treats low-signal greetings as clarification instead of creating canvas nodes', () => {
        const plan = createDefaultOrchestratorPlanner().proposePlan({
            runId: 'run-greeting',
            messageId: 'message-greeting',
            message: 'hi',
            agentId: 'general-purpose',
        });
        expect(plan).toMatchObject({
            kind: 'clarify',
            nodes: [],
            edges: [],
            runSteps: [],
        });
        expect(plan.question).toContain('告诉我');
    });
    it('creates a direct text-node plan for simple text node requests without generation run steps', () => {
        const plan = createDefaultOrchestratorPlanner().proposePlan({
            runId: 'run-direct-text',
            messageId: 'message-direct-text',
            message: '创建一个文本节点',
            agentId: 'general-purpose',
        });
        expect(plan).toMatchObject({
            kind: 'plan',
            summary: 'Directly create one text node for: 创建一个文本节点',
            nodes: [{ ref: 'text-1', type: 'text', title: '文本节点', data: { label: '文本节点', content: '创建一个文本节点' } }],
            edges: [],
            runSteps: [],
            question: null,
            dropped: []
        });
    });
    it('keeps direct image and video node requests as reference nodes instead of generation nodes', () => {
        const imagePlan = createDefaultOrchestratorPlanner().proposePlan({
            runId: 'run-direct-image',
            messageId: 'message-direct-image',
            message: '创建一个图片节点',
            agentId: 'general-purpose',
        });
        const videoPlan = createDefaultOrchestratorPlanner().proposePlan({
            runId: 'run-direct-video',
            messageId: 'message-direct-video',
            message: '创建一个视频节点',
            agentId: 'general-purpose',
        });
        expect(imagePlan.nodes.map((node) => node.type)).toEqual(['image']);
        expect(videoPlan.nodes.map((node) => node.type)).toEqual(['video']);
        expect(imagePlan.runSteps).toEqual([]);
        expect(videoPlan.runSteps).toEqual([]);
    });
    it('routes explicit image generation requests through imageConfigV2 generation nodes', () => {
        const plan = createDefaultOrchestratorPlanner().proposePlan({
            runId: 'run-generate-image',
            messageId: 'message-generate-image',
            message: '生成图片',
            agentId: 'general-purpose',
        });
        expect(plan.nodes.map((node) => node.type)).toEqual(['text', 'imageConfigV2']);
        expect(plan.runSteps).toEqual([{ ref: 'image-1', action: 'imageRun' }]);
    });
    it('defaults comic-drama requests to migrated context plus image/video generation config run vocabulary', () => {
        const plan = createDefaultOrchestratorPlanner().proposePlan({
            runId: 'run-comic',
            messageId: 'message-comic',
            message: '做一个雨夜侦探漫画短剧，包含角色、场景、图片、配音、视频合成和音视频合成',
            agentId: 'orchestrator',
        });
        expect(plan.kind).toBe('plan');
        expect(plan.question).toBeNull();
        expect(plan.nodes.map((node) => node.type)).toEqual([
            'text',
            'character',
            'scene',
            'imageConfigV2',
            'videoConfigV2',
            'audio',
            'videoCompose',
            'muxAudioVideo',
        ]);
        expect(plan.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'story', target: 'character' }),
            expect.objectContaining({ source: 'story', target: 'scene' }),
            expect.objectContaining({ source: 'character', target: 'key-image' }),
            expect.objectContaining({ source: 'scene', target: 'key-image' }),
            expect.objectContaining({ source: 'key-image', target: 'video-gen' }),
            expect.objectContaining({ source: 'video-gen', target: 'compose' }),
            expect.objectContaining({ source: 'voice', target: 'mux' }),
            expect.objectContaining({ source: 'compose', target: 'mux' }),
        ]));
        expect(plan.runSteps).toEqual([
            { ref: 'key-image', action: 'imageRun' },
            { ref: 'video-gen', action: 'videoRun' },
        ]);
        expect(JSON.stringify(plan)).not.toMatch(/onRun|function|window\.|eval/u);
    });
    it('runs as an AsyncGenerator and returns a CanvasPlan after streaming progress', async () => {
        const stream = runOrchestrator({
            runId: 'run-1',
            messageId: 'message-1',
            message: '生成宇宙飞船图片节点',
            agentId: 'orchestrator',
            planIdFactory: () => 'plan-1',
            planner: {
                async *proposePlan() {
                    await Promise.resolve();
                    yield { type: 'progress', message: 'Analyzing request', progress: 20 };
                    yield { type: 'progress', message: 'Drafting CanvasPlan', progress: 80 };
                    return samplePlan;
                }
            }
        });
        const events = [];
        let next = await stream.next();
        while (!next.done) {
            events.push(next.value);
            next = await stream.next();
        }
        expect(events).toEqual([
            { type: 'progress', runId: 'run-1', message: 'Starting orchestration', progress: 5 },
            { type: 'progress', runId: 'run-1', message: '理解输入：用户提出了明确的画布或生成工作流需求。；复杂度=high；先提供任务计划；将交给 canvas-orchestrator。', progress: 15 },
            { type: 'progress', runId: 'run-1', message: '检查本地能力：canvas.queryGraph、canvas.proposePlan、canvas.createNode、canvas.connectNodes、canvas.runNode', progress: 25 },
            { type: 'progress', runId: 'run-1', message: 'Analyzing request', progress: 20 },
            { type: 'progress', runId: 'run-1', message: 'Drafting CanvasPlan', progress: 80 },
            { type: 'plan', runId: 'run-1', messageId: 'message-1', planId: 'plan-1', plan: samplePlan }
        ]);
        expect(next.value).toEqual({
            runId: 'run-1',
            messageId: 'message-1',
            planId: 'plan-1',
            plan: samplePlan
        });
    });
    it('returns a pending chat ticket before model work and stores the plan after the agent job completes', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-orchestrator-'));
        const dbPath = join(tempDir, 'orchestrator.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const jobs = createJobRepository(db);
            const events = createJobEventBus();
            const queue = createJobQueue({
                jobs,
                idFactory: () => 'job-agent-1',
                clock: () => 1_782_700_000_000
            });
            const deferred = createDeferredPlan();
            let plannerStarted = false;
            let plannerLoopToolIds = [];
            let plannerLoopMessages = [];
            const runtime = createOrchestratorRuntime({
                queue,
                events,
                listTools: () => [queryGraphTool],
                idFactory: (prefix) => `${prefix}-1`,
                planIdFactory: () => 'plan-async-1',
                planner: {
                    async proposePlan(input) {
                        plannerStarted = true;
                        plannerLoopToolIds = input.loop?.allowedTools.map((tool) => tool.id) ?? [];
                        plannerLoopMessages = input.loop?.messages.map((message) => message.content) ?? [];
                        return deferred.promise;
                    }
                }
            });
            const worker = createJobWorker({
                jobs,
                events,
                leaseOwner: 'agent-worker',
                clock: () => 1_782_700_000_010,
                handlers: {
                    'agent.run': runtime.createJobHandler()
                }
            });
            const ticket = runtime.chatSend({ message: '生成宇宙飞船图片节点', agentId: 'orchestrator', requestedBy: 'user-1' });
            expect(ticket).toEqual({ runId: 'run-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' });
            expect(runtime.getRun('run-1')).toMatchObject({
                runId: 'run-1',
                status: 'pending',
                trace: {
                    intentAnalysis: {
                        kind: 'canvasPlan',
                        requirements: ['Generate image configuration nodes.']
                    }
                }
            });
            expect(plannerStarted).toBe(false);
            expect(runtime.getPlan('message-1')).toBeNull();
            const running = worker.runNext();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(plannerStarted).toBe(true);
            expect(plannerLoopToolIds).toEqual(['canvas.queryGraph']);
            expect(plannerLoopMessages).toEqual(expect.arrayContaining(['生成宇宙飞船图片节点']));
            deferred.resolve(samplePlan);
            expect(await running).toBe('job-agent-1');
            expect(runtime.getPlan('message-1')).toEqual(samplePlan);
            expect(jobs.getById('job-agent-1')?.result).toEqual({ kind: 'agentRun', runId: 'run-1', planId: 'plan-async-1' });
            expect(events.getTerminalEvents()).toEqual([
                {
                    channel: 'job.completed',
                    jobId: 'job-agent-1',
                    result: { kind: 'agentRun', runId: 'run-1', planId: 'plan-async-1' },
                    emittedAt: 1_782_700_000_010
                }
            ]);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
    it('runs agent.run tickets through the selected agent policy and context override', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agent-run-'));
        const dbPath = join(tempDir, 'agent-run.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const jobs = createJobRepository(db);
            const agentRuns = createAgentRunRepository(db);
            const events = createJobEventBus();
            const queue = createJobQueue({
                jobs,
                idFactory: () => 'job-agent-run-1',
                clock: () => 1_782_700_001_000
            });
            let plannerContextBudget = 0;
            const runtime = createOrchestratorRuntime({
                queue,
                events,
                listTools: () => [queryGraphTool],
                idFactory: (prefix) => `${prefix}-agent-run-1`,
                planIdFactory: () => 'plan-agent-run-1',
                planner: {
                    proposePlan(input) {
                        plannerContextBudget = input.loop?.tokenEstimate ?? -1;
                        expect(input.agent?.contextPolicy.maxContextTokens).toBe(32);
                        expect(input.trigger).toBe('canvasChat');
                        return samplePlan;
                    }
                },
                agentRuns
            });
            const worker = createJobWorker({
                jobs,
                events,
                leaseOwner: 'agent-run-worker',
                clock: () => 1_782_700_001_010,
                handlers: {
                    'agent.run': runtime.createJobHandler()
                }
            });
            const ticket = runtime.agentRun({
                agentId: 'orchestrator',
                message: '生成宇宙飞船图片节点',
                contextPolicyOverride: { maxContextTokens: 32 }
            });
            expect(ticket).toEqual({ runId: 'run-agent-run-1', jobId: 'job-agent-run-1', status: 'pending' });
            expect(runtime.getRun('run-agent-run-1')).toMatchObject({
                runId: 'run-agent-run-1',
                status: 'pending',
                trace: {
                    agentId: 'orchestrator',
                    jobId: 'job-agent-run-1',
                    messageId: 'message-agent-run-1',
                    trigger: 'canvasChat'
                }
            });
            expect(await worker.runNext()).toBe('job-agent-run-1');
            expect(plannerContextBudget).toBeGreaterThan(0);
            expect(runtime.getRun('run-agent-run-1')).toMatchObject({
                runId: 'run-agent-run-1',
                status: 'completed',
                trace: {
                    agentId: 'orchestrator',
                    planId: 'plan-agent-run-1',
                    intentAnalysis: {
                        kind: 'canvasPlan',
                        executionMode: 'plan',
                        requirements: ['Generate image configuration nodes.'],
                        recommendedAgentId: 'canvas-orchestrator'
                    },
                    capabilityCheck: {
                        localCapabilities: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode', 'canvas.connectNodes', 'canvas.runNode'],
                        selectedAgentId: 'canvas-orchestrator'
                    }
                }
            });
            const recoveredRuntime = createOrchestratorRuntime({
                queue,
                events,
                listTools: () => [queryGraphTool],
                idFactory: (prefix) => `${prefix}-recovered`,
                planIdFactory: () => 'plan-recovered',
                planner: {
                    proposePlan() {
                        return samplePlan;
                    }
                },
                agentRuns
            });
            expect(recoveredRuntime.getRun('run-agent-run-1')).toEqual({
                runId: 'run-agent-run-1',
                status: 'completed',
                trace: {
                    messageId: 'message-agent-run-1',
                    planId: 'plan-agent-run-1',
                    agentId: 'orchestrator',
                    jobId: 'job-agent-run-1',
                    trigger: 'canvasChat',
                    intentAnalysis: {
                        kind: 'canvasPlan',
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
            });
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
    it('marks agent runs as approval_required when a tool call needs ask permission', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agent-approval-'));
        const dbPath = join(tempDir, 'agent-approval.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const jobs = createJobRepository(db);
            const events = createJobEventBus();
            let nextJob = 0;
            const queue = createJobQueue({
                jobs,
                idFactory: () => `job-agent-approval-${(nextJob += 1)}`,
                clock: () => 1_782_700_002_000
            });
            let createNodeCalls = 0;
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
                            createNodeCalls += 1;
                            return { nodeId: 'node-approved' };
                        }
                    })
                ]
            });
            let modelTurns = 0;
            const planner = createGatewayAgentPlanner({
                gateways: {
                    async invoke() {
                        modelTurns += 1;
                        if (modelTurns > 1) {
                            return {
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
                            };
                        }
                        return {
                            kind: 'text',
                            text: JSON.stringify({
                                type: 'toolCalls',
                                calls: [{ id: 'call-create', toolId: 'canvas.createNode', input: { type: 'text' } }]
                            })
                        };
                    }
                },
                tools: toolRuntime,
                listTools: () => [writeTool]
            });
            const runtime = createOrchestratorRuntime({
                queue,
                events,
                listTools: () => [writeTool],
                idFactory: (prefix) => `${prefix}-approval-1`,
                planIdFactory: () => 'plan-approval-1',
                planner
            });
            const worker = createJobWorker({
                jobs,
                events,
                leaseOwner: 'agent-approval-worker',
                clock: () => 1_782_700_002_010,
                handlers: {
                    'agent.run': runtime.createJobHandler()
                }
            });
            const ticket = runtime.agentRun({ agentId: 'orchestrator', message: '创建一个文本节点' });
            expect(await worker.runNext()).toBe('job-agent-approval-1');
            expect(createNodeCalls).toBe(0);
            expect(jobs.getById(ticket.jobId)?.error).toMatchObject({
                errorClass: 'agent_tool_approval_required',
                message: 'Tool requires user approval before execution.'
            });
            expect(events.getTerminalEvents()).toEqual([
                {
                    channel: 'job.failed',
                    jobId: 'job-agent-approval-1',
                    error: expect.objectContaining({
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
                    }),
                    emittedAt: 1_782_700_002_010
                }
            ]);
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
            });
            const approvalTicket = runtime.approveTool({ runId: ticket.runId, callId: 'call-create', approvedBy: 'user-local' });
            expect(approvalTicket).toEqual({ runId: 'run-approval-1', jobId: 'job-agent-approval-2', status: 'pending' });
            expect(runtime.getRun(ticket.runId)).toMatchObject({
                runId: 'run-approval-1',
                status: 'pending'
            });
            expect(await worker.runNext()).toBe('job-agent-approval-2');
            expect(createNodeCalls).toBe(1);
            expect(runtime.getRun(ticket.runId)).toMatchObject({
                runId: 'run-approval-1',
                status: 'completed',
                trace: {
                    planId: 'plan-approval-1'
                }
            });
            expect(runtime.getPlan('message-approval-1')).toMatchObject({
                kind: 'plan',
                summary: 'Approved tool call completed.',
                nodes: [{ ref: 'prompt-approved', type: 'text', title: 'Approved prompt', data: { content: 'done' } }]
            });
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
