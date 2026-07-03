import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StyleLibraryPanel } from '../desktop/src/renderer/src/canvas/components/StyleLibraryPanel';
const inkStyle = {
    id: 'style-ink',
    code: 'ink',
    name: 'Industrial Ink',
    description: 'Monochrome comic ink',
    promptBefore: 'ink comic',
    promptAfter: 'paper texture',
    legacyPromptPreset: null,
    negativePrompt: 'low quality',
    coverAssetId: 'asset-cover-ink',
    coverUrl: 'cc-asset://asset/asset-cover-ink',
    tags: ['comic', 'ink'],
    enabled: true,
    sortOrder: 1,
    createdAt: 1,
    updatedAt: 1,
};
const disabledStyle = {
    ...inkStyle,
    id: 'style-disabled',
    code: 'old',
    name: 'Retired Neon',
    description: 'Disabled legacy style',
    promptBefore: 'old neon',
    promptAfter: null,
    negativePrompt: null,
    coverAssetId: null,
    coverUrl: null,
    tags: ['legacy'],
    enabled: false,
    sortOrder: 2,
};
function createApi(overrides = {}) {
    return {
        listStyles: vi.fn().mockResolvedValue([inkStyle, disabledStyle]),
        getProjectDefaultStyle: vi.fn().mockResolvedValue({ workflowId: 'workflow-1', stylePresetId: 'style-ink' }),
        setProjectDefaultStyle: vi.fn().mockResolvedValue({ workflowId: 'workflow-1', stylePresetId: 'style-disabled' }),
        ...overrides,
    };
}
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});
describe('Task 50 canvas style library panel parity', () => {
    it('lists style presets with cover, tags, current default, and disabled markers', async () => {
        const api = createApi();
        render(_jsx(StyleLibraryPanel, { open: true, workflowId: "workflow-1", onClose: vi.fn(), api: api }));
        expect(await screen.findByRole('heading', { name: 'Industrial Ink' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Industrial Ink 封面' })).toHaveAttribute('src', 'cc-asset://asset/asset-cover-ink');
        expect(screen.getByText('Monochrome comic ink')).toBeInTheDocument();
        expect(screen.getByText('comic')).toBeInTheDocument();
        expect(screen.getAllByText('ink').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('当前项目默认')).toBeInTheDocument();
        expect(screen.getByText('Retired Neon')).toBeInTheDocument();
        expect(screen.getByText('已停用')).toBeInTheDocument();
        expect(api.listStyles).toHaveBeenCalledWith({ includeDisabled: true });
        expect(api.getProjectDefaultStyle).toHaveBeenCalledWith({ workflowId: 'workflow-1' });
    });
    it('sets and clears the workflow default style from the canvas panel', async () => {
        const setProjectDefaultStyle = vi
            .fn()
            .mockResolvedValueOnce({ workflowId: 'workflow-1', stylePresetId: 'style-disabled' })
            .mockResolvedValueOnce({ workflowId: 'workflow-1', stylePresetId: null });
        const api = createApi({
            getProjectDefaultStyle: vi.fn().mockResolvedValue({ workflowId: 'workflow-1', stylePresetId: null }),
            setProjectDefaultStyle,
        });
        render(_jsx(StyleLibraryPanel, { open: true, workflowId: "workflow-1", onClose: vi.fn(), api: api }));
        fireEvent.click(await screen.findByRole('button', { name: '设为项目默认 Retired Neon' }));
        await waitFor(() => expect(setProjectDefaultStyle).toHaveBeenCalledWith({
            workflowId: 'workflow-1',
            stylePresetId: 'style-disabled',
        }));
        expect(await screen.findByText('当前项目默认')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '清除项目默认画风' }));
        await waitFor(() => expect(setProjectDefaultStyle).toHaveBeenCalledWith({
            workflowId: 'workflow-1',
            stylePresetId: null,
        }));
    });
});
