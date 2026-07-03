import { describe, expect, it } from 'vitest';
import { createAsyncMediaProvider } from '../desktop/src/main/providers/async-media.provider';
function createVideoRequest(overrides = {}) {
    return {
        channel: 'video',
        modelKey: 'video-task-model',
        prompt: 'a neon panel reveal',
        references: [],
        parameters: { durationMs: 4000, orientation: 'landscape' },
        idempotencyKey: 'idem-video-1',
        ...overrides
    };
}
function jsonResponse(body, ok = true, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        statusText: ok ? 'OK' : 'Provider Error',
        headers: { 'content-type': 'application/json' }
    });
}
function inputUrl(input) {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.href;
    }
    return input.url;
}
function requestBody(call) {
    const body = call?.init?.body;
    if (typeof body === 'string') {
        return body;
    }
    // Test helper failures should stop the assertion path when the mock was called incorrectly.
    throw new Error('expected string request body');
}
function createFetchMock(handler) {
    const calls = [];
    const fetchMock = (async (input, init) => {
        calls.push({ input, init });
        return handler(input, init);
    });
    fetchMock.calls = calls;
    return fetchMock;
}
describe('M3 async media provider', () => {
    it('submits, polls, fetches completed media URL bytes, and emits progress', async () => {
        let now = 0;
        const progress = [];
        const fetchMock = createFetchMock((input) => {
            const url = inputUrl(input);
            if (url === 'https://api.example.test/v1/tasks') {
                return Promise.resolve(jsonResponse({ task_id: 'task-1', poll_after_ms: 100 }));
            }
            if (url === 'https://api.example.test/v1/tasks/task-1') {
                return Promise.resolve(jsonResponse({ status: 'running', progress: 45, message: 'rendering frames' }));
            }
            if (url === 'https://api.example.test/v1/tasks/task-1?attempt=2') {
                return Promise.resolve(jsonResponse({
                    status: 'completed',
                    output: {
                        url: 'https://cdn.example.test/task-1.mp4',
                        mime_type: 'video/mp4',
                        width: 1280,
                        height: 720,
                        duration_ms: 4000
                    }
                }));
            }
            if (url === 'https://cdn.example.test/task-1.mp4') {
                return Promise.resolve(new Response(new Uint8Array([9, 8, 7]), { headers: { 'content-type': 'video/mp4' } }));
            }
            return Promise.resolve(jsonResponse({ error: { message: `unexpected ${url}` } }, false, 404));
        });
        const provider = createAsyncMediaProvider({
            id: 'async-video',
            baseUrl: 'https://api.example.test/v1',
            apiKey: 'sk-async-secret',
            modelKeys: { video: 'video-task-model' },
            fetchImpl: fetchMock,
            polling: {
                initialDelayMs: 100,
                maxDelayMs: 500,
                timeoutMs: 5_000,
                clock: () => now,
                sleep: (durationMs) => {
                    now += durationMs;
                    return Promise.resolve();
                }
            },
            statusPath: (remoteTaskId, attempt) => `/tasks/${remoteTaskId}${attempt === 2 ? '?attempt=2' : ''}`
        });
        const result = await provider.invoke(createVideoRequest(), {
            onProgress: (event) => {
                progress.push(event);
            }
        });
        expect(fetchMock.calls).toHaveLength(4);
        expect(fetchMock.calls[0]?.input).toBe('https://api.example.test/v1/tasks');
        expect(JSON.parse(requestBody(fetchMock.calls[0]))).toEqual({
            channel: 'video',
            model: 'video-task-model',
            prompt: 'a neon panel reveal',
            references: [],
            parameters: { durationMs: 4000, orientation: 'landscape' },
            idempotency_key: 'idem-video-1'
        });
        expect(fetchMock.calls[0]?.init?.headers).toMatchObject({
            Authorization: 'Bearer sk-async-secret',
            'Content-Type': 'application/json'
        });
        expect(progress).toEqual([{ progress: 45, message: 'rendering frames' }]);
        expect(result.kind).toBe('assetBytes');
        if (result.kind !== 'assetBytes') {
            // Narrows the discriminated union so metadata and bytes assertions stay type-safe.
            throw new Error('expected assetBytes');
        }
        expect(result.mediaType).toBe('video');
        expect(Array.from(result.bytes)).toEqual([9, 8, 7]);
        expect(result.metadata).toMatchObject({
            mediaType: 'video',
            mimeType: 'video/mp4',
            width: 1280,
            height: 720,
            durationMs: 4000,
            sizeBytes: 3
        });
        expect(JSON.stringify(result)).not.toContain('https://cdn.example.test');
    });
    it('normalizes failed remote task states', async () => {
        const fetchMock = createFetchMock((input) => {
            const url = inputUrl(input);
            if (url.endsWith('/tasks')) {
                return Promise.resolve(jsonResponse({ remote_task_id: 'task-failed' }));
            }
            return Promise.resolve(jsonResponse({ status: 'failed', error: { message: 'remote moderation failed' }, retryable: false }));
        });
        const provider = createAsyncMediaProvider({
            id: 'async-video',
            baseUrl: 'https://api.example.test/v1',
            apiKey: 'sk-async-secret',
            modelKeys: { video: 'video-task-model' },
            fetchImpl: fetchMock,
            polling: { initialDelayMs: 1, maxDelayMs: 1, timeoutMs: 100, sleep: () => Promise.resolve() }
        });
        await expect(provider.invoke(createVideoRequest())).rejects.toMatchObject({
            errorClass: 'provider_request_failed',
            message: 'remote moderation failed',
            retryable: false
        });
    });
    it('throws provider_timeout when the remote task never completes', async () => {
        let now = 0;
        const fetchMock = createFetchMock((input) => {
            const url = inputUrl(input);
            if (url.endsWith('/tasks')) {
                return Promise.resolve(jsonResponse({ task_id: 'task-slow' }));
            }
            return Promise.resolve(jsonResponse({ status: 'running', progress: 10 }));
        });
        const provider = createAsyncMediaProvider({
            id: 'async-video',
            baseUrl: 'https://api.example.test/v1',
            apiKey: 'sk-async-secret',
            modelKeys: { video: 'video-task-model' },
            fetchImpl: fetchMock,
            polling: {
                initialDelayMs: 100,
                maxDelayMs: 500,
                timeoutMs: 250,
                clock: () => now,
                sleep: (durationMs) => {
                    now += durationMs;
                    return Promise.resolve();
                }
            }
        });
        await expect(provider.invoke(createVideoRequest())).rejects.toMatchObject({
            errorClass: 'provider_timeout',
            retryable: true
        });
    });
    it('checks cancellation before submitting and while polling', async () => {
        let now = 0;
        let canceled = false;
        const fetchMock = createFetchMock((input) => {
            const url = inputUrl(input);
            if (url.endsWith('/tasks')) {
                return Promise.resolve(jsonResponse({ task_id: 'task-cancel' }));
            }
            return Promise.resolve(jsonResponse({ status: 'running', progress: 10 }));
        });
        const provider = createAsyncMediaProvider({
            id: 'async-video',
            baseUrl: 'https://api.example.test/v1',
            apiKey: 'sk-async-secret',
            modelKeys: { video: 'video-task-model' },
            fetchImpl: fetchMock,
            polling: {
                initialDelayMs: 100,
                maxDelayMs: 500,
                timeoutMs: 1_000,
                clock: () => now,
                sleep: (durationMs) => {
                    now += durationMs;
                    canceled = true;
                    return Promise.resolve();
                }
            }
        });
        await expect(provider.invoke(createVideoRequest(), {
            isCanceled: () => canceled
        })).rejects.toMatchObject({
            errorClass: 'provider_canceled',
            retryable: false
        });
        expect(fetchMock.calls.length).toBeGreaterThan(0);
    });
});
