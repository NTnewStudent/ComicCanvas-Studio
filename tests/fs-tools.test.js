import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFsTools } from '../desktop/src/main/tools/fs';
import { createToolRuntime } from '../desktop/src/main/tools/runtime';
const actor = { type: 'agent', id: 'general-purpose' };
let root;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'comiccanvas-fs-tools-'));
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), 'export const hello = "world"\nconst secret = 1\n');
    writeFileSync(join(root, 'src', 'b.ts'), 'export const value = 42\n');
    writeFileSync(join(root, 'README.md'), '# Title\nhello docs\n');
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});
function runtimeFor() {
    return createToolRuntime({ tools: createFsTools({ workspaceRoot: root }) });
}
describe('universal read-only fs tools', () => {
    it('registers fs.read, fs.glob, and fs.grep as readonly file tools', () => {
        const tools = createFsTools({ workspaceRoot: root });
        expect(tools.map((tool) => tool.descriptor.id).sort()).toEqual(['fs.glob', 'fs.grep', 'fs.read']);
        for (const tool of tools) {
            expect(tool.descriptor.category).toBe('file');
            expect(tool.descriptor.concurrency).toBe('readonly');
            expect(tool.descriptor.permissions).toContainEqual({ kind: 'file.read', reason: 'Reads project files within the workspace root.' });
        }
    });
    it('reads a file within the workspace and reports a workspace-relative path', async () => {
        const runtime = runtimeFor();
        const result = await runtime.invoke({ toolId: 'fs.read', input: { path: 'src/a.ts' }, actor, traceId: 'trace-read' });
        expect(result.output).toMatchObject({ path: 'src/a.ts', truncated: false });
        expect(result.output.content).toContain('hello');
    });
    it('rejects path traversal outside the workspace root', async () => {
        const runtime = runtimeFor();
        const result = await runtime.invoke({ toolId: 'fs.read', input: { path: '../../etc/passwd' }, actor, traceId: 'trace-escape' });
        expect(result.record.status).toBe('failed');
        expect(result.error?.code).toBe('path_out_of_scope');
    });
    it('globs files by pattern', async () => {
        const runtime = runtimeFor();
        const result = await runtime.invoke({ toolId: 'fs.glob', input: { pattern: '**/*.ts' }, actor, traceId: 'trace-glob' });
        expect(result.output.matches).toEqual(['src/a.ts', 'src/b.ts']);
    });
    it('greps file contents and returns matching lines', async () => {
        const runtime = runtimeFor();
        const result = await runtime.invoke({ toolId: 'fs.grep', input: { query: 'hello', include: '**/*.ts' }, actor, traceId: 'trace-grep' });
        const matches = result.output.matches;
        expect(matches).toEqual([{ path: 'src/a.ts', line: 1, text: 'export const hello = "world"' }]);
    });
});
