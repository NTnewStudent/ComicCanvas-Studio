import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCanvasTools } from '../desktop/src/main/tools/canvas';
const emptyGraph = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
describe('Task 55 Agent-ready tool vocabulary docs', () => {
    it('documents every built-in canvas tool descriptor for future Agent plan apply', () => {
        const docs = readFileSync('docs/api-contracts/tools-agents.md', 'utf8');
        const tools = createCanvasTools({
            graphStore: { getGraph: () => emptyGraph, setGraph: () => undefined },
            clock: () => 1,
        });
        expect(docs).toContain('## Agent-Ready Tool Vocabulary');
        expect(docs).toContain('Generated from current `createCanvasTools` descriptors');
        for (const tool of tools) {
            expect(docs).toContain(`| \`${tool.descriptor.id}\` |`);
            expect(docs).toContain(tool.descriptor.inputSchemaRef);
            expect(docs).toContain(tool.descriptor.outputSchemaRef);
        }
    });
    it('documents permissions, unsupported/manual-only actions, and Agent plan examples', () => {
        const docs = readFileSync('docs/api-contracts/tools-agents.md', 'utf8');
        expect(docs).toContain('### Permission Model');
        expect(docs).toContain('`canvas.read`');
        expect(docs).toContain('`canvas.write`');
        expect(docs).toContain('`destructive`');
        expect(docs).toContain('`provider.spend`');
        expect(docs).toContain('### Unsupported Or Manual-Only Actions');
        expect(docs).toContain('MJ node/component actions');
        expect(docs).toContain('viewport fit, hover menus, drag previews');
        expect(docs).toContain('### Agent Plan Apply Examples');
        expect(docs).toContain('canvas.createNode');
        expect(docs).toContain('canvas.connectNodes');
        expect(docs).toContain('canvas.runNode');
        expect(docs).toContain('shared/canvas-actions.ts');
    });
});
