import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('Phase A human review runbook', () => {
    it('documents the manual acceptance gate, MJ exclusion, and required review rows', () => {
        const runbook = readFileSync('docs/progress/phase-a-human-review-runbook.md', 'utf8');
        const checklist = readFileSync('docs/progress/human-desktop-review-checklist.md', 'utf8');
        const template = readFileSync('docs/progress/phase-a-human-review-session-template.md', 'utf8');
        const requiredRows = [
            'HDR-ASSET-001',
            'HDR-ASSET-009',
            'HDR-WF-006',
            'HDR-CANVAS-005',
            'HDR-NODE-001',
            'HDR-NODE-002',
            'HDR-RUNTIME-001',
            'HDR-RUNTIME-002',
            'HDR-TOOLS-001',
            'HDR-PHASEA-001'
        ];
        for (const rowId of requiredRows) {
            expect(runbook, `${rowId} runbook coverage`).toContain(rowId);
            expect(checklist, `${rowId} checklist row`).toContain(`| ${rowId} |`);
            expect(template, `${rowId} session template row`).toContain(`| ${rowId} | Pending |`);
        }
        expect(runbook).toContain('不要把 Agent 自动化作为 Phase A 验收证据来复核。');
        expect(runbook).toContain('MJ 节点/组件实现不在范围内。');
        expect(runbook).toContain('不需要 MJ 对等');
        expect(runbook).toContain('多结果');
        expect(runbook).toContain('URL 刷新');
        expect(runbook).toContain('运行恢复');
        expect(runbook).toContain('provider 集成');
        expect(runbook).toContain('不要将密钥粘贴进');
        expect(runbook).toContain('笔记、截图、日志、commit');
        expect(runbook).toContain('本仓库中');
        expect(runbook).toContain('Task 60 只能在以下条件之一成立后启动：');
        expect(runbook).toContain('Phase A 验收的明确产品延后决定已同时记录');
        expect(runbook).toContain('HDR-050');
        expect(runbook).toContain('HDR-051');
        expect(checklist).toContain('人工 Runbook：`docs/progress/phase-a-human-review-runbook.md`');
        expect(checklist).toContain('会话模板：`docs/progress/phase-a-human-review-session-template.md`');
        expect(runbook).toContain('会话模板：`docs/progress/phase-a-human-review-session-template.md`');
        expect(runbook).toContain('将 `docs/progress/phase-a-human-review-session-template.md` 复制到');
        expect(template).toContain('不要粘贴 R2、网关或本地机器的密钥。');
        expect(template).toContain('不要将 Agent 自动化相关行 `HDR-050` 或 `HDR-051` 用作 Phase A 证据。');
        expect(template).toContain('Phase A 验收不包括 MJ 对等');
        expect(template).toContain('产品延后决定记录');
        expect(template).toContain('延后决定在 Task 60 启动之前，还必须同步复制到');
        expect(template).toContain('Task 60 关卡：');
    });
});
