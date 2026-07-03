import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createCanvasSnippetRepository } from '../desktop/src/main/db/repositories/canvas-snippet.repo';
import { registerCanvasSnippetHandlers } from '../desktop/src/main/ipc/canvas-snippet.handler';
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
const snippetGraph = {
    nodes: [
        {
            id: 'text-1',
            type: 'text',
            position: { x: 0, y: 0 },
            data: { label: 'Prompt', content: 'rainy cyberpunk alley' },
        },
        {
            id: 'image-1',
            type: 'image',
            position: { x: 320, y: 40 },
            data: {
                label: 'Image',
                promptOverride: 'rainy cyberpunk alley',
                modelId: 'stub-image',
                orientation: 'landscape',
                assetId: null,
                status: 'idle',
            },
        },
    ],
    edges: [
        {
            id: 'edge-text-image',
            source: 'text-1',
            target: 'image-1',
            data: { edgeType: 'promptOrder', createdAt: 1_783_800_000_000 },
        },
    ],
};
async function withSnippets(run) {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-snippets-'));
    const dbPath = join(tempDir, 'snippets.sqlite');
    migrateDatabaseAtPath(dbPath);
    const db = openDatabaseAtPath(dbPath);
    try {
        const repo = createCanvasSnippetRepository(db);
        const { ipcMain, handlers } = createFakeIpcMain();
        registerCanvasSnippetHandlers(ipcMain, {
            snippets: repo,
            clock: () => 1_783_800_000_000,
            idFactory: () => 'snippet-generated',
        });
        await run({ handlers, repo });
    }
    finally {
        db.close();
        rmSync(tempDir, { recursive: true, force: true });
    }
}
describe('REQ-092 persisted canvas snippets', () => {
    it('registers canvas snippet library IPC handlers', () => {
        const { ipcMain, handlers } = createFakeIpcMain();
        registerCanvasSnippetHandlers(ipcMain);
        expect(Array.from(handlers.keys()).sort()).toEqual([
            'canvasSnippet.delete',
            'canvasSnippet.get',
            'canvasSnippet.list',
            'canvasSnippet.save',
        ]);
    });
    it('persists snippets with owner scope, metadata, and detail fragments', async () => {
        await withSnippets(async ({ handlers }) => {
            await handlers.get('canvasSnippet.save')?.({}, {
                id: 'snippet-old',
                name: 'Old snippet',
                description: 'Personal rainy setup',
                scope: 'my',
                ownerId: 'user-local',
                tags: ['rain', 'alley'],
                thumbnailUrl: 'cc-asset://asset/snippet-cover',
                nodes: snippetGraph.nodes,
                edges: snippetGraph.edges,
            });
            await handlers.get('canvasSnippet.save')?.({}, {
                id: 'snippet-new',
                name: 'New snippet',
                scope: 'public',
                ownerId: 'team-template',
                tags: ['public'],
                nodes: snippetGraph.nodes,
                edges: [
                    ...snippetGraph.edges,
                    {
                        id: 'edge-invalid',
                        source: 'text-1',
                        target: 'missing-node',
                        data: { edgeType: 'promptOrder', createdAt: 1 },
                    },
                ],
            });
            const list = await handlers.get('canvasSnippet.list')?.({}, {});
            const myList = await handlers.get('canvasSnippet.list')?.({}, { scope: 'my' });
            const publicList = await handlers.get('canvasSnippet.list')?.({}, { scope: 'public' });
            const detail = await handlers.get('canvasSnippet.get')?.({}, { snippetId: 'snippet-old' });
            expect(list.map((snippet) => snippet.id)).toEqual(['snippet-new', 'snippet-old']);
            expect(myList.map((snippet) => snippet.id)).toEqual(['snippet-old']);
            expect(publicList.map((snippet) => snippet.id)).toEqual(['snippet-new']);
            expect(list[0]).toMatchObject({
                id: 'snippet-new',
                schemaVersion: 1,
                name: 'New snippet',
                scope: 'public',
                ownerId: 'team-template',
                ownedByCurrentUser: false,
                tags: ['public'],
                nodeCount: 2,
                edgeCount: 1,
                nodes: snippetGraph.nodes,
                edges: snippetGraph.edges,
                createdAt: 1_783_800_000_000,
                updatedAt: 1_783_800_000_000,
            });
            expect(detail).toMatchObject({
                id: 'snippet-old',
                description: 'Personal rainy setup',
                scope: 'my',
                ownerId: 'user-local',
                ownedByCurrentUser: true,
                tags: ['rain', 'alley'],
                thumbnailUrl: 'cc-asset://asset/snippet-cover',
                nodes: snippetGraph.nodes,
                edges: snippetGraph.edges,
            });
        });
    });
    it('rejects snippets with fewer than two valid nodes and only deletes owned snippets', async () => {
        await withSnippets(async ({ handlers, repo }) => {
            expect(await handlers.get('canvasSnippet.save')?.({}, {
                id: 'snippet-too-small',
                name: 'Too small',
                nodes: [snippetGraph.nodes[0]],
                edges: [],
            })).toEqual({
                errorClass: 'validation_error',
                message: 'Snippet requires at least two valid nodes.',
                retryable: false,
            });
            await handlers.get('canvasSnippet.save')?.({}, {
                id: 'snippet-delete',
                name: 'Delete me',
                ownerId: 'user-local',
                nodes: snippetGraph.nodes,
                edges: snippetGraph.edges,
            });
            await handlers.get('canvasSnippet.save')?.({}, {
                id: 'snippet-public',
                name: 'Public shared',
                scope: 'public',
                ownerId: 'other-user',
                nodes: snippetGraph.nodes,
                edges: snippetGraph.edges,
            });
            expect(await handlers.get('canvasSnippet.delete')?.({}, { snippetId: 'snippet-public' })).toEqual({
                snippetId: 'snippet-public',
                deleted: false,
                errorClass: 'permission_denied',
                message: 'Only owned snippets can be deleted.',
                retryable: false,
            });
            expect(await handlers.get('canvasSnippet.delete')?.({}, { snippetId: 'snippet-delete' })).toEqual({
                snippetId: 'snippet-delete',
                deleted: true,
            });
            expect(repo.list().map((snippet) => snippet.id)).toEqual(['snippet-public']);
        });
    });
});
