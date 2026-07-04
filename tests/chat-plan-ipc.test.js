import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createOrchestratorRuntime } from '../desktop/src/main/agent/orchestrator';
import { createCanvasPlanEventBus } from '../desktop/src/main/agent/plan-events';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createChatMessageRepository } from '../desktop/src/main/db/repositories/chat-message.repo';
import { createJobRepository } from '../desktop/src/main/db/repositories/job.repo';
import { createIpcCanvasPlanEventBus } from '../desktop/src/main/ipc/canvas-plan-fanout';
import { createJobEventBus } from '../desktop/src/main/jobs/events';
import { createJobQueue } from '../desktop/src/main/jobs/queue';
import { createJobWorker } from '../desktop/src/main/jobs/worker';
const samplePlan = {
    kind: 'plan',
    summary: 'Create one image node for a spaceship scene.',
    nodes: [
        {
            ref: 'image-1',
            type: 'image',
            title: 'Spaceship image',
            data: {
                promptOverride: 'gold spaceship above the moon',
                modelId: 'stub-image',
                orientation: 'landscape'
            }
        }
    ],
    edges: [],
    runSteps: [{ ref: 'image-1', action: 'imageRun' }],
    question: null,
    dropped: []
};
function createWindow(destroyed = false) {
    return {
        isDestroyed: () => destroyed,
        webContents: {
            send: vi.fn()
        }
    };
}
describe('M4 chat plan IPC', () => {
    it('persists chat messages, stores sanitized plans after completion, and emits planReady', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-chat-plan-'));
        const dbPath = join(tempDir, 'chat-plan.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const now = 1_783_000_000_000;
            const jobs = createJobRepository(db);
            const chatMessages = createChatMessageRepository(db);
            const jobEvents = createJobEventBus();
            const planEvents = createCanvasPlanEventBus();
            const queue = createJobQueue({
                jobs,
                idFactory: () => 'job-agent-1',
                clock: () => now
            });
            const runtime = createOrchestratorRuntime({
                queue,
                events: jobEvents,
                chatMessages,
                planEvents,
                clock: () => now + 10,
                workflowId: 'workflow-1',
                idFactory: (prefix) => `${prefix}-1`,
                planIdFactory: () => 'plan-1',
                planner: {
                    proposePlan() {
                        return samplePlan;
                    }
                }
            });
            const worker = createJobWorker({
                jobs,
                events: jobEvents,
                leaseOwner: 'agent-worker',
                clock: () => now + 20,
                handlers: {
                    'agent.run': runtime.createJobHandler()
                }
            });
            const ticket = runtime.chatSend({ message: 'Generate a spaceship image node', agentId: 'orchestrator', requestedBy: 'user-1' });
            expect(ticket).toEqual({ runId: 'run-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' });
            expect(ticket).not.toHaveProperty('plan');
            expect(chatMessages.getById('message-1')).toMatchObject({
                id: 'message-1',
                workflowId: 'workflow-1',
                agentRunId: 'run-1',
                role: 'user',
                content: 'Generate a spaceship image node',
                createdAt: now + 10
            });
            expect(runtime.getPlan('message-1')).toBeNull();
            expect(await worker.runNext()).toBe('job-agent-1');
            const storedMessage = chatMessages.getById('message-1');
            expect(storedMessage?.applyStatus).toBe('draft');
            expect(storedMessage?.planJson ? JSON.parse(storedMessage.planJson) : null).toEqual(samplePlan);
            expect(runtime.getPlan('message-1')).toEqual(samplePlan);
            expect(planEvents.getPlanReadyEvents()).toEqual([{ messageId: 'message-1', planId: 'plan-1' }]);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
    it('fans canvas.planReady events out to live renderer windows', () => {
        const live = createWindow();
        const closed = createWindow(true);
        const events = createIpcCanvasPlanEventBus(() => [live, closed]);
        const planReady = { messageId: 'message-1', planId: 'plan-1' };
        events.emitPlanReady(planReady);
        expect(live.webContents.send).toHaveBeenCalledWith('canvas.planReady', planReady);
        expect(closed.webContents.send).not.toHaveBeenCalled();
        expect(events.getPlanReadyEvents()).toEqual([planReady]);
        expect(() => events.emitPlanReady(planReady)).toThrow('canvas_plan_ready_duplicate');
    });
    it('exposes a renderer-safe planReady subscription through preload', () => {
        const preload = readFileSync('desktop/src/preload/index.ts', 'utf8');
        expect(preload).toContain('onCanvasPlanReady');
        expect(preload).toContain("subscribeMain('canvas.planReady'");
    });
});
