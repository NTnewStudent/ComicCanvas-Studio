import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
/** Parses the RUEPE pointer table row value from backlog markdown. */
function parseRuepePointerField(backlog, field) {
    const section = backlog.match(/## 当前执行项（RUEPE 真源，单项）[\s\S]*?(?=\n## |\n---\n\n## |$)/);
    if (!section) {
        throw new Error('Missing RUEPE pointer section in backlog.md');
    }
    const row = section[0].match(new RegExp(`\\| ${field} \\| ([^|]+) \\|`));
    if (!row) {
        throw new Error(`Missing RUEPE pointer field: ${field}`);
    }
    return row[1].trim().replace(/^`|`$/g, '').replace(/`/g, '');
}
describe('M0 progress reconciliation', () => {
    it('marks evidence-backed M0 tasks complete in the canonical backlog', () => {
        const backlog = readFileSync('docs/progress/backlog.md', 'utf8');
        expect(backlog).toContain('| REQ-008 | `shared/composed-prompt.ts` 确定性 prompt 拼接纯函数 | ✅ |');
        expect(backlog).toContain('| REQ-009 | LTM 初始化（ltm/bin/ltm.py selftest 通过） | ✅ |');
        expect(backlog).toContain('| REQ-019 | `docs/api-contracts/*` 模块契约拆分登记（jobs/assets/gateway/tools/agents/skills/knowledge/audit） | ✅ |');
    });
    it('marks milestone M0 backlog reconciliation complete', () => {
        const milestoneTasks = readFileSync('specs/milestone-execution-plan/tasks.md', 'utf8');
        expect(milestoneTasks).toContain('- [x] 4. Reconcile M0 backlog status.');
    });
});
describe('RUEPE backlog pointer', () => {
    it('defines a single active spec task pointer with an existing spec file', () => {
        const backlog = readFileSync('docs/progress/backlog.md', 'utf8');
        expect(backlog).toContain('## 当前执行项（RUEPE 真源，单项）');
        const specPath = parseRuepePointerField(backlog, 'spec');
        const task = parseRuepePointerField(backlog, 'task');
        const status = parseRuepePointerField(backlog, '状态');
        expect(specPath).toMatch(/^specs\/.+\/tasks\.md$/);
        expect(existsSync(specPath)).toBe(true);
        expect(Number.parseInt(task, 10)).toBeGreaterThan(0);
        expect(['待开始', '进行中', '已完成', '阻塞']).toContain(status);
        const specTasks = readFileSync(specPath, 'utf8');
        expect(specTasks).toMatch(new RegExp(`- \\[[ x\\-]\\] ${task}\\.`));
    });
    it('points to completed M5 spec after engineering queue closure', () => {
        const backlog = readFileSync('docs/progress/backlog.md', 'utf8');
        const specPath = parseRuepePointerField(backlog, 'spec');
        const task = parseRuepePointerField(backlog, 'task');
        const status = parseRuepePointerField(backlog, '状态');
        expect(specPath).toBe('specs/milestone-execution-plan/tasks.md');
        expect(task).toBe('47');
        expect(status).toBe('已完成');
    });
    it('documents the RUEPE design spec and cursor rule', () => {
        const designPath = 'docs/superpowers/specs/2026-07-05-ruepe-task-execution-design.md';
        const rulePath = '.cursor/rules/ruepe-task-execution.mdc';
        expect(existsSync(designPath)).toBe(true);
        expect(existsSync(rulePath)).toBe(true);
        expect(readFileSync(rulePath, 'utf8')).toContain('alwaysApply: true');
        expect(readFileSync(designPath, 'utf8')).toContain('当前执行项');
    });
});
