import { describe, expect, it } from 'vitest';
import { buildGenerationTaskStatusList, reconcileCanvasNodesWithJobs, terminalFailureToNodePatch, terminalResultToNodePatch, } from '../desktop/src/renderer/src/canvas/lib/job-reconciliation';
const baseNode = {
    id: 'image-node-1',
    type: 'imageConfigV2',
    position: { x: 0, y: 0 },
    data: {
        label: 'Image',
        promptOverride: '',
        modelId: 'stub-image',
        orientation: 'landscape',
        assetId: null,
        status: 'idle',
    },
};
function job(overrides) {
    return {
        id: 'job-1',
        type: 'canvas.generateImage',
        status: 'completed',
        targetId: 'image-node-1',
        progress: 100,
        result: { kind: 'asset', assetId: 'asset-1' },
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}
describe('REQ-096 canvas job reconciliation', () => {
    it('marks target nodes done with the generated asset from completed asset jobs', () => {
        const nodes = reconcileCanvasNodesWithJobs([baseNode], [
            job({ result: { kind: 'asset', assetId: 'asset-done' } }),
        ]);
        expect(nodes.at(0)?.data).toMatchObject({
            status: 'done',
            assetId: 'asset-done',
        });
    });
    it('marks failed jobs as node errors with recoverable messages and pending or processing jobs as pending', () => {
        const failedNode = { ...baseNode, id: 'failed-node' };
        const processingNode = { ...baseNode, id: 'processing-node' };
        const nodes = reconcileCanvasNodesWithJobs([failedNode, processingNode], [
            job({ id: 'failed-job', targetId: 'failed-node', status: 'failed', error: { errorClass: 'provider', message: 'boom', retryable: false } }),
            job({ id: 'processing-job', targetId: 'processing-node', status: 'processing', progress: 30 }),
        ]);
        expect(nodes.find((node) => node.id === 'failed-node')?.data).toMatchObject({
            status: 'error',
            error: 'boom',
        });
        expect(nodes.find((node) => node.id === 'processing-node')?.data).toMatchObject({
            status: 'pending',
            assetId: null,
        });
    });
    it('uses the newest job per target and ignores unknown targets or non-asset results', () => {
        const nodes = reconcileCanvasNodesWithJobs([baseNode], [
            job({ id: 'old', updatedAt: 10, result: { kind: 'asset', assetId: 'old-asset' } }),
            job({ id: 'new', updatedAt: 20, result: { kind: 'asset', assetId: 'new-asset' } }),
            job({ id: 'unknown', targetId: 'missing-node', updatedAt: 30, result: { kind: 'asset', assetId: 'wrong-asset' } }),
            job({ id: 'text-result', targetId: 'image-node-1', updatedAt: 5, result: { kind: 'text', text: 'not an asset' } }),
        ]);
        expect(nodes).toHaveLength(1);
        expect(nodes.at(0)?.data).toMatchObject({
            status: 'done',
            assetId: 'new-asset',
        });
    });
    it('restores typed non-MJ migrated jobs from completed report metadata', () => {
        const composeNode = {
            id: 'compose-node',
            type: 'videoCompose',
            position: { x: 0, y: 0 },
            data: {
                label: 'Compose',
                inputOrder: ['video-b', 'video-a'],
                transitionName: 'crossfade',
                modelId: 'compose-local',
                assetId: null,
                status: 'pending',
            },
        };
        const sceneNode = {
            id: 'scene-node',
            type: 'scene',
            position: { x: 320, y: 0 },
            data: {
                label: 'Hangar',
                description: 'rainy hangar',
                assetId: null,
                status: 'pending',
            },
        };
        const nodes = reconcileCanvasNodesWithJobs([composeNode, sceneNode], [
            job({
                id: 'compose-job',
                type: 'canvas.composeVideo',
                targetId: 'compose-node',
                result: {
                    kind: 'report',
                    summary: 'composed',
                    data: { assetId: 'asset-compose', url: 'cc-asset://asset/asset-compose' },
                },
            }),
            job({
                id: 'scene-job',
                type: 'canvas.generateImage',
                targetId: 'scene-node',
                result: {
                    kind: 'asset',
                    assetId: 'asset-scene-ready',
                },
            }),
        ]);
        expect(nodes.find((node) => node.id === 'compose-node')?.data).toMatchObject({
            status: 'done',
            assetId: 'asset-compose',
            url: 'cc-asset://asset/asset-compose',
        });
        expect(nodes.find((node) => node.id === 'scene-node')?.data).toMatchObject({
            status: 'done',
            assetId: 'asset-scene-ready',
        });
    });
    it('restores completed audio jobs into audio node status and asset metadata', () => {
        const audioNode = {
            id: 'audio-node',
            type: 'audio',
            position: { x: 0, y: 0 },
            data: {
                label: 'Narration',
                assetId: null,
                durationSeconds: 12,
                status: 'pending',
            },
        };
        const nodes = reconcileCanvasNodesWithJobs([audioNode], [
            job({
                id: 'audio-job',
                type: 'canvas.generateAudio',
                targetId: 'audio-node',
                result: {
                    kind: 'report',
                    summary: 'audio ready',
                    data: { assetId: 'asset-audio-ready', url: 'cc-asset://asset/asset-audio-ready' },
                },
            }),
        ]);
        expect(nodes.at(0)?.data).toMatchObject({
            status: 'done',
            assetId: 'asset-audio-ready',
            url: 'cc-asset://asset/asset-audio-ready',
        });
    });
    it('restores completed, active, and failed text polish jobs without asset fields', () => {
        const textNode = {
            id: 'text-node',
            type: 'text',
            position: { x: 0, y: 0 },
            data: {
                label: 'Opening beat',
                content: 'rough line',
                polishStatus: 'pending',
            },
        };
        const completed = reconcileCanvasNodesWithJobs([textNode], [
            job({
                id: 'text-job-completed',
                type: 'canvas.polishText',
                targetId: 'text-node',
                result: { kind: 'text', text: 'polished line' },
            }),
        ]);
        expect(completed.at(0)?.data).toMatchObject({
            content: 'polished line',
            html: '<p>polished line</p>',
            polishStatus: 'done',
        });
        expect(completed.at(0)?.data).not.toHaveProperty('assetId');
        const processing = reconcileCanvasNodesWithJobs([textNode], [
            job({
                id: 'text-job-processing',
                type: 'canvas.polishText',
                targetId: 'text-node',
                status: 'processing',
                progress: 35,
            }),
        ]);
        expect(processing.at(0)?.data).toMatchObject({ polishStatus: 'running' });
        expect(processing.at(0)?.data).not.toHaveProperty('assetId');
        const failed = reconcileCanvasNodesWithJobs([textNode], [
            job({
                id: 'text-job-failed',
                type: 'canvas.polishText',
                targetId: 'text-node',
                status: 'failed',
                error: { errorClass: 'provider', message: 'polish failed', retryable: false },
            }),
        ]);
        expect(failed.at(0)?.data).toMatchObject({
            polishStatus: 'error',
            error: 'polish failed',
        });
    });
    it('maps text polish terminal events to reusable node patches', () => {
        expect(terminalResultToNodePatch({ kind: 'text', text: 'clean rewrite' })).toEqual({
            content: 'clean rewrite',
            html: '<p>clean rewrite</p>',
            polishStatus: 'done',
        });
        expect(terminalFailureToNodePatch('canvas.polishText', { errorClass: 'provider', message: 'timeout', retryable: false })).toEqual({
            polishStatus: 'error',
            error: 'timeout',
        });
    });
    it('builds a recoverable generation task list for non-MJ canvas jobs', () => {
        const imageNode = {
            ...baseNode,
            id: 'image-node',
            type: 'image',
        };
        const characterNode = {
            id: 'character-node',
            type: 'character',
            position: { x: 120, y: 0 },
            data: { label: 'Mika', description: 'pilot', assetId: null, status: 'idle' },
        };
        const muxNode = {
            id: 'mux-node',
            type: 'muxAudioVideo',
            position: { x: 240, y: 0 },
            data: { label: 'Mux', modelId: 'mux-local', assetId: null, status: 'idle' },
        };
        const mjNode = {
            id: 'mj-node',
            type: 'mjImage',
            position: { x: 360, y: 0 },
            data: { label: 'Legacy MJ', prompt: '', modelId: 'stub-mj', ratio: '16:9', urls: [], selectedIndex: 0, assetId: null, status: 'idle' },
        };
        const textNode = {
            id: 'text-node',
            type: 'text',
            position: { x: 480, y: 0 },
            data: { label: 'Beat', content: 'rough line' },
        };
        const tasks = buildGenerationTaskStatusList([imageNode, characterNode, muxNode, mjNode, textNode], [
            job({ id: 'image-job', targetId: 'image-node', status: 'completed', updatedAt: 20 }),
            job({ id: 'character-job', targetId: 'character-node', type: 'canvas.generateImage', status: 'processing', progress: 35, updatedAt: 30 }),
            job({ id: 'mux-job', targetId: 'mux-node', type: 'canvas.muxAudioVideo', status: 'failed', progress: 100, error: { errorClass: 'mux', message: 'mux failed', retryable: false }, updatedAt: 40 }),
            job({ id: 'mj-job', targetId: 'mj-node', type: 'canvas.generateImage', status: 'completed', updatedAt: 50 }),
            job({ id: 'text-job', targetId: 'text-node', type: 'canvas.polishText', status: 'completed', updatedAt: 60, result: { kind: 'text', text: 'polished line' } }),
        ]);
        expect(tasks.map((task) => task.nodeId)).toEqual(['image-node', 'character-node', 'mux-node', 'text-node']);
        expect(tasks).toEqual([
            expect.objectContaining({ nodeId: 'image-node', nodeType: 'image', jobId: 'image-job', status: 'completed', phase: 'terminal' }),
            expect.objectContaining({ nodeId: 'character-node', nodeType: 'character', jobId: 'character-job', status: 'processing', phase: 'active', progress: 35 }),
            expect.objectContaining({ nodeId: 'mux-node', nodeType: 'muxAudioVideo', jobId: 'mux-job', status: 'failed', phase: 'terminal', errorMessage: 'mux failed' }),
            expect.objectContaining({ nodeId: 'text-node', nodeType: 'text', jobId: 'text-job', jobType: 'canvas.polishText', status: 'completed', phase: 'terminal' }),
        ]);
    });
});
