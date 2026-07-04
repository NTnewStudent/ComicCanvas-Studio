import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runLargeGraphPerformanceGate } from '../desktop/src/main/smoke/large-graph-performance-gate';
describe('large graph performance gates', () => {
    it('covers 100, 500, and 1000 node graph operations without desktop acceptance claims', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-large-graph-gate-'));
        try {
            const result = runLargeGraphPerformanceGate({
                dbPath: join(tempDir, 'large-graph.sqlite'),
                nodeCounts: [100, 500, 1000]
            });
            expect(result.desktopAcceptanceClaimed).toBe(false);
            expect(result.gates.map((gate) => gate.nodeCount)).toEqual([100, 500, 1000]);
            for (const gate of result.gates) {
                expect(gate.edgeCount).toBe(gate.nodeCount - 1);
                expect(gate.visibleNodeCount).toBeGreaterThan(0);
                expect(gate.visibleNodeCount).toBeLessThanOrEqual(gate.nodeCount);
                expect(gate.selectorStable).toBe(true);
                expect(gate.draggedNodeId).toBe('node-0');
                expect(gate.panViewport).toEqual({ x: -320, y: 180, zoom: 0.72 });
                expect(gate.reopenedNodeCount).toBe(gate.nodeCount);
                expect(gate.reopenedEdgeCount).toBe(gate.edgeCount);
            }
        }
        finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
