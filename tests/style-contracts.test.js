import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composeStyledPrompt, resolveEffectiveStylePreset, } from '../shared/styles';
const projectStyle = {
    id: 'style-project',
    code: 'ink-noir',
    name: '水墨黑白',
    description: '高反差水墨漫画',
    promptBefore: '水墨漫画，黑白高反差',
    promptAfter: '宣纸肌理，电影构图',
    legacyPromptPreset: 'legacy should not appear',
    negativePrompt: null,
    coverAssetId: 'asset-cover-1',
    coverUrl: 'cc-asset://asset/asset-cover-1',
    tags: ['comic', 'ink'],
    enabled: true,
    sortOrder: 10,
    createdAt: 1,
    updatedAt: 2,
};
const nodeStyle = {
    ...projectStyle,
    id: 'style-node',
    code: 'pastel',
    name: '柔和彩铅',
    promptBefore: '柔和彩铅风格',
    promptAfter: '低饱和，干净线稿',
};
describe('style preset shared contracts', () => {
    it('defines the style API contract document required by the migration spec', () => {
        expect(existsSync('docs/api-contracts/styles.md')).toBe(true);
        const contract = readFileSync('docs/api-contracts/styles.md', 'utf8');
        for (const required of [
            'style.list',
            'style.save',
            'style.delete',
            'style.setProjectDefault',
            'style.getProjectDefault',
            'composeStyledPrompt',
            'promptBefore',
            'promptAfter',
        ]) {
            expect(contract).toContain(required);
        }
    });
    it('registers typed style IPC channels without implying runtime handler completion', () => {
        const channels = [
            'style.list',
            'style.save',
            'style.delete',
            'style.setProjectDefault',
            'style.getProjectDefault',
        ];
        expect(channels).toHaveLength(5);
        const listRequest = { includeDisabled: true };
        const listResponse = [projectStyle];
        const saveRequest = {
            code: 'ink-noir',
            name: '水墨黑白',
            promptBefore: '水墨漫画',
            promptAfter: '宣纸肌理',
        };
        const defaultRequest = {
            workflowId: 'workflow-1',
            stylePresetId: 'style-project',
        };
        const getDefaultRequest = { workflowId: 'workflow-1' };
        const getDefaultResponse = {
            workflowId: 'workflow-1',
            stylePresetId: 'style-project',
        };
        expect({ listRequest, listResponse, saveRequest, defaultRequest, getDefaultRequest, getDefaultResponse }).toBeTruthy();
    });
    it('injects promptBefore and promptAfter around trimmed content with newline separators', () => {
        expect(composeStyledPrompt('  一只猫站在雨夜屋顶  ', projectStyle)).toBe('水墨漫画，黑白高反差\n一只猫站在雨夜屋顶\n宣纸肌理，电影构图');
    });
    it('skips empty prompt parts and falls back to legacy prompt preset only when before and after are empty', () => {
        expect(composeStyledPrompt('一只猫', { ...projectStyle, promptBefore: '  ', promptAfter: '柔光' })).toBe('一只猫\n柔光');
        expect(composeStyledPrompt('一只猫', {
            ...projectStyle,
            promptBefore: '',
            promptAfter: null,
            legacyPromptPreset: '赛博朋克',
        })).toBe('一只猫\n\n画面风格：赛博朋克');
        expect(composeStyledPrompt('', {
            ...projectStyle,
            promptBefore: '',
            promptAfter: '',
            legacyPromptPreset: '赛博朋克',
        })).toBe('画面风格：赛博朋克');
    });
    it('keeps prompt preview and runtime style selection deterministic with node override over project default', () => {
        expect(resolveEffectiveStylePreset({
            nodeStylePresetId: 'style-node',
            projectDefaultStylePresetId: 'style-project',
            styles: [projectStyle, nodeStyle],
        })).toEqual(nodeStyle);
        expect(resolveEffectiveStylePreset({
            nodeStylePresetId: null,
            projectDefaultStylePresetId: 'style-project',
            styles: [projectStyle, nodeStyle],
        })).toEqual(projectStyle);
    });
    it('returns a recoverable style error for missing or disabled effective styles without mutating the prompt', () => {
        expect(resolveEffectiveStylePreset({
            nodeStylePresetId: 'missing',
            projectDefaultStylePresetId: 'style-project',
            styles: [projectStyle],
        })).toEqual({
            errorClass: 'style_not_found',
            message: 'Style preset missing is unavailable.',
            presetId: 'missing',
            retryable: false,
        });
        expect(resolveEffectiveStylePreset({
            nodeStylePresetId: 'style-node',
            projectDefaultStylePresetId: 'style-project',
            styles: [{ ...nodeStyle, enabled: false }, projectStyle],
        })).toEqual({
            errorClass: 'style_disabled',
            message: 'Style preset style-node is disabled.',
            presetId: 'style-node',
            retryable: true,
        });
    });
});
