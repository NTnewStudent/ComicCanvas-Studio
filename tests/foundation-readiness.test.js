import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('core platform implementation readiness', () => {
    it('documents the remaining M0 foundation contracts before M1 starts', () => {
        expect(existsSync('docs/architecture/core-platform-implementation-readiness.md')).toBe(true);
        const readiness = readFileSync('docs/architecture/core-platform-implementation-readiness.md', 'utf8');
        for (const heading of [
            '## DB Schema Draft',
            '## Repository Ownership Boundaries',
            '## Migration Policy',
            '## Runtime Skeleton Plans',
            '## Settings And Admin Surfaces',
            '## Initial Built-In Tools',
            '## Initial Built-In Skills',
            '## Default Agent Lineup And Handoff Rules'
        ]) {
            expect(readiness).toContain(heading);
        }
    });
    it('records the no-demo acceptance review and M0 verification gates', () => {
        expect(existsSync('docs/progress/no-demo-acceptance-review.md')).toBe(true);
        const review = readFileSync('docs/progress/no-demo-acceptance-review.md', 'utf8');
        for (const phrase of [
            'Placeholder Scan',
            'No-Demo Acceptance Review',
            'M0 Exit Decision',
            'M1 may start'
        ]) {
            expect(review).toContain(phrase);
        }
    });
});
