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
        expect(docs).toContain('## Agent 可用工具词汇表');
        expect(docs).toContain('根据当前 `createCanvasTools` descriptor 生成。');
        for (const tool of tools) {
            expect(docs).toContain(`| \`${tool.descriptor.id}\` |`);
            expect(docs).toContain(tool.descriptor.inputSchemaRef);
            expect(docs).toContain(tool.descriptor.outputSchemaRef);
        }
    });
    it('documents permissions, unsupported/manual-only actions, and Agent plan examples', () => {
        const docs = readFileSync('docs/api-contracts/tools-agents.md', 'utf8');
        expect(docs).toContain('### 权限模型');
        expect(docs).toContain('`canvas.read`');
        expect(docs).toContain('`canvas.write`');
        expect(docs).toContain('`destructive`');
        expect(docs).toContain('`provider.spend`');
        expect(docs).toContain('### 不支持或仅限手动的操作');
        expect(docs).toContain('MJ 节点/组件相关操作');
        expect(docs).toContain('视口适配（viewport fit）、hover 菜单');
        expect(docs).toContain('### Agent Plan 应用示例');
        expect(docs).toContain('canvas.createNode');
        expect(docs).toContain('canvas.connectNodes');
        expect(docs).toContain('canvas.runNode');
        expect(docs).toContain('shared/canvas-actions.ts');
    });
});
