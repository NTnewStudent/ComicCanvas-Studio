import { describe, expect, it } from 'vitest';
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES, ORIENTATION_ASPECT_RATIO, PREVIEW_FRAME_WIDTH, getOrientationPreviewStyle } from '../desktop/src/renderer/src/canvas/lib/node-sizing';
import { DEFAULT_CANVAS_NODE_SIZE, defaultCanvasNodeSize } from '../shared/node-layout';
describe('M2 node sizing primitives', () => {
    it('maps every supported orientation to a stable preview aspect ratio', () => {
        expect(ORIENTATION_ASPECT_RATIO).toEqual({
            landscape: '16 / 9',
            portrait: '9 / 16',
            square: '1 / 1'
        });
    });
    it('keeps preview width stable while height follows orientation', () => {
        expect(PREVIEW_FRAME_WIDTH).toBe('100%');
        expect(getOrientationPreviewStyle('portrait')).toEqual({
            width: '100%',
            aspectRatio: '9 / 16'
        });
    });
    it('centralizes NodeResizer class names for canvas node integration', () => {
        expect(NODE_RESIZER_CLASS_NAMES.line).toContain('!border-brand');
        expect(NODE_RESIZER_CLASS_NAMES.handle).toContain('!bg-bg-card');
    });
    it('keeps every node type on the shared default size contract', () => {
        const expectedTypes = [
            'text',
            'image',
            'video',
            'character',
            'scene',
            'audio',
            'imageConfigV2',
            'videoConfigV2',
            'videoCompose',
            'superResolution',
            'muxAudioVideo',
            'mjImage',
        ];
        expect(Object.keys(DEFAULT_CANVAS_NODE_SIZE).sort()).toEqual([...expectedTypes].sort());
        for (const type of expectedTypes) {
            expect(defaultCanvasNodeSize(type)).toBe(DEFAULT_CANVAS_NODE_SIZE[type]);
            expect(NODE_MIN_WIDTH[type]).toBe(DEFAULT_CANVAS_NODE_SIZE[type].width);
            expect(NODE_MIN_HEIGHT[type]).toBe(DEFAULT_CANVAS_NODE_SIZE[type].height);
        }
        expect(DEFAULT_CANVAS_NODE_SIZE.scene).toEqual({ width: 420, height: 560 });
    });
});
