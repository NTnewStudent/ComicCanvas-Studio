import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionFeedback } from '../desktop/src/renderer/src/canvas/components/ConnectionFeedback';
import { createCanvasConnectHandler } from '../desktop/src/renderer/src/canvas/lib/connection-validation';
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
afterEach(() => {
    cleanup();
});
describe('M2 connection validation UX', () => {
    it('creates valid edges through the canvas store and reports duplicate connections in Chinese immediately', () => {
        const store = createStore();
        const notify = vi.fn();
        const text = store.getState().addNode('text', { x: 0, y: 0 });
        const image = store.getState().addNode('image', { x: 260, y: 0 });
        const onConnect = createCanvasConnectHandler({ store, notify });
        expect(onConnect({ source: text, target: image })).toEqual({ ok: true, edgeId: `edge-${text}-${image}` });
        expect(store.getState().edges).toHaveLength(1);
        expect(notify).not.toHaveBeenCalled();
        expect(onConnect({ source: text, target: image })).toEqual({ ok: false, reason: 'duplicate_edge' });
        expect(store.getState().edges).toHaveLength(1);
        expect(notify).toHaveBeenCalledWith({
            reason: 'duplicate_edge',
            message: '这两个节点已经连接过了',
            at: 1_782_700_000_000,
        });
    });
    it('rejects invalid source and target pairs with a matrix-backed Chinese reason within 200ms', () => {
        const store = createStore();
        const notify = vi.fn();
        const video = store.getState().addNode('video', { x: 0, y: 0 });
        const image = store.getState().addNode('image', { x: 260, y: 0 });
        const onConnect = createCanvasConnectHandler({ store, notify });
        const startedAt = performance.now();
        expect(onConnect({ source: video, target: image })).toEqual({ ok: false, reason: 'connection_not_allowed' });
        expect(performance.now() - startedAt).toBeLessThan(200);
        expect(store.getState().edges).toHaveLength(0);
        expect(notify).toHaveBeenCalledWith({
            reason: 'connection_not_allowed',
            message: '视频节点不能连接到图片节点',
            at: 1_782_700_000_000,
        });
    });
    it('renders an accessible connection feedback notice', () => {
        render(_jsx(ConnectionFeedback, { feedback: {
                reason: 'connection_not_allowed',
                message: '视频节点不能连接到图片节点',
                at: 1_782_700_000_000,
            } }));
        expect(screen.getByRole('status')).toHaveTextContent('视频节点不能连接到图片节点');
    });
    it('wires the shared connect handler and feedback banner into CanvasPage', async () => {
        const { readFileSync } = await import('node:fs');
        const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8');
        expect(source).toContain("from './lib/canvas-edge-creation'");
        expect(source).toContain("from './components/ConnectionFeedback'");
        expect(source).toContain('createCanvasEdge({');
        expect(source).toContain('setConnectionFeedback');
        expect(source).toContain('<ConnectionFeedback');
    });
});
