import { describe, expect, it, vi } from 'vitest';
import { registerCanvasRealtimeInvalidation } from '../desktop/src/renderer/src/canvas/hooks/use-canvas-realtime';
function createApi() {
    let jobCompleted = null;
    let jobFailed = null;
    let assetChanged = null;
    const unsubscribes = [vi.fn(), vi.fn(), vi.fn()];
    return {
        api: {
            onJobCompleted(handler) {
                jobCompleted = handler;
                return unsubscribes[0];
            },
            onJobFailed(handler) {
                jobFailed = handler;
                return unsubscribes[1];
            },
            onAssetChanged(handler) {
                assetChanged = handler;
                return unsubscribes[2];
            }
        },
        emitJobCompleted(event) {
            jobCompleted?.(event);
        },
        emitJobFailed(event) {
            jobFailed?.(event);
        },
        emitAssetChanged(event) {
            assetChanged?.(event);
        },
        unsubscribes
    };
}
describe('M2 canvas realtime invalidation', () => {
    it('invalidates job and asset queries from IPC events and unsubscribes on cleanup', () => {
        const fixture = createApi();
        const invalidateQueries = vi.fn();
        const invalidator = { invalidateQueries };
        const cleanup = registerCanvasRealtimeInvalidation(fixture.api, invalidator);
        fixture.emitJobCompleted({
            channel: 'job.completed',
            jobId: 'job-1',
            result: { kind: 'asset', assetId: 'asset-1' },
            emittedAt: 10
        });
        fixture.emitJobFailed({
            channel: 'job.failed',
            jobId: 'job-2',
            error: { errorClass: 'provider_error', message: 'failed', retryable: false },
            emittedAt: 11
        });
        fixture.emitAssetChanged({ assetId: 'asset-1', change: 'updated' });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jobs', 'job-1'] });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['assets', 'asset-1'] });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jobs', 'job-2'] });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['assets'] });
        cleanup();
        for (const unsubscribe of fixture.unsubscribes) {
            expect(unsubscribe).toHaveBeenCalledTimes(1);
        }
    });
});
