import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createAgentRepository } from '../desktop/src/main/db/repositories/agent.repo';
import { createAgentRegistry } from '../desktop/src/main/agent/registry';
import { registerAgentHandlers } from '../desktop/src/main/ipc/agent.handler';
function createFakeIpcMain() {
    const handlers = new Map();
    return {
        handlers,
        ipcMain: {
            handle(channel, handler) {
                handlers.set(channel, handler);
            }
        }
    };
}
function customAgent(overrides = {}) {
    return {
        id: 'agent-storyboard',
        source: 'user',
        name: 'Storyboard agent',
        description: 'Breaks a comic-drama prompt into panels.',
        instructions: 'Create concise storyboards for text to image to video workflows.',
        allowedTools: ['canvas.queryGraph', 'canvas.proposePlan'],
        allowedSkills: ['storyboard'],
        gatewayPolicy: { allowedChannels: ['text'], modelId: 'stub-text' },
        contextPolicy: {
            includeCanvasGraph: true,
            includeSelectedAssets: false,
            includeRecentMessages: true,
            includeKnowledge: false,
            maxContextTokens: 4000
        },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
        triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
        maxTurns: 6,
        effort: 'medium',
        enabled: true,
        ...overrides
    };
}
async function withAgents(run) {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agents-'));
    const dbPath = join(tempDir, 'agents.sqlite');
    migrateDatabaseAtPath(dbPath);
    const db = openDatabaseAtPath(dbPath);
    try {
        const repo = createAgentRepository(db);
        const registry = createAgentRegistry({ agents: repo, clock: () => 1_782_920_000_000 });
        const { ipcMain, handlers } = createFakeIpcMain();
        registerAgentHandlers(ipcMain, { registry });
        await run({ handlers, repo });
    }
    finally {
        db.close();
        rmSync(tempDir, { recursive: true, force: true });
    }
}
describe('M5 custom Agent settings IPC', () => {
    it('provides a cc-haha style general-purpose agent as the default conversation entry', async () => {
        await withAgents(async ({ handlers }) => {
            const listed = (await handlers.get('agent.list')?.({}, { includeDisabled: false }));
            const general = listed.find((agent) => agent.id === 'general-purpose');
            const canvasOrchestrator = listed.find((agent) => agent.id === 'canvas-orchestrator');
            expect(general).toMatchObject({
                id: 'general-purpose',
                source: 'builtin',
                name: 'General Purpose',
                allowedTools: ['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep', 'web.search'],
                gatewayPolicy: { allowedChannels: ['text'] },
                permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics', 'network'], requireAskForDestructive: true },
                triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
            });
            expect(general?.instructions).toContain('general-purpose agent');
            expect(general?.instructions).toContain('fs.read, fs.glob, fs.grep');
            expect(general?.instructions).toContain('web.search');
            expect(canvasOrchestrator).toMatchObject({
                id: 'canvas-orchestrator',
                source: 'builtin',
                name: 'Canvas Orchestrator',
            });
            expect(listed.find((agent) => agent.id === 'orchestrator')).toMatchObject({
                description: 'Compatibility alias for Canvas Orchestrator.',
            });
        });
    });
    it('lists built-in agents alongside enabled custom agents', async () => {
        await withAgents(async ({ handlers }) => {
            const saved = await handlers.get('agent.save')?.({}, customAgent());
            expect(saved).toMatchObject({ id: 'agent-storyboard', source: 'user', enabled: true });
            const listed = (await handlers.get('agent.list')?.({}, { includeDisabled: false }));
            expect(listed.map((agent) => agent.id)).toEqual(['general-purpose', 'canvas-orchestrator', 'orchestrator', 'canvas', 'tooling', 'pm', 'agent-storyboard']);
            expect(listed.find((agent) => agent.id === 'general-purpose')).toMatchObject({ source: 'builtin', name: 'General Purpose' });
        });
    });
    it('persists custom agent edits and reloads them from the repository', async () => {
        await withAgents(async ({ handlers, repo }) => {
            const saved = await handlers.get('agent.save')?.({}, customAgent({ name: 'Storyboard v1', maxTurns: 4 }));
            expect(saved).toMatchObject({ id: 'agent-storyboard', name: 'Storyboard v1', maxTurns: 4 });
            await handlers.get('agent.save')?.({}, customAgent({ name: 'Storyboard v2', maxTurns: 8, allowedTools: ['canvas.queryGraph'] }));
            const reloaded = repo.list({ includeDisabled: true });
            expect(reloaded).toHaveLength(1);
            expect(reloaded[0]).toMatchObject({
                id: 'agent-storyboard',
                source: 'user',
                name: 'Storyboard v2',
                allowedTools: ['canvas.queryGraph'],
                maxTurns: 8
            });
        });
    });
    it('rejects malformed agent policy fields before persistence', async () => {
        await withAgents(async ({ handlers, repo }) => {
            const invalidTrigger = await handlers.get('agent.save')?.({}, customAgent({
                triggerPolicy: { allowedTriggers: ['manual'], defaultTrigger: 'workflowEvent', autoRun: false }
            }));
            expect(invalidTrigger).toMatchObject({
                errorClass: 'agent_policy_invalid',
                message: 'Agent configuration violates policy schema.'
            });
            const invalidPermission = await handlers.get('agent.save')?.({}, {
                ...customAgent(),
                permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'root'], requireAskForDestructive: true }
            });
            expect(invalidPermission).toMatchObject({ errorClass: 'agent_policy_invalid' });
            const invalidContext = await handlers.get('agent.save')?.({}, customAgent({
                contextPolicy: {
                    includeCanvasGraph: true,
                    includeSelectedAssets: false,
                    includeRecentMessages: true,
                    includeKnowledge: false,
                    maxContextTokens: 0
                }
            }));
            expect(invalidContext).toMatchObject({ errorClass: 'agent_policy_invalid' });
            expect(repo.list({ includeDisabled: true })).toEqual([]);
        });
    });
    it('persists built-in agent edits as overrides while still blocking delete', async () => {
        await withAgents(async ({ handlers }) => {
            const editResult = await handlers.get('agent.save')?.({}, customAgent({ id: 'canvas-orchestrator', source: 'builtin', name: 'Mutated canvas orchestrator' }));
            expect(editResult).toMatchObject({
                id: 'canvas-orchestrator',
                source: 'builtin',
                name: 'Mutated canvas orchestrator'
            });
            const listed = (await handlers.get('agent.list')?.({}, { includeDisabled: true }));
            expect(listed.find((agent) => agent.id === 'canvas-orchestrator')).toMatchObject({ name: 'Mutated canvas orchestrator' });
            const deleteResult = await handlers.get('agent.delete')?.({}, { agentId: 'canvas-orchestrator' });
            expect(deleteResult).toMatchObject({
                errorClass: 'agent_builtin_readonly',
                message: 'Built-in agents cannot be deleted.'
            });
        });
    });
    it('deletes user agents without affecting built-ins', async () => {
        await withAgents(async ({ handlers }) => {
            await handlers.get('agent.save')?.({}, customAgent());
            expect(await handlers.get('agent.delete')?.({}, { agentId: 'agent-storyboard' })).toEqual({
                agentId: 'agent-storyboard',
                deleted: true
            });
            const listed = (await handlers.get('agent.list')?.({}, { includeDisabled: true }));
            expect(listed.map((agent) => agent.id)).toEqual(['general-purpose', 'canvas-orchestrator', 'orchestrator', 'canvas', 'tooling', 'pm']);
        });
    });
});
