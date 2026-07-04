import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAssetPipeline } from '../desktop/src/main/assets/pipeline';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo';
import { createJobRepository } from '../desktop/src/main/db/repositories/job.repo';
import { createJobEventBus } from '../desktop/src/main/jobs/events';
import { createJobQueue } from '../desktop/src/main/jobs/queue';
import { createJobWorker } from '../desktop/src/main/jobs/worker';
import { createGatewayRegistry } from '../desktop/src/main/providers/registry';
import { createStubProvider } from '../desktop/src/main/providers/stub.provider';
import { runImageNodeSmokePath } from '../desktop/src/main/smoke/m1-smoke';
describe('M1 smoke path', () => {
    it('runs image node generation through queue, stub provider, asset pipeline, and terminal event', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-m1-smoke-'));
        const dbPath = join(tempDir, 'smoke.sqlite');
        const assetRoot = join(tempDir, 'assets');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const jobs = createJobRepository(db);
            const assets = createAssetRepository(db);
            const events = createJobEventBus();
            const queue = createJobQueue({
                jobs,
                idFactory: () => 'job-smoke-1',
                clock: () => 1_782_600_000_000
            });
            const pipeline = createAssetPipeline({
                assetRoot,
                assets,
                idFactory: () => 'asset-smoke-1',
                clock: () => 1_782_600_000_001
            });
            const gateways = createGatewayRegistry();
            gateways.set('stub-main', createStubProvider());
            const worker = createJobWorker({
                jobs,
                events,
                leaseOwner: 'smoke-worker',
                clock: () => 1_782_600_000_002,
                handlers: {
                    'canvas.generateImage': async (job) => runImageNodeSmokePath({
                        job,
                        gateways,
                        assets: pipeline,
                        gatewayId: 'stub-main'
                    })
                }
            });
            const ticket = queue.enqueue({
                type: 'canvas.generateImage',
                targetId: 'image-node-smoke',
                payload: {
                    prompt: '宇宙飞船',
                    modelKey: 'stub-image',
                    parameters: { orientation: 'landscape' }
                },
                requestedBy: { type: 'user', id: 'user-1' }
            });
            expect(ticket).toEqual({ jobId: 'job-smoke-1', status: 'pending', createdAt: 1_782_600_000_000 });
            expect(await worker.runNext()).toBe('job-smoke-1');
            const completedJob = jobs.getById('job-smoke-1');
            const asset = assets.getById('asset-smoke-1');
            expect(completedJob?.status).toBe('completed');
            expect(completedJob?.result).toEqual({
                kind: 'asset',
                assetId: 'asset-smoke-1',
                metadata: {
                    safeUrl: 'cc-asset://asset/asset-smoke-1',
                    orientation: 'landscape'
                }
            });
            expect(events.getTerminalEvents()).toEqual([
                {
                    channel: 'job.completed',
                    jobId: 'job-smoke-1',
                    result: {
                        kind: 'asset',
                        assetId: 'asset-smoke-1',
                        metadata: {
                            safeUrl: 'cc-asset://asset/asset-smoke-1',
                            orientation: 'landscape'
                        }
                    },
                    emittedAt: 1_782_600_000_002
                }
            ]);
            expect(asset).toMatchObject({
                id: 'asset-smoke-1',
                status: 'ready',
                mediaType: 'image',
                safeUrl: 'cc-asset://asset/asset-smoke-1',
                metadata: {
                    width: 1024,
                    height: 768,
                    orientation: 'landscape',
                    mimeType: 'image/png'
                }
            });
            expect(asset?.relativePath).toMatch(/^generated\/image\//u);
            expect(asset?.relativePath).not.toContain(':');
            expect(asset?.relativePath).not.toContain('..');
            expect(asset ? existsSync(join(assetRoot, asset.relativePath)) : false).toBe(true);
            expect(JSON.stringify(ticket)).not.toMatch(/asset|bytes|cc-asset|[A-Za-z]:\\\\/u);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
