import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
const rendererRoot = 'desktop/src/renderer/src';
const sourceExtensions = /\.(ts|tsx)$/u;
const skippedDirectories = new Set(['__tests__', 'node_modules']);
const pollingPatterns = [
    { name: 'setInterval', pattern: /\bsetInterval\s*\(/u },
    { name: 'refetchInterval', pattern: /\brefetchInterval\b/u },
    { name: 'asset polling loop', pattern: /\bpoll(?:Asset|Job|Status|Generation)\b/u }
];
function listSourceFiles(root) {
    return readdirSync(root).flatMap((entry) => {
        const filePath = join(root, entry);
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
            return skippedDirectories.has(entry) ? [] : listSourceFiles(filePath);
        }
        if (!sourceExtensions.test(entry) || /\.(spec|test)\.(ts|tsx)$/u.test(entry) || entry.endsWith('.d.ts')) {
            return [];
        }
        return filePath;
    });
}
describe('M2 renderer zero polling guard', () => {
    it('keeps renderer asset/job status updates free of polling loops', () => {
        expect(existsSync(rendererRoot)).toBe(true);
        const violations = listSourceFiles(rendererRoot).flatMap((filePath) => {
            const relativePath = relative(rendererRoot, filePath).split(sep).join('/');
            const lines = readFileSync(filePath, 'utf8').split('\n');
            return lines.flatMap((line, index) => pollingPatterns
                .filter(({ pattern }) => pattern.test(line))
                .map(({ name }) => `${relativePath}:${index + 1} (${name}) ${line.trim()}`));
        });
        expect(violations).toEqual([]);
    });
    it('exposes a typed preload event bridge instead of renderer polling', () => {
        const preload = readFileSync('desktop/src/preload/index.ts', 'utf8');
        const env = readFileSync('desktop/src/renderer/src/env.d.ts', 'utf8');
        expect(preload).toContain('function subscribeMain');
        expect(preload).toContain('onJobCompleted');
        expect(preload).toContain('onJobFailed');
        expect(preload).toContain('onAssetChanged');
        expect(env).toContain('ComicCanvasApi');
    });
});
