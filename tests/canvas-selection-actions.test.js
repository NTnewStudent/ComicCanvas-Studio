import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { duplicateSelectedCanvasNodes, deleteSelectedCanvasNodes, } from '../desktop/src/renderer/src/canvas/lib/canvas-selection-actions';
import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store';
function createStore() {
    return createCanvasStore({
        idFactory: (() => {
            let index = 0;
            return () => `node-${++index}`;
        })(),
        edgeIdFactory: (source, target) => `edge-${source}-${target}`,
        clock: () => 1_782_700_000_000,
    });
}
describe('REQ-092 canvas selection actions', () => {
    it('duplicates selected nodes with internal edges in one undoable store change', () => {
        const store = createStore();
        const text = store.getState().addNode('text', { x: 0, y: 0 }, { label: 'Story' });
        const image = store.getState().addNode('image', { x: 260, y: 0 }, { label: 'Image' });
        const video = store.getState().addNode('video', { x: 520, y: 0 }, { label: 'Video' });
        expect(store.getState().addEdge(text, image)).toEqual({ ok: true, edgeId: `edge-${text}-${image}` });
        expect(store.getState().addEdge(image, video)).toEqual({ ok: true, edgeId: `edge-${image}-${video}` });
        const pastBefore = store.getState().past.length;
        const result = duplicateSelectedCanvasNodes({
            store,
            selectedNodeIds: [text, image],
            idFactory: (() => {
                let index = 0;
                return () => `copy-${++index}`;
            })(),
            edgeIdFactory: (source, target) => `copy-edge-${source}-${target}`,
            offset: { x: 40, y: 40 },
        });
        expect(result).toEqual({
            duplicatedNodeIds: ['copy-1', 'copy-2'],
            duplicatedEdgeIds: ['copy-edge-copy-1-copy-2'],
        });
        expect(store.getState().nodes.map((node) => node.id)).toEqual([text, image, video, 'copy-1', 'copy-2']);
        expect(store.getState().nodes.find((node) => node.id === 'copy-1')?.position).toEqual({ x: 40, y: 40 });
        expect(store.getState().nodes.find((node) => node.id === 'copy-2')?.position).toEqual({ x: 300, y: 40 });
        expect(store.getState().edges.map((edge) => edge.id)).toEqual([
            `edge-${text}-${image}`,
            `edge-${image}-${video}`,
            'copy-edge-copy-1-copy-2',
        ]);
        expect(store.getState().past).toHaveLength(pastBefore + 1);
        store.getState().undo();
        expect(store.getState().nodes.map((node) => node.id)).toEqual([text, image, video]);
        expect(store.getState().edges.map((edge) => edge.id)).toEqual([`edge-${text}-${image}`, `edge-${image}-${video}`]);
    });
    it('deletes selected nodes and connected edges in one undoable store change', () => {
        const store = createStore();
        const text = store.getState().addNode('text', { x: 0, y: 0 });
        const image = store.getState().addNode('image', { x: 260, y: 0 });
        const video = store.getState().addNode('video', { x: 520, y: 0 });
        expect(store.getState().addEdge(text, image)).toEqual({ ok: true, edgeId: `edge-${text}-${image}` });
        expect(store.getState().addEdge(image, video)).toEqual({ ok: true, edgeId: `edge-${image}-${video}` });
        const pastBefore = store.getState().past.length;
        const result = deleteSelectedCanvasNodes({ store, selectedNodeIds: [image] });
        expect(result).toEqual({ deletedNodeIds: [image], deletedEdgeIds: [`edge-${text}-${image}`, `edge-${image}-${video}`] });
        expect(store.getState().nodes.map((node) => node.id)).toEqual([text, video]);
        expect(store.getState().edges).toEqual([]);
        expect(store.getState().past).toHaveLength(pastBefore + 1);
        store.getState().undo();
        expect(store.getState().nodes.map((node) => node.id)).toEqual([text, image, video]);
        expect(store.getState().edges.map((edge) => edge.id)).toEqual([`edge-${text}-${image}`, `edge-${image}-${video}`]);
    });
    it('wires selected-node duplicate and delete actions into CanvasPage keyboard shortcuts and menus', () => {
        const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8');
        expect(source).toContain('duplicateSelectedCanvasNodes');
        expect(source).toContain('deleteSelectedCanvasNodes');
        expect(source).toContain("key === 'd'");
        expect(source).toContain("event.key === 'Delete' || (isMacLikePlatform && event.key === 'Backspace')");
        expect(source).toContain('isEditableKeyboardTarget(event.target)');
        expect(source).toContain('handleDuplicateSelection(selectedNodeIds)');
        expect(source).toContain('handleDeleteSelection(selectedNodeIds)');
        expect(source).toContain('handleDuplicateSelection([contextMenu.nodeId!])');
        expect(source).toContain('handleDeleteSelection([contextMenu.nodeId!])');
    });
});
