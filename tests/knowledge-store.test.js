import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabaseAtPath, applyMigrations } from '../desktop/src/main/db/migrate';
import { createKnowledgeRepository } from '../desktop/src/main/db/repositories/knowledge.repo';
import { createKnowledgeStore } from '../desktop/src/main/knowledge/store';
describe('KnowledgeStore', () => {
    let tempRoot = '';
    let db = null;
    afterEach(() => {
        db?.close();
        db = null;
        if (tempRoot) {
            try {
                rmSync(tempRoot, { recursive: true, force: true });
            }
            catch {
                // Windows may keep SQLite handles briefly; ignore cleanup races in tests.
            }
            tempRoot = '';
        }
    });
    it('ingests, retrieves within scope, and excludes deleted documents after rebuild', () => {
        tempRoot = mkdtempSync(join(tmpdir(), 'cc-knowledge-'));
        const dbPath = join(tempRoot, 'knowledge.db');
        const filePath = join(tempRoot, 'notes.txt');
        writeFileSync(filePath, 'The hero learns sword techniques from the mountain hermit.\n\nAnother paragraph about travel.', 'utf8');
        db = openDatabaseAtPath(dbPath);
        applyMigrations(db);
        const repo = createKnowledgeRepository(db);
        const store = createKnowledgeStore({ repo, clock: () => 1_700_000_000_000 });
        const scope = { projectId: 'project-a', userApprovedSourceIds: ['project-a'] };
        const document = store.ingest({ sourceType: 'file', sourceRef: filePath, scope });
        expect(document.status).toBe('indexed');
        const hits = store.retrieve({
            query: 'sword hermit',
            scope,
            limit: 3,
            retrievalMode: 'lexical'
        });
        expect(hits.length).toBeGreaterThan(0);
        store.delete(document.id);
        const afterDelete = store.retrieve({
            query: 'sword hermit',
            scope,
            limit: 3,
            retrievalMode: 'lexical'
        });
        expect(afterDelete).toHaveLength(0);
        const rebuilt = store.rebuild('project-a');
        expect(rebuilt.documentCount).toBe(0);
    });
});
