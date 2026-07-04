import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo';
import { createChatMessageRepository } from '../desktop/src/main/db/repositories/chat-message.repo';
import { createJobRepository } from '../desktop/src/main/db/repositories/job.repo';
import { createWorkflowRepository } from '../desktop/src/main/db/repositories/workflow.repo';
const requiredRepositoryFiles = [
    'agent.repo.ts',
    'asset.repo.ts',
    'chat-message.repo.ts',
    'gateway.repo.ts',
    'job.repo.ts',
    'knowledge.repo.ts',
    'skill.repo.ts',
    'storage.repo.ts',
    'tool.repo.ts',
    'workflow.repo.ts'
];
function listSourceFiles(root) {
    if (!existsSync(root)) {
        return [];
    }
    return readdirSync(root).flatMap((entry) => {
        const filePath = join(root, entry);
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
            return listSourceFiles(filePath);
        }
        return filePath;
    });
}
describe('M1 repository boundaries', () => {
    it('defines the required repository files', () => {
        for (const fileName of requiredRepositoryFiles) {
            expect(existsSync(join('desktop/src/main/db/repositories', fileName)), `${fileName} should exist`).toBe(true);
        }
    });
    it('keeps raw Drizzle and SQL access inside db modules only', () => {
        const files = listSourceFiles('desktop/src/main')
            .filter((file) => /\.(ts|tsx)$/.test(file))
            .filter((file) => !file.includes('desktop\\src\\main\\db\\') && !file.includes('desktop/src/main/db/'));
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            expect(source, `${file} must not import Drizzle`).not.toContain('drizzle-orm');
            expect(source, `${file} must not import better-sqlite3`).not.toContain('better-sqlite3');
            expect(source, `${file} must not run raw SQL`).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/);
        }
    });
    it('can write and read through repository APIs after migration', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-repo-'));
        const dbPath = join(tempDir, 'repo.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const now = 1_782_300_000_000;
            const jobs = createJobRepository(db);
            const assets = createAssetRepository(db);
            const workflows = createWorkflowRepository(db);
            const chatMessages = createChatMessageRepository(db);
            jobs.create({
                id: 'job-1',
                type: 'canvas.generateImage',
                status: 'pending',
                payload: { nodeId: 'image-1' },
                progress: 0,
                attempts: 0,
                retryable: false,
                createdAt: now,
                updatedAt: now
            });
            assets.create({
                id: 'asset-1',
                mediaType: 'image',
                status: 'ready',
                relativePath: 'generated/asset-1.png',
                safeUrl: 'cc-asset://asset/asset-1',
                metadata: { width: 1024, height: 768, orientation: 'landscape' },
                createdAt: now,
                updatedAt: now
            });
            workflows.create({ id: 'workflow-1', name: 'Demo workflow', createdAt: now, updatedAt: now });
            workflows.addVersion({
                id: 'workflow-version-1',
                workflowId: 'workflow-1',
                graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
                createdAt: now,
                createdBy: 'test'
            });
            chatMessages.create({
                id: 'message-1',
                workflowId: 'workflow-1',
                role: 'user',
                content: 'hello',
                createdAt: now
            });
            expect(jobs.getById('job-1')?.payload).toEqual({ nodeId: 'image-1' });
            expect(assets.getById('asset-1')?.safeUrl).toBe('cc-asset://asset/asset-1');
            expect(workflows.getLatestVersion('workflow-1')?.graph).toEqual({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
            expect(chatMessages.listByWorkflowId('workflow-1')).toHaveLength(1);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
