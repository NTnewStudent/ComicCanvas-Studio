import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageConfigV2Node from '../desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node';
import { canvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store';
beforeEach(() => {
    canvasStore.getState().setNodes([]);
    canvasStore.getState().setEdges([]);
    canvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
    window.comicCanvas = {
        listStyles: vi.fn().mockResolvedValue([]),
    };
});
afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
});
describe('REQ-092 V2 node @mention edge validation', () => {
    it('lists canvas nodes as @mention targets and creates a validated mention edge', async () => {
        canvasStore.getState().setNodes([
            {
                id: 'text-1',
                type: 'text',
                position: { x: 0, y: 0 },
                data: { label: 'Story Beat', content: 'rainy detective intro' },
            },
            {
                id: 'image-1',
                type: 'imageConfigV2',
                position: { x: 260, y: 0 },
                data: {
                    label: 'Image Prompt',
                    promptOverride: '',
                    prompt: '',
                    modelId: 'stub-image',
                    orientation: 'landscape',
                    assetId: null,
                    status: 'idle',
                },
            },
        ]);
        render(_jsx(ReactFlowProvider, { children: _jsx(ImageConfigV2Node, { id: "image-1", selected: true, data: {
                    label: 'Image Prompt',
                    promptOverride: '',
                    prompt: '',
                    modelId: 'stub-image',
                    orientation: 'landscape',
                    assetId: null,
                    status: 'idle',
                } }) }));
        const prompt = screen.getByRole('textbox');
        fireEvent.change(prompt, { target: { value: '@Sto', selectionStart: 4 } });
        const option = await screen.findByText('Story Beat');
        fireEvent.mouseDown(option);
        await waitFor(() => {
            expect(canvasStore.getState().edges).toEqual([
                expect.objectContaining({
                    source: 'text-1',
                    target: 'image-1',
                    data: expect.objectContaining({ createdByMention: true }),
                }),
            ]);
        });
    });
});
