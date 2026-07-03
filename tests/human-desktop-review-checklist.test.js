import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('human desktop review checklist', () => {
    it('covers every Phase A assets/workflows migration review area', () => {
        const checklist = readFileSync('docs/progress/human-desktop-review-checklist.md', 'utf8');
        const requiredRows = [
            'HDR-ASSET-001',
            'HDR-ASSET-009',
            'HDR-WF-006',
            'HDR-CANVAS-005',
            'HDR-NODE-002',
            'HDR-RUNTIME-002',
            'HDR-TOOLS-001',
            'HDR-PHASEA-001'
        ];
        for (const rowId of requiredRows) {
            expect(checklist, `${rowId} row`).toContain(`| ${rowId} |`);
        }
        expect(checklist).toContain('Human Phase A Acceptance Matrix');
        expect(checklist).toContain('assets and custom image categories');
        expect(checklist).toContain('project/templates and snippets');
        expect(checklist).toContain('canvas shell and migrated non-MJ nodes');
        expect(checklist).toContain('runtime, styles, models, and tool equivalence');
        expect(checklist).toContain('Agent automation remains out of scope for Phase A');
        expect(checklist).toContain('MJ node/component actions are excluded from manual Phase A acceptance');
    });
});
