import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const requiredContractDocs = [
    'canvas-plan.md',
    'jobs.md',
    'assets-files.md',
    'gateway-providers.md',
    'tools-plugins.md',
    'agents.md',
    'skills.md',
    'knowledge-context.md',
    'audit-observability.md',
    'storage-config.md'
];
const requiredSections = [
    '## Owner',
    '## Scope',
    '## Request/Response Contracts',
    '## Errors',
    '## Permissions',
    '## Tests'
];
describe('foundation API contract docs', () => {
    it('provides the full M0 contract set with required sections', () => {
        for (const docName of requiredContractDocs) {
            const filePath = join('docs', 'api-contracts', docName);
            expect(existsSync(filePath), `${docName} should exist`).toBe(true);
            const content = readFileSync(filePath, 'utf8');
            for (const section of requiredSections) {
                expect(content, `${docName} should include ${section}`).toContain(section);
            }
        }
    });
    it('documents Phase A asset category, upload progress, and reference boundaries', () => {
        const content = readFileSync(join('docs', 'api-contracts', 'assets-files.md'), 'utf8');
        expect(content).toContain('The built-in starter image categories SHALL be role, scene, prop, and creature.');
        expect(content).toContain('Asset category assignment SHALL preserve the underlying asset record');
        expect(content).toContain('blockingReferences: AssetReference[]');
        expect(content).toContain('Asset create/update/trash/tombstone changes SHALL be emitted through `asset.changed` IPC events.');
        expect(content).toContain('Renderer upload progress SHALL be modeled as local multi-file import state');
        expect(content).toContain('No `asset.uploadProgress` IPC channel is introduced');
    });
});
