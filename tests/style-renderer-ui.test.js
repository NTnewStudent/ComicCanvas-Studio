import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImageConfigV2Node from '../desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node';
import VideoConfigV2Node from '../desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node';
const inkStyle = {
    id: 'style-ink',
    code: 'ink',
    name: 'Industrial Ink',
    description: 'Monochrome comic ink',
    promptBefore: 'ink comic',
    promptAfter: 'paper texture',
    legacyPromptPreset: null,
    negativePrompt: null,
    coverAssetId: null,
    coverUrl: null,
    tags: ['comic'],
    enabled: true,
    sortOrder: 1,
    createdAt: 1,
    updatedAt: 1,
};
afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
});
describe('REQ-094 renderer style selectors', () => {
    it('loads node style options from the preload style API instead of a hardcoded list', async () => {
        const listStyles = vi.fn().mockResolvedValue([inkStyle]);
        window.comicCanvas = {
            listStyles,
        };
        render(_jsx(ReactFlowProvider, { children: _jsx(ImageConfigV2Node, { id: "image-style-node", selected: true, data: {
                    label: 'Image',
                    promptOverride: '',
                    modelId: 'stub-image',
                    orientation: 'landscape',
                    assetId: null,
                    status: 'idle',
                    stylePresetId: 'style-ink',
                } }) }));
        await waitFor(() => expect(listStyles).toHaveBeenCalledWith({ includeDisabled: false }));
        expect(await screen.findByText(/Industrial Ink/u)).toBeInTheDocument();
        fireEvent.click(screen.getByText(/Industrial Ink/u));
        expect(screen.queryByText('anime')).not.toBeInTheDocument();
    });
    it('loads video node style options from the preload style API', async () => {
        const listStyles = vi.fn().mockResolvedValue([inkStyle]);
        window.comicCanvas = {
            listStyles,
        };
        render(_jsx(ReactFlowProvider, { children: _jsx(VideoConfigV2Node, { ...({
                    id: 'video-style-node',
                    type: 'videoConfigV2',
                    selected: true,
                    zIndex: 0,
                    draggable: true,
                    dragging: false,
                    selectable: true,
                    deletable: true,
                    isConnectable: true,
                    positionAbsoluteX: 0,
                    positionAbsoluteY: 0,
                    data: {
                        label: 'Video',
                        promptOverride: '',
                        modelId: 'stub-video',
                        orientation: 'landscape',
                        durationSeconds: 5,
                        firstFrameAssetId: null,
                        lastFrameAssetId: null,
                        assetId: null,
                        status: 'idle',
                        stylePresetId: 'style-ink',
                    },
                }) }) }));
        await waitFor(() => expect(listStyles).toHaveBeenCalledWith({ includeDisabled: false }));
        expect(await screen.findByText(/Industrial Ink/u)).toBeInTheDocument();
    });
});
