import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const nodeFiles = [
    'desktop/src/renderer/src/canvas/nodes/TextNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/ImageNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/VideoNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx',
    'desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx',
    'desktop/src/renderer/src/canvas/nodes/CharacterNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/SceneNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/AudioNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/VideoComposeNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/SuperResolutionNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/MigratedNode.tsx',
    'desktop/src/renderer/src/canvas/nodes/MjImageNode.tsx'
];
describe('M2 NodeResizer integration', () => {
    it('uses @xyflow/react NodeResizer in resizable canvas nodes', () => {
        for (const file of nodeFiles) {
            const source = readFileSync(file, 'utf8');
            expect(source).toContain("from '@xyflow/react'");
            expect(source).toContain('<NodeResizer');
            expect(source).toContain('NODE_RESIZER_CLASS_NAMES');
        }
    });
    it('lets node content fill the React Flow resized wrapper', () => {
        for (const file of nodeFiles) {
            const source = readFileSync(file, 'utf8');
            expect(source).toContain('h-full');
            expect(source).toContain('w-full');
        }
    });
    it('persists React Flow node dimensions through canvas graph snapshots', () => {
        const canvasPage = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8');
        const store = readFileSync('desktop/src/renderer/src/canvas/store/canvas.store.ts', 'utf8');
        const graph = readFileSync('shared/graph.ts', 'utf8');
        expect(store).toContain('width?: number');
        expect(store).toContain('height?: number');
        expect(graph).toContain('width?: number');
        expect(graph).toContain('height?: number');
        expect(canvasPage).toContain('...(n.width ? { width: n.width } : {})');
        expect(canvasPage).toContain('...(n.height ? { height: n.height } : {})');
        expect(canvasPage).toContain('style: { ...(n.width ? { width: n.width } : {}), ...(n.height ? { height: n.height } : {}) }');
    });
    it('uses shared default dimensions when new nodes are created', () => {
        const canvasPage = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8');
        const canvasActions = readFileSync('shared/canvas-actions.ts', 'utf8');
        const nodeSizing = readFileSync('desktop/src/renderer/src/canvas/lib/node-sizing.ts', 'utf8');
        expect(canvasPage).toContain("from '../../../../../shared/node-layout'");
        expect(canvasPage).toContain('const size = defaultCanvasNodeSize(type)');
        expect(canvasPage).toContain('const size = defaultCanvasNodeSize(nodeType)');
        expect(canvasActions).toContain("from './node-layout'");
        expect(canvasActions).toContain('...defaultCanvasNodeSize(input.type)');
        expect(nodeSizing).toContain("from '../../../../../../shared/node-layout'");
    });
});
