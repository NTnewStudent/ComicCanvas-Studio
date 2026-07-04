import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createWorkflowRepository } from '../desktop/src/main/db/repositories/workflow.repo';
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler';
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
const templateGraph = {
    nodes: [
        { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'hero enters neon city' } },
        { id: 'image-1', type: 'image', position: { x: 320, y: 0 }, data: { label: 'Key art', promptOverride: '', modelId: 'stub-image', orientation: 'landscape', assetId: 'asset-cover', status: 'done' } },
    ],
    edges: [
        { id: 'edge-1', source: 'text-1', target: 'image-1', data: { edgeType: 'promptOrder', createdAt: 1 } },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
};
describe('Phase A workflow template repository', () => {
    it('lists published templates and copies one into a private draft workflow', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-template-'));
        const dbPath = join(tempDir, 'workflow-template.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const workflows = createWorkflowRepository(db);
            workflows.create({
                id: 'template-public',
                name: 'Cinematic storyboard',
                scope: 'template',
                published: true,
                coverAssetId: 'asset-cover',
                description: 'A public template for two-step image generation.',
                visibility: 'public',
                ownerId: 'admin-user',
                tags: ['cinematic', 'storyboard'],
                thumbnailUrl: 'cc-asset://asset/asset-cover',
                createdAt: 1_784_200_000_000,
                updatedAt: 1_784_200_000_000,
            });
            workflows.addVersion({
                id: 'template-version-1',
                workflowId: 'template-public',
                graph: templateGraph,
                createdAt: 1_784_200_000_100,
                createdBy: 'system',
            });
            workflows.create({
                id: 'template-private',
                name: 'Private template',
                scope: 'template',
                published: false,
                visibility: 'private',
                ownerId: 'user-local',
                createdAt: 1_784_200_000_000,
                updatedAt: 1_784_200_000_000,
            });
            expect(workflows.listTemplates()).toHaveLength(1);
            expect(workflows.listTemplates()[0]).toMatchObject({
                id: 'template-public',
                name: 'Cinematic storyboard',
                scope: 'template',
                published: true,
                coverAssetId: 'asset-cover',
                nodeCount: 2,
                edgeCount: 1,
                description: 'A public template for two-step image generation.',
                visibility: 'public',
                ownerId: 'admin-user',
                ownedByCurrentUser: false,
                tags: ['cinematic', 'storyboard'],
                thumbnailUrl: 'cc-asset://asset/asset-cover',
            });
            const copy = workflows.copyTemplateToDraft({
                templateId: 'template-public',
                workflowId: 'draft-copy',
                graphVersionId: 'draft-version-1',
                name: 'Cinematic storyboard copy',
                createdAt: 1_784_200_000_500,
                createdBy: 'user-local',
            });
            expect(copy).toEqual({ workflowId: 'draft-copy', graphVersion: 'draft-version-1', name: 'Cinematic storyboard copy' });
            expect(workflows.getSummary('draft-copy')).toMatchObject({
                id: 'draft-copy',
                name: 'Cinematic storyboard copy',
                scope: 'draft',
                published: false,
                nodeCount: 2,
                edgeCount: 1,
                coverAssetId: 'asset-cover',
                description: 'Copied from template: Cinematic storyboard',
                visibility: 'private',
                ownerId: 'user-local',
                ownedByCurrentUser: true,
                tags: ['cinematic', 'storyboard'],
                thumbnailUrl: 'cc-asset://asset/asset-cover',
            });
            expect(workflows.getLatestVersion('draft-copy')?.graph).toEqual(templateGraph);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
    it('keeps unpublished private templates hidden and blocks publishing invalid templates', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-template-publish-'));
        const dbPath = join(tempDir, 'workflow-template.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const workflows = createWorkflowRepository(db, { currentUserId: 'user-local' });
            workflows.create({
                id: 'template-draft',
                name: 'Private template draft',
                scope: 'template',
                published: false,
                visibility: 'private',
                ownerId: 'user-local',
                createdAt: 1_784_200_000_000,
                updatedAt: 1_784_200_000_000,
            });
            workflows.addVersion({
                id: 'template-invalid-version',
                workflowId: 'template-draft',
                graph: {
                    ...templateGraph,
                    nodes: [
                        ...templateGraph.nodes,
                        { id: 'legacy-mj', type: 'mjImage', position: { x: 640, y: 0 }, data: { label: 'Ignored legacy MJ' } },
                    ],
                },
                createdAt: 1_784_200_000_100,
                createdBy: 'user-local',
            });
            expect(workflows.listTemplates()).toEqual([]);
            expect(workflows.listTemplates({ scope: 'my' })).toMatchObject([
                {
                    id: 'template-draft',
                    scope: 'template',
                    published: false,
                    visibility: 'private',
                    ownedByCurrentUser: true,
                },
            ]);
            const rejected = workflows.publishTemplate({
                workflowId: 'template-draft',
                visibility: 'public',
                validation: {
                    valid: false,
                    issues: [
                        {
                            code: 'unsupported_node_type',
                            severity: 'error',
                            message: 'MJ nodes are intentionally out of scope.',
                            nodeId: 'legacy-mj',
                        },
                    ],
                },
                updatedAt: 1_784_200_000_200,
            });
            expect(rejected).toMatchObject({
                errorClass: 'workflow_template_validation_failed',
                retryable: false,
            });
            expect(workflows.listTemplates()).toEqual([]);
            const published = workflows.publishTemplate({
                workflowId: 'template-draft',
                visibility: 'public',
                validation: { valid: true, issues: [] },
                updatedAt: 1_784_200_000_300,
            });
            expect(published).toMatchObject({
                id: 'template-draft',
                published: true,
                visibility: 'public',
            });
            expect(workflows.listTemplates()).toHaveLength(1);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
    it('publishes templates through strict canvas validation in the IPC handler', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-workflow-template-ipc-'));
        const dbPath = join(tempDir, 'workflow-template.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const workflows = createWorkflowRepository(db, { currentUserId: 'user-local' });
            workflows.create({
                id: 'template-ipc',
                name: 'IPC template',
                scope: 'template',
                published: false,
                visibility: 'private',
                ownerId: 'user-local',
                createdAt: 1_784_200_000_000,
                updatedAt: 1_784_200_000_000,
            });
            workflows.addVersion({
                id: 'template-ipc-version',
                workflowId: 'template-ipc',
                graph: templateGraph,
                createdAt: 1_784_200_000_100,
                createdBy: 'user-local',
            });
            const ipc = createFakeIpcMain();
            registerCanvasHandlers(ipc.ipcMain, {
                workflows,
                clock: () => 1_784_200_000_200,
                currentUserId: 'user-local',
            });
            const result = await ipc.handlers.get('canvas.publishWorkflowTemplate')?.({}, {
                workflowId: 'template-ipc',
                visibility: 'public',
            });
            expect(result).toMatchObject({
                id: 'template-ipc',
                scope: 'template',
                published: true,
                visibility: 'public',
                ownedByCurrentUser: true,
            });
            expect(workflows.listTemplates()).toHaveLength(1);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
