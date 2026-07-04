import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('infinite canvas architecture note', () => {
    it('records the Phase 11 architecture invariants before implementation work', () => {
        const notePath = 'docs/architecture/infinite-canvas-architecture.md';
        expect(existsSync(notePath)).toBe(true);
        const note = readFileSync(notePath, 'utf8');
        const tasks = readFileSync('specs/hjwall-assets-workflows-100-migration/tasks.md', 'utf8');
        for (const section of [
            '## Graph State Ownership',
            '## Viewport Math',
            '## Virtualization Strategy',
            '## Spatial Indexing',
            '## Selection Model',
            '## Minimap',
            '## Persistence And Autosave Invariants',
            '## Performance Gates'
        ]) {
            expect(note).toContain(section);
        }
        expect(note).toContain('Zustand owns the durable graph snapshot');
        expect(note).toContain('React Flow owns transient viewport gestures');
        expect(note).toContain('screenToFlowPosition');
        expect(note).toContain('visible-node query');
        expect(note).toContain('100, 500, and 1000 node');
        expect(note).toContain('Phase A acceptance gate');
        expect(note).toContain('Task 61');
        expect(tasks).toContain('- [x] 61. Write infinite canvas architecture note.');
    });
});
