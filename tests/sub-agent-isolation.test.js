import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createWorkflowRepository } from '../desktop/src/main/db/repositories/workflow.repo';
import { createCanvasTools } from '../desktop/src/main/tools/canvas';
import { createToolRuntime } from '../desktop/src/main/tools/runtime';
import { applySubAgentResult, createIsolatedSubAgentDraft } from '../desktop/src/main/agent/sub-agent-isolation';
const actor = { type: 'agent', id: 'child-agent' };
const parentGraph = {
    nodes: [
        { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'gold spaceship' } },
        {
            id: 'image-1',
            type: 'image',
            position: { x: 320, y: 0 },
            data: {
                label: 'Image',
                promptOverride: '',
                modelId: 'stub-image',
                orientation: 'landscape',
                assetId: null,
                status: 'idle'
            }
        }
    ],
    edges: [{ id: 'edge-1', source: 'text-1', target: 'image-1', data: { edgeType: 'promptOrder', createdAt: 10 } }],
    viewport: { x: 0, y: 0, zoom: 1 }
};
async function withWorkflowRepository(run) {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-subagent-'));
    const dbPath = join(tempDir, 'subagent.sqlite');
    migrateDatabaseAtPath(dbPath);
    const db = openDatabaseAtPath(dbPath);
    try {
        const workflows = createWorkflowRepository(db);
        workflows.create({ id: 'project-1', name: 'Project 1', createdAt: 100, updatedAt: 100 });
        await run(workflows);
    }
    finally {
        db.close();
        rmSync(tempDir, { recursive: true, force: true });
    }
}
describe('M5 sub-agent isolation and merge', () => {
    it('lets a child mutate an isolated draft without changing the persisted graph before merge', async () => {
        await withWorkflowRepository(async (workflows) => {
            workflows.addVersion({ id: 'version-parent', workflowId: 'project-1', graph: parentGraph, createdAt: 110, createdBy: 'parent' });
            const draft = createIsolatedSubAgentDraft({
                parentGraph,
                parentRunId: 'run-parent',
                childRunId: 'run-child',
                traceId: 'trace-parent/run-child'
            });
            const runtime = createToolRuntime({
                idFactory: (() => {
                    let next = 0;
                    return () => `invoke-${(next += 1)}`;
                })(),
                clock: () => 1_782_910_000_000,
                tools: createCanvasTools({
                    graphStore: draft.graphStore,
                    idFactory: (prefix) => `${prefix}-child`,
                    clock: () => 1_782_910_000_100
                })
            });
            const created = await runtime.invoke({
                toolId: 'canvas.createNode',
                input: {
                    type: 'video',
                    position: { x: 640, y: 0 },
                    data: {
                        label: 'Child Video',
                        promptOverride: '',
                        modelId: 'stub-video',
                        orientation: 'landscape',
                        durationSeconds: 5,
                        firstFrameAssetId: null,
                        lastFrameAssetId: null,
                        assetId: null,
                        status: 'idle'
                    }
                },
                actor,
                traceId: draft.traceId
            });
            expect(created.output).toEqual({ nodeId: 'node-child' });
            const connected = await runtime.invoke({
                toolId: 'canvas.connectNodes',
                input: { source: 'image-1', target: 'node-child', edgeType: 'imageRole', imageRole: 'first_frame' },
                actor,
                traceId: draft.traceId
            });
            expect(connected.output).toEqual({ edgeId: 'edge-child' });
            expect(draft.getDraftGraph().nodes.map((node) => node.id)).toEqual(['text-1', 'image-1', 'node-child']);
            expect(workflows.getLatestVersion('project-1')?.graph).toEqual(parentGraph);
        });
    });
    it('sanitizes child draft output and writes a new graph version only when the parent merges', async () => {
        await withWorkflowRepository((workflows) => {
            workflows.addVersion({ id: 'version-parent', workflowId: 'project-1', graph: parentGraph, createdAt: 110, createdBy: 'parent' });
            const draft = createIsolatedSubAgentDraft({
                parentGraph,
                parentRunId: 'run-parent',
                childRunId: 'run-child',
                traceId: 'trace-parent/run-child'
            });
            draft.graphStore.setGraph({
                nodes: [
                    ...parentGraph.nodes,
                    {
                        id: 'video-child',
                        type: 'video',
                        position: { x: 640, y: 0 },
                        data: {
                            label: 'Child Video <script>alert(1)</script>',
                            promptOverride: 'window.evil() camera push',
                            modelId: 'stub-video',
                            orientation: 'landscape',
                            durationSeconds: 5,
                            firstFrameAssetId: null,
                            lastFrameAssetId: null,
                            assetId: null,
                            status: 'idle'
                        }
                    }
                ],
                edges: [
                    ...parentGraph.edges,
                    { id: 'edge-child', source: 'image-1', target: 'video-child', data: { edgeType: 'imageRole', imageRole: 'first_frame', createdAt: 20 } },
                    { id: 'edge-bad', source: 'video-child', target: 'text-1', data: { edgeType: 'default', createdAt: 21 } }
                ],
                viewport: { x: 12, y: 8, zoom: 0.9 }
            });
            const result = applySubAgentResult({
                draft,
                workflows,
                projectId: 'project-1',
                graphVersionId: 'version-merged',
                createdAt: 1_782_910_000_300,
                createdBy: 'run-parent'
            });
            expect(result).toEqual({
                graphVersion: 'version-merged',
                appliedNodeIds: ['text-1', 'image-1', 'video-child'],
                appliedEdgeIds: ['edge-1', 'edge-child'],
                dropped: [
                    'node:video-child:data.label:executable_string_stripped',
                    'node:video-child:data.promptOverride:executable_string_stripped',
                    'edge:video-child->text-1:connection_rejected'
                ],
                traceId: 'trace-parent/run-child'
            });
            expect(workflows.getLatestVersion('project-1')?.graph).toEqual({
                nodes: [
                    parentGraph.nodes[0],
                    parentGraph.nodes[1],
                    {
                        id: 'video-child',
                        type: 'video',
                        position: { x: 640, y: 0 },
                        data: {
                            label: 'Child Video',
                            promptOverride: 'camera push',
                            modelId: 'stub-video',
                            orientation: 'landscape',
                            durationSeconds: 5,
                            firstFrameAssetId: null,
                            lastFrameAssetId: null,
                            assetId: null,
                            status: 'idle'
                        }
                    }
                ],
                edges: [
                    parentGraph.edges[0],
                    { id: 'edge-child', source: 'image-1', target: 'video-child', data: { edgeType: 'imageRole', imageRole: 'first_frame', createdAt: 20 } }
                ],
                viewport: { x: 12, y: 8, zoom: 0.9 }
            });
        });
    });
});
