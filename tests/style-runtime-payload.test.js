import { describe, expect, it } from 'vitest';
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler';
function createFakeIpcMain() {
    const handlers = new Map();
    return {
        handlers,
        ipcMain: {
            handle(channel, handler) {
                handlers.set(channel, handler);
            },
        },
    };
}
describe('REQ-094 runtime style payload', () => {
    it('enqueues a styled generation prompt from graph snapshot and node style override', async () => {
        const enqueued = [];
        const { ipcMain, handlers } = createFakeIpcMain();
        const styles = {
            list: () => [
                {
                    id: 'style-project',
                    code: 'project-style',
                    name: 'Project style',
                    description: null,
                    promptBefore: 'PROJECT BEFORE',
                    promptAfter: 'PROJECT AFTER',
                    legacyPromptPreset: null,
                    negativePrompt: null,
                    coverAssetId: null,
                    coverUrl: null,
                    tags: [],
                    enabled: true,
                    sortOrder: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'style-node',
                    code: 'node-style',
                    name: 'Node style',
                    description: null,
                    promptBefore: 'NODE BEFORE',
                    promptAfter: 'NODE AFTER',
                    legacyPromptPreset: null,
                    negativePrompt: 'low quality',
                    coverAssetId: null,
                    coverUrl: null,
                    tags: [],
                    enabled: true,
                    sortOrder: 2,
                    createdAt: 1,
                    updatedAt: 1,
                },
            ],
            getProjectDefault: () => 'style-project',
        };
        registerCanvasHandlers(ipcMain, {
            currentUserId: 'user-1',
            styles,
            graphStore: {
                getGraph: () => ({
                    nodes: [
                        {
                            id: 'text-1',
                            type: 'text',
                            position: { x: 0, y: 0 },
                            data: { label: 'Prompt', content: 'upstream mood' },
                        },
                        {
                            id: 'image-1',
                            type: 'image',
                            position: { x: 240, y: 0 },
                            data: {
                                label: 'Image',
                                promptOverride: 'node prompt',
                                modelId: 'stub-image',
                                orientation: 'portrait',
                                assetId: null,
                                status: 'idle',
                                stylePresetId: 'style-node',
                                ratio: '9:16',
                            },
                        },
                    ],
                    edges: [
                        {
                            id: 'edge-1',
                            source: 'text-1',
                            target: 'image-1',
                            data: { edgeType: 'promptOrder', createdAt: 10 },
                        },
                    ],
                    viewport: { x: 0, y: 0, zoom: 1 },
                }),
            },
            queue: {
                enqueue(input) {
                    enqueued.push(input);
                    return { jobId: 'job-styled', status: 'pending', createdAt: 1 };
                },
            },
        });
        await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'image-1' })).resolves.toEqual({
            jobId: 'job-styled',
            status: 'pending',
            createdAt: 1,
        });
        expect(enqueued).toHaveLength(1);
        expect(enqueued[0]).toMatchObject({
            type: 'canvas.generateImage',
            targetId: 'image-1',
            requestedBy: { type: 'user', id: 'user-1' },
            payload: {
                nodeId: 'image-1',
                prompt: 'NODE BEFORE\nupstream mood\nnode prompt\nNODE AFTER',
                modelKey: 'stub-image',
                parameters: { orientation: 'portrait', ratio: '9:16', negativePrompt: 'low quality' },
            },
        });
        expect(enqueued[0]?.payload.prompt).not.toContain('PROJECT BEFORE');
    });
    it('uses the workflow project default style when a node has no style override', async () => {
        const enqueued = [];
        const { ipcMain, handlers } = createFakeIpcMain();
        const styles = {
            list: () => [
                {
                    id: 'style-project',
                    code: 'project-style',
                    name: 'Project style',
                    description: null,
                    promptBefore: 'PROJECT BEFORE',
                    promptAfter: 'PROJECT AFTER',
                    legacyPromptPreset: null,
                    negativePrompt: 'project negative',
                    coverAssetId: null,
                    coverUrl: null,
                    tags: [],
                    enabled: true,
                    sortOrder: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
            ],
            getProjectDefault: (workflowId) => workflowId === 'workflow-42' ? 'style-project' : null,
        };
        registerCanvasHandlers(ipcMain, {
            currentUserId: 'user-1',
            styles,
            graphStore: {
                getGraph: () => ({
                    nodes: [
                        {
                            id: 'text-1',
                            type: 'text',
                            position: { x: 0, y: 0 },
                            data: { label: 'Prompt', content: 'city rain' },
                        },
                        {
                            id: 'image-1',
                            type: 'image',
                            position: { x: 240, y: 0 },
                            data: {
                                label: 'Image',
                                promptOverride: 'wide shot',
                                modelId: 'stub-image',
                                orientation: 'landscape',
                                assetId: null,
                                status: 'idle',
                                ratio: '16:9',
                            },
                        },
                    ],
                    edges: [
                        {
                            id: 'edge-1',
                            source: 'text-1',
                            target: 'image-1',
                            data: { edgeType: 'promptOrder', createdAt: 10 },
                        },
                    ],
                    viewport: { x: 0, y: 0, zoom: 1 },
                }),
            },
            queue: {
                enqueue(input) {
                    enqueued.push(input);
                    return { jobId: 'job-project-style', status: 'pending', createdAt: 1 };
                },
            },
        });
        await expect(handlers.get('canvas.runNode')?.({}, { workflowId: 'workflow-42', nodeId: 'image-1' })).resolves.toEqual({
            jobId: 'job-project-style',
            status: 'pending',
            createdAt: 1,
        });
        expect(enqueued[0]).toMatchObject({
            payload: {
                nodeId: 'image-1',
                prompt: 'PROJECT BEFORE\ncity rain\nwide shot\nPROJECT AFTER',
                parameters: { orientation: 'landscape', ratio: '16:9', negativePrompt: 'project negative' },
            },
        });
    });
    it('blocks runtime enqueue when the effective node style is disabled', async () => {
        const enqueued = [];
        const { ipcMain, handlers } = createFakeIpcMain();
        const styles = {
            list: () => [
                {
                    id: 'style-disabled',
                    code: 'disabled-style',
                    name: 'Disabled style',
                    description: null,
                    promptBefore: 'SHOULD NOT RUN',
                    promptAfter: null,
                    legacyPromptPreset: null,
                    negativePrompt: null,
                    coverAssetId: null,
                    coverUrl: null,
                    tags: [],
                    enabled: false,
                    sortOrder: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
            ],
            getProjectDefault: () => null,
        };
        registerCanvasHandlers(ipcMain, {
            currentUserId: 'user-1',
            styles,
            graphStore: {
                getGraph: () => ({
                    nodes: [
                        {
                            id: 'image-1',
                            type: 'image',
                            position: { x: 0, y: 0 },
                            data: {
                                label: 'Image',
                                promptOverride: 'node prompt',
                                modelId: 'stub-image',
                                orientation: 'portrait',
                                status: 'idle',
                                stylePresetId: 'style-disabled',
                            },
                        },
                    ],
                    edges: [],
                    viewport: { x: 0, y: 0, zoom: 1 },
                }),
            },
            queue: {
                enqueue(input) {
                    enqueued.push(input);
                    return { jobId: 'job-should-not-run', status: 'pending', createdAt: 1 };
                },
            },
        });
        const result = await handlers.get('canvas.runNode')?.({}, { workflowId: 'workflow-style', nodeId: 'image-1' });
        expect(result).toMatchObject({
            errorClass: 'workflow_validation_failed',
            retryable: false,
            issues: [{ code: 'disabled_style', severity: 'error', nodeId: 'image-1', refId: 'style-disabled' }],
        });
        expect(enqueued).toEqual([]);
    });
});
