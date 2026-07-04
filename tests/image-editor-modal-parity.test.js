import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorModal } from '../desktop/src/renderer/src/canvas/components/ImageEditorModal';
import { ImageNode } from '../desktop/src/renderer/src/canvas/nodes/ImageNode';
afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
});
const nodeData = {
    label: 'Hero Image',
    promptOverride: '',
    modelId: 'stub-image',
    orientation: 'landscape',
    assetId: 'asset-hero',
    url: 'cc-asset://asset/asset-hero',
    status: 'done'
};
describe('Task 37 image editor modal parity', () => {
    it('edits crop, rotation, orientation preview, target, and emits a structured image edit intent', () => {
        const onApply = vi.fn();
        render(_jsx(ImageEditorModal, { nodeId: "image-1", assetId: "asset-hero", safeUrl: "cc-asset://asset/asset-hero", label: "Hero Image", orientation: "landscape", onApply: onApply, onClose: vi.fn() }));
        expect(screen.getByRole('dialog', { name: '编辑图片资产 Hero Image' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Hero Image edit preview' })).toHaveAttribute('src', 'cc-asset://asset/asset-hero');
        expect(screen.getByTestId('image-editor-preview-frame')).toHaveStyle({ aspectRatio: '16 / 9' });
        fireEvent.change(screen.getByRole('spinbutton', { name: '裁剪 X' }), { target: { value: '10' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: '裁剪 Y' }), { target: { value: '12' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: '裁剪宽度' }), { target: { value: '80' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: '裁剪高度' }), { target: { value: '70' } });
        fireEvent.click(screen.getByRole('button', { name: '顺时针旋转 90 度' }));
        fireEvent.click(screen.getByRole('button', { name: '使用竖图方向' }));
        fireEvent.click(screen.getByRole('radio', { name: '应用到资产' }));
        fireEvent.click(screen.getByRole('button', { name: '应用图片编辑' }));
        expect(onApply).toHaveBeenCalledWith({
            nodeId: 'image-1',
            assetId: 'asset-hero',
            safeUrl: 'cc-asset://asset/asset-hero',
            crop: { x: 10, y: 12, width: 80, height: 70 },
            rotationDeg: 90,
            orientation: 'portrait',
            applyTarget: 'asset'
        });
    });
    it('opens the editor from ImageNode and applies edits through the node callback', () => {
        const onApplyImageEdit = vi.fn();
        render(_jsx(ReactFlowProvider, { children: _jsx(ImageNode, { id: "image-1", data: nodeData, selected: true, assetSafeUrl: "cc-asset://asset/asset-hero", onApplyImageEdit: onApplyImageEdit }) }));
        fireEvent.click(screen.getByRole('button', { name: '编辑图片资产' }));
        expect(screen.getByRole('dialog', { name: '编辑图片资产 Hero Image' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '使用方图方向' }));
        fireEvent.click(screen.getByRole('button', { name: '应用图片编辑' }));
        expect(onApplyImageEdit).toHaveBeenCalledWith(expect.objectContaining({
            nodeId: 'image-1',
            assetId: 'asset-hero',
            orientation: 'square',
            applyTarget: 'node'
        }));
    });
});
