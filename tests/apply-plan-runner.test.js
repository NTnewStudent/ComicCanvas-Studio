import { describe, expect, it } from 'vitest';
import { applyCanvasPlan } from '../desktop/src/renderer/src/canvas/lib/apply-plan';
import { createPlanRunner } from '../desktop/src/renderer/src/canvas/lib/plan-runner';
import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store';
function createStore() {
    return createCanvasStore({
        idFactory: (() => {
            let index = 0;
            return () => `manual-node-${++index}`;
        })(),
        edgeIdFactory: (source, target) => `manual-edge-${source}-${target}`,
        clock: () => 1_783_100_000_000
    });
}
const legalPlan = {
    kind: 'plan',
    summary: 'Create a text to image to video workflow.',
    nodes: [
        { ref: 'text-a', type: 'text', title: 'Prompt', data: { content: 'gold spaceship', promptOverride: 'ignored fallback' } },
        {
            ref: 'image-a',
            type: 'imageConfigV2',
            title: 'Image',
            data: { promptOverride: 'cinematic panel', modelId: 'stub-image', orientation: 'landscape' }
        },
        {
            ref: 'video-a',
            type: 'videoConfigV2',
            title: 'Video',
            data: { promptOverride: 'slow push in', modelId: 'stub-video', orientation: 'landscape', durationSeconds: 5 }
        }
    ],
    edges: [
        { source: 'text-a', target: 'image-a', edgeType: 'promptOrder' },
        { source: 'image-a', target: 'video-a', edgeType: 'imageRole', imageRole: 'first_frame' }
    ],
    runSteps: [
        { ref: 'image-a', action: 'imageRun' },
        { ref: 'video-a', action: 'videoRun' }
    ],
    question: null,
    dropped: ['model:kept-warning']
};
describe('M4 applyPlan and PlanRunner', () => {
    it('applies a legal CanvasPlan with layered layout, run-step mapping, and one undo snapshot', () => {
        const store = createStore();
        const existingId = store.getState().addNode('text', { x: 32, y: 48 }, { content: 'existing' });
        const pastBeforeApply = store.getState().past.length;
        const result = applyCanvasPlan(legalPlan, store, {
            idFactory: (ref) => `plan-node-${ref}`,
            edgeIdFactory: (edge) => `plan-edge-${edge.source}-${edge.target}`,
            clock: () => 1_783_100_000_111
        });
        expect(result).toEqual({
            refToId: {
                'text-a': 'plan-node-text-a',
                'image-a': 'plan-node-image-a',
                'video-a': 'plan-node-video-a'
            },
            appliedNodeIds: ['plan-node-text-a', 'plan-node-image-a', 'plan-node-video-a'],
            appliedEdgeIds: ['plan-edge-plan-node-text-a-plan-node-image-a', 'plan-edge-plan-node-image-a-plan-node-video-a'],
            runSteps: [
                { ref: 'image-a', nodeId: 'plan-node-image-a', action: 'imageRun' },
                { ref: 'video-a', nodeId: 'plan-node-video-a', action: 'videoRun' }
            ],
            dropped: ['model:kept-warning']
        });
        expect(store.getState().nodes.map((node) => node.id)).toEqual([
            existingId,
            'plan-node-text-a',
            'plan-node-image-a',
            'plan-node-video-a'
        ]);
        expect(store.getState().nodes.find((node) => node.id === 'plan-node-text-a')).toMatchObject({
            type: 'text',
            position: { x: 120, y: 408 },
            data: { label: 'Prompt', content: 'gold spaceship' }
        });
        expect(store.getState().nodes.find((node) => node.id === 'plan-node-image-a')).toMatchObject({
            type: 'imageConfigV2',
            position: { x: 440, y: 408 },
            data: { label: 'Image', promptOverride: 'cinematic panel', modelId: 'stub-image', orientation: 'landscape', status: 'idle' }
        });
        expect(store.getState().nodes.find((node) => node.id === 'plan-node-video-a')).toMatchObject({
            type: 'videoConfigV2',
            position: { x: 760, y: 408 },
            data: { label: 'Video', promptOverride: 'slow push in', modelId: 'stub-video', orientation: 'landscape', durationSeconds: 5, status: 'idle' }
        });
        expect(store.getState().edges).toEqual([
            {
                id: 'plan-edge-plan-node-text-a-plan-node-image-a',
                source: 'plan-node-text-a',
                target: 'plan-node-image-a',
                data: { edgeType: 'promptOrder', createdAt: 1_783_100_000_111 }
            },
            {
                id: 'plan-edge-plan-node-image-a-plan-node-video-a',
                source: 'plan-node-image-a',
                target: 'plan-node-video-a',
                data: { edgeType: 'imageRole', imageRole: 'first_frame', createdAt: 1_783_100_000_111 }
            }
        ]);
        expect(store.getState().past).toHaveLength(pastBeforeApply + 1);
        store.getState().undo();
        expect(store.getState().nodes.map((node) => node.id)).toEqual([existingId]);
        expect(store.getState().edges).toEqual([]);
    });
    it('revalidates illegal plan items locally and does not map unsafe run steps', () => {
        const store = createStore();
        const dirtyPlan = {
            ...legalPlan,
            nodes: [
                ...legalPlan.nodes,
                { ref: 'legacy-a', type: 'legacyNode', title: 'Legacy', data: { promptOverride: 'unsupported' } }
            ],
            edges: [
                ...legalPlan.edges,
                { source: 'video-a', target: 'text-a', edgeType: 'default' },
                { source: 'missing', target: 'image-a', edgeType: 'default' },
                { source: 'text-a', target: 'image-a', edgeType: 'scriptEdge' }
            ],
            runSteps: [
                ...legalPlan.runSteps,
                { ref: 'missing', action: 'imageRun' },
                { ref: 'text-a', action: 'deleteEverything' }
            ]
        };
        const result = applyCanvasPlan(dirtyPlan, store, {
            idFactory: (ref) => `plan-node-${ref}`,
            edgeIdFactory: (edge) => `plan-edge-${edge.source}-${edge.target}`,
            clock: () => 1_783_100_000_222
        });
        expect(store.getState().nodes.map((node) => node.id)).toEqual(['plan-node-text-a', 'plan-node-image-a', 'plan-node-video-a']);
        expect(store.getState().edges).toHaveLength(2);
        expect(result.runSteps).toEqual([
            { ref: 'image-a', nodeId: 'plan-node-image-a', action: 'imageRun' },
            { ref: 'video-a', nodeId: 'plan-node-video-a', action: 'videoRun' }
        ]);
        expect(result.dropped).toEqual(expect.arrayContaining([
            'model:kept-warning',
            expect.stringContaining('node:legacy-a:unsupported_type'),
            expect.stringContaining('edge:video-a->text-a:connection_rejected'),
            expect.stringContaining('edge:missing->image-a:missing_node'),
            expect.stringContaining('edge:text-a->image-a:unsupported_edge_type'),
            expect.stringContaining('runStep:missing:missing_node'),
            expect.stringContaining('runStep:text-a:unsupported_action')
        ]));
    });
    it('drops MJ nodes and unavailable run actions from Agent-applied plans', () => {
        const store = createStore();
        const migratedPlan = {
            kind: 'plan',
            summary: 'Build a migrated media chain.',
            nodes: [
                { ref: 'audio-a', type: 'audio', title: 'Audio', data: { assetId: 'asset-audio', durationSeconds: 8 } },
                { ref: 'mj-a', type: 'mjImage', title: 'MJ', data: { prompt: 'key art', modelId: 'mj-v6' } },
                { ref: 'compose-a', type: 'videoCompose', title: 'Compose', data: { inputOrder: [], transitionName: 'crossfade' } },
                { ref: 'upscale-a', type: 'superResolution', title: 'Upscale', data: { resolution: '4k' } },
                { ref: 'mux-a', type: 'muxAudioVideo', title: 'Mux', data: { modelId: 'mux-local' } }
            ],
            edges: [],
            runSteps: [
                { ref: 'audio-a', action: 'audioRun' },
                { ref: 'mj-a', action: 'mjImageRun' },
                { ref: 'compose-a', action: 'videoComposeRun' },
                { ref: 'upscale-a', action: 'superResolutionRun' },
                { ref: 'mux-a', action: 'muxAudioVideoRun' }
            ],
            question: null,
            dropped: []
        };
        const result = applyCanvasPlan(migratedPlan, store, {
            idFactory: (ref) => `plan-node-${ref}`,
            edgeIdFactory: (edge) => `plan-edge-${edge.source}-${edge.target}`,
            clock: () => 1_783_600_000_000
        });
        expect(store.getState().nodes.map((node) => node.type)).toEqual([
            'audio',
            'videoCompose',
            'superResolution',
            'muxAudioVideo'
        ]);
        expect(result.runSteps).toEqual([]);
        expect(result.dropped).toEqual(expect.arrayContaining([
            expect.stringContaining('node:mj-a:unsupported_type'),
            expect.stringContaining('runStep:audio-a:unsupported_action'),
            expect.stringContaining('runStep:mj-a:unsupported_action'),
            expect.stringContaining('runStep:compose-a:unsupported_action'),
            expect.stringContaining('runStep:upscale-a:unsupported_action'),
            expect.stringContaining('runStep:mux-a:unsupported_action')
        ]));
    });
    it('runs plan steps serially and finishes only after the third terminal success', () => {
        const launched = [];
        const finished = [];
        const steps = [
            { ref: 'text-a', nodeId: 'node-text', action: 'textPolish' },
            { ref: 'image-a', nodeId: 'node-image', action: 'imageRun' },
            { ref: 'video-a', nodeId: 'node-video', action: 'videoRun' }
        ];
        const runner = createPlanRunner(steps, {
            runStep(step, index) {
                launched.push({ step, index });
            },
            onFinished(summary) {
                finished.push(summary);
            }
        });
        runner.start();
        expect(launched.map((entry) => entry.step.nodeId)).toEqual(['node-text']);
        runner.notifyNodeTerminal('other-node', 'completed');
        expect(launched.map((entry) => entry.step.nodeId)).toEqual(['node-text']);
        runner.notifyNodeTerminal('node-text', 'completed');
        expect(launched.map((entry) => entry.step.nodeId)).toEqual(['node-text', 'node-image']);
        runner.notifyNodeTerminal('node-image', 'completed');
        expect(launched.map((entry) => entry.step.nodeId)).toEqual(['node-text', 'node-image', 'node-video']);
        expect(finished).toEqual([]);
        runner.notifyNodeTerminal('node-video', 'completed');
        expect(finished).toEqual([{ total: 3, completed: 3 }]);
        expect(runner.active).toBe(false);
    });
    it('short-circuits remaining plan steps when the second step fails', () => {
        const launched = [];
        const finished = [];
        const steps = [
            { ref: 'text-a', nodeId: 'node-text', action: 'textPolish' },
            { ref: 'image-a', nodeId: 'node-image', action: 'imageRun' },
            { ref: 'video-a', nodeId: 'node-video', action: 'videoRun' }
        ];
        const runner = createPlanRunner(steps, {
            runStep(step) {
                launched.push(step);
            },
            onFinished(summary) {
                finished.push(summary);
            }
        });
        runner.start();
        runner.notifyNodeTerminal('node-text', 'completed');
        runner.notifyNodeTerminal('node-image', 'failed', 'provider timeout');
        expect(launched.map((step) => step.nodeId)).toEqual(['node-text', 'node-image']);
        expect(finished).toEqual([{ total: 3, completed: 1, failedStep: steps[1], errorMessage: 'provider timeout' }]);
        expect(runner.active).toBe(false);
        runner.notifyNodeTerminal('node-image', 'completed');
        expect(launched.map((step) => step.nodeId)).toEqual(['node-text', 'node-image']);
    });
});
