import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasJobPanel } from '../desktop/src/renderer/src/canvas/components/CanvasJobPanel';
const queuedJob = {
    id: 'job-queued',
    type: 'canvas.generateImage',
    status: 'pending',
    targetId: 'image-node-1',
    progress: 0,
    createdAt: 1,
    updatedAt: 1,
};
const failedJob = {
    id: 'job-failed',
    type: 'canvas.generateVideo',
    status: 'failed',
    targetId: 'video-node-1',
    progress: 40,
    error: { errorClass: 'provider_error', message: 'Provider failed', retryable: false },
    createdAt: 2,
    updatedAt: 3,
};
const completedTextJob = {
    id: 'job-text-done',
    type: 'canvas.polishText',
    status: 'completed',
    targetId: 'text-node-1',
    progress: 100,
    result: { kind: 'text', text: 'Polished line' },
    createdAt: 4,
    updatedAt: 5,
};
const canceledJob = {
    id: 'job-canceled',
    type: 'canvas.generateAudio',
    status: 'canceled',
    targetId: 'audio-node-1',
    progress: 10,
    createdAt: 6,
    updatedAt: 7,
};
function createApi(overrides = {}) {
    return {
        listJobs: vi.fn().mockResolvedValue([failedJob, queuedJob]),
        runNode: vi.fn().mockResolvedValue({ jobId: 'job-rerun', status: 'pending', createdAt: 8 }),
        onJobCompleted: vi.fn().mockReturnValue(() => undefined),
        onJobFailed: vi.fn().mockReturnValue(() => undefined),
        ...overrides,
    };
}
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});
describe('REQ-096 canvas job panel', () => {
    it('loads recent jobs with localized status, target, and refresh controls', async () => {
        const listJobs = vi.fn().mockResolvedValue([failedJob, queuedJob]);
        render(_jsx(CanvasJobPanel, { api: createApi({ listJobs }) }));
        expect(await screen.findByRole('heading', { name: '运行任务' })).toBeInTheDocument();
        expect(listJobs).toHaveBeenCalledWith({ limit: 8 });
        expect(screen.getByText('job-failed')).toBeInTheDocument();
        expect(screen.getByText('失败')).toBeInTheDocument();
        expect(screen.getByText('Provider failed')).toBeInTheDocument();
        expect(screen.getByText('video-node-1')).toBeInTheDocument();
        expect(screen.getByText('job-queued')).toBeInTheDocument();
        expect(screen.getByText('排队中')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '刷新运行任务' }));
        await waitFor(() => expect(listJobs).toHaveBeenCalledTimes(2));
    });
    it('reloads the list when terminal job events arrive without polling', async () => {
        const completedHandlers = [];
        const failedHandlers = [];
        const listJobs = vi.fn()
            .mockResolvedValueOnce([queuedJob])
            .mockResolvedValueOnce([{ ...queuedJob, status: 'completed', progress: 100 }])
            .mockResolvedValueOnce([failedJob]);
        const api = createApi({
            listJobs,
            onJobCompleted: vi.fn((handler) => {
                completedHandlers.push(handler);
                return () => undefined;
            }),
            onJobFailed: vi.fn((handler) => {
                failedHandlers.push(handler);
                return () => undefined;
            }),
        });
        render(_jsx(CanvasJobPanel, { api: api }));
        expect(await screen.findByText('job-queued')).toBeInTheDocument();
        completedHandlers[0]?.({
            channel: 'job.completed',
            jobId: 'job-queued',
            result: { kind: 'asset', assetId: 'asset-1' },
            emittedAt: 4,
        });
        expect(await screen.findByText('已完成')).toBeInTheDocument();
        failedHandlers[0]?.({
            channel: 'job.failed',
            jobId: 'job-failed',
            error: { errorClass: 'provider_error', message: 'Provider failed', retryable: false },
            emittedAt: 5,
        });
        expect(await screen.findByText('job-failed')).toBeInTheDocument();
        expect(listJobs).toHaveBeenCalledTimes(3);
    });
    it('opens a run detail view with output, node status, failed/canceled states, and manual rerun', async () => {
        const listJobs = vi.fn().mockResolvedValue([completedTextJob, failedJob, canceledJob]);
        const runNode = vi.fn().mockResolvedValue({ jobId: 'job-rerun-text', status: 'pending', createdAt: 9 });
        render(_jsx(CanvasJobPanel, { api: createApi({ listJobs, runNode }) }));
        expect(await screen.findByText('文本润色')).toBeInTheDocument();
        expect(screen.getByText('1 个已完成')).toBeInTheDocument();
        expect(screen.getByText('1 个失败')).toBeInTheDocument();
        expect(screen.getByText('1 个已取消')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '查看运行详情 job-text-done' }));
        expect(screen.getByRole('heading', { name: '运行详情' })).toBeInTheDocument();
        expect(screen.getByText('text-node-1')).toBeInTheDocument();
        expect(screen.getByText('Polished line')).toBeInTheDocument();
        expect(screen.getByText('输出类型：文本')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '重新运行 text-node-1' }));
        await waitFor(() => expect(runNode).toHaveBeenCalledWith('text-node-1'));
        await waitFor(() => expect(listJobs).toHaveBeenCalledTimes(2));
        fireEvent.click(screen.getByRole('button', { name: '返回运行列表' }));
        fireEvent.click(screen.getByRole('button', { name: '查看运行详情 job-failed' }));
        expect(screen.getByText('Provider failed')).toBeInTheDocument();
        expect(screen.getByText('错误类型：provider_error')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '返回运行列表' }));
        fireEvent.click(screen.getByRole('button', { name: '查看运行详情 job-canceled' }));
        expect(screen.getByText('已取消')).toBeInTheDocument();
        expect(screen.getByText('audio-node-1')).toBeInTheDocument();
    });
});
