import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler';
import { registerGatewayHandlers } from '../desktop/src/main/ipc/gateway.handler';
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
const gatewayInput = {
    id: 'gw-task-51',
    name: 'Task 51 Gateway',
    type: 'stub',
    baseUrl: 'local://task-51',
    auth: { mode: 'apiKey', secret: 'should-not-render' },
    capabilities: ['text', 'image'],
    modelMap: { text: 'task-text', image: 'task-image' },
    enabled: true,
};
describe('Task 51 model catalog IPC', () => {
    it('exposes model catalog through the sandboxed preload bridge', () => {
        const source = readFileSync('desktop/src/preload/index.ts', 'utf8');
        expect(source).toContain('listGatewayModels');
        expect(source).toContain("invokeMain('gateway.models'");
        expect(source).toContain("function invokeMain<TChannel extends 'gateway.models'>");
        expect(source).toContain('fetchGatewayModels');
        expect(source).toContain("invokeMain('gateway.fetchModels'");
    });
    it('registers and returns renderer-safe model catalog from enabled gateways', async () => {
        const { ipcMain, handlers } = createFakeIpcMain();
        registerGatewayHandlers(ipcMain);
        expect(Array.from(handlers.keys()).sort()).toContain('gateway.models');
        await handlers.get('gateway.save')?.({}, gatewayInput);
        const catalog = await handlers.get('gateway.models')?.({}, {});
        const serialized = JSON.stringify(catalog);
        expect(catalog).toMatchObject({
            models: {
                text: expect.arrayContaining([expect.objectContaining({ id: 'task-text', channel: 'text', gatewayId: 'gw-task-51', gatewayName: 'Task 51 Gateway', enabled: true })]),
                image: expect.arrayContaining([expect.objectContaining({ id: 'task-image', channel: 'image', gatewayId: 'gw-task-51', gatewayName: 'Task 51 Gateway', enabled: true })]),
            },
            capabilityFlags: {
                text: true,
                image: true,
            },
        });
        expect(serialized).not.toContain('should-not-render');
        expect(serialized).not.toContain('vault:');
    });
    it('fetches OpenAI-compatible model IDs through gateway.fetchModels without leaking secrets', async () => {
        const originalFetch = globalThis.fetch;
        const requests = [];
        globalThis.fetch = ((url, init) => {
            const headers = init?.headers;
            requests.push(headers?.Authorization ? { url: String(url), auth: headers.Authorization } : { url: String(url) });
            return Promise.resolve(new Response(JSON.stringify({
                data: [
                    { id: 'gpt-4.1-mini', owned_by: 'openai', created: 1 },
                    { id: 'gpt-image-1' },
                    { id: 'gpt-4.1-mini' },
                ],
            }), { status: 200, headers: { 'content-type': 'application/json' } }));
        });
        try {
            const { ipcMain, handlers } = createFakeIpcMain();
            registerGatewayHandlers(ipcMain);
            expect(Array.from(handlers.keys()).sort()).toContain('gateway.fetchModels');
            const result = await handlers.get('gateway.fetchModels')?.({}, {
                baseUrl: 'https://api.openai.example/v1/',
                auth: { mode: 'apiKey', secret: 'sk-hidden' },
            });
            const serialized = JSON.stringify(result);
            expect(requests).toEqual([{ url: 'https://api.openai.example/v1/models', auth: 'Bearer sk-hidden' }]);
            expect(result).toEqual({
                models: [
                    { id: 'gpt-4.1-mini', ownedBy: 'openai', created: 1 },
                    { id: 'gpt-image-1' },
                ],
            });
            expect(serialized).not.toContain('sk-hidden');
        }
        finally {
            globalThis.fetch = originalFetch;
        }
    });
    it('feeds the current model catalog into strict canvas validation dynamically', async () => {
        const { ipcMain, handlers } = createFakeIpcMain();
        registerGatewayHandlers(ipcMain);
        registerCanvasHandlers(ipcMain, {
            modelCatalog: () => handlers.get('gateway.models')?.({}, {}),
        });
        const graph = {
            nodes: [
                {
                    id: 'image-1',
                    type: 'image',
                    position: { x: 0, y: 0 },
                    data: {
                        label: 'Image',
                        promptOverride: 'city',
                        modelId: 'fresh-image-model',
                        orientation: 'landscape',
                        status: 'idle',
                    },
                },
            ],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
        };
        const before = await handlers.get('canvas.validateGraph')?.({}, {
            graph,
            mode: 'strict',
        });
        expect(before).toMatchObject({
            valid: false,
            issues: [{ code: 'unavailable_model', refId: 'fresh-image-model' }],
        });
        await handlers.get('gateway.save')?.({}, {
            ...gatewayInput,
            id: 'gw-fresh-model',
            modelMap: { image: 'fresh-image-model' },
            capabilities: ['image'],
        });
        const after = await handlers.get('canvas.validateGraph')?.({}, {
            graph,
            mode: 'strict',
        });
        expect(after.valid).toBe(true);
        expect(after.issues).toEqual([]);
    });
});
