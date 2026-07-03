import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('Phase A acceptance gate', () => {
    it('records automated evidence while keeping final acceptance behind human review', () => {
        const backlog = readFileSync('docs/progress/backlog.md', 'utf8');
        const gap = readFileSync('docs/progress/hjwall-assets-workflows-gap-analysis.md', 'utf8');
        const report = readFileSync('docs/progress/test-report.md', 'utf8');
        const tasks = readFileSync('specs/hjwall-assets-workflows-100-migration/tasks.md', 'utf8');
        for (const content of [backlog, gap, report]) {
            expect(content).toContain('phase-a-assets-workflows-smoke.test.ts');
            expect(content).toContain('HDR-PHASEA-001');
            expect(content).toContain('Phase A is not accepted');
            expect(content).toContain('human review pass or explicit product deferral');
        }
        expect(tasks).toContain('- [x] 58. Mark Phase A accepted only after human review pass or explicit product');
        expect(report).toContain('Task 58 decision: Phase A is not accepted');
    });
});
