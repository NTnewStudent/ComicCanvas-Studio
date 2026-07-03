import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SuperResolutionNode } from '../desktop/src/renderer/src/canvas/nodes/SuperResolutionNode';
function renderInFlow(element) {
    render(_jsx(ReactFlowProvider, { children: element }));
}
afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
});
describe('Task 35 super resolution node parity', () => {
    it('keeps input video, scene/resolution/fps controls, ticket-only run, output preview, and writeback', () => {
        const onChange = vi.fn();
        const onRun = vi.fn();
        const onWriteOutputAsset = vi.fn();
        renderInFlow(_jsx(SuperResolutionNode, { id: "super-1", selected: true, data: {
                label: 'Upscale Hero Shot',
                inputVideoId: 'video-source-1',
                scene: 'aigc',
                resolution: '1080p',
                fps: 30,
                assetId: 'asset-super-result',
                url: 'cc-asset://asset/asset-super-result',
                status: 'done'
            }, onChange: onChange, onRun: onRun, onWriteOutputAsset: onWriteOutputAsset }));
        expect(screen.getByText('video-source-1')).toBeInTheDocument();
        expect(screen.getByTestId('super-resolution-output')).toHaveAttribute('src', 'cc-asset://asset/asset-super-result');
        fireEvent.change(screen.getByRole('textbox', { name: '输入视频节点' }), {
            target: { value: 'video-clean' }
        });
        fireEvent.change(screen.getByRole('combobox', { name: '超分场景' }), { target: { value: 'old_film' } });
        fireEvent.change(screen.getByRole('combobox', { name: '目标分辨率' }), { target: { value: '4k' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: 'FPS' }), { target: { value: '60' } });
        expect(onChange).toHaveBeenCalledWith('super-1', { inputVideoId: 'video-clean' });
        expect(onChange).toHaveBeenCalledWith('super-1', { scene: 'old_film' });
        expect(onChange).toHaveBeenCalledWith('super-1', { resolution: '4k' });
        expect(onChange).toHaveBeenCalledWith('super-1', { fps: 60 });
        fireEvent.click(screen.getByRole('button', { name: '运行视频超分' }));
        expect(onRun).toHaveBeenCalledWith('super-1');
        expect(onChange).toHaveBeenCalledWith('super-1', { status: 'running', url: '' });
        fireEvent.click(screen.getByRole('button', { name: '写回超分输出资产' }));
        expect(onWriteOutputAsset).toHaveBeenCalledWith('super-1', 'asset-super-result');
    });
});
