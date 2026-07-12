# Large Canvas Drag Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 2,000-node canvas drags preserve unchanged node identities and defer non-visual drag work.

**Architecture:** A pure display projection keeps stable React Flow node references for unchanged highlight state. CanvasPage uses drag lifecycle state to defer persistence and hide costly auxiliary rendering until the final drag coordinates are committed.

**Tech Stack:** React 18, React Flow, TypeScript strict, Vitest, Bun.

---

### Task 1: Stable Display Projection

**Files:**
- Create: `desktop/src/renderer/src/canvas/lib/display-nodes.ts`
- Test: `tests/canvas-display-nodes.test.ts`

- [ ] Write a failing 2,000-node reference-stability test.
- [ ] Implement a projection that only clones nodes whose related class changes.
- [ ] Run `bun scripts/run-vitest.mjs run tests/canvas-display-nodes.test.ts`.

### Task 2: Drag-Phase Work Deferral

**Files:**
- Modify: `desktop/src/renderer/src/canvas/CanvasPage.tsx`
- Test: `tests/canvas-shell-parity.test.ts`

- [ ] Write failing source-contract assertions for the stable display projection,
  drag-phase persistence bypass, and deferred MiniMap rendering.
- [ ] Wire CanvasPage to the display projection and drag lifecycle state.
- [ ] Run `bun scripts/run-vitest.mjs run tests/canvas-shell-parity.test.ts`.

### Task 3: Integrated Verification

**Files:**
- Test: `tests/canvas-display-nodes.test.ts`
- Test: `tests/canvas-shell-parity.test.ts`

- [ ] Run focused canvas performance tests at 2,000 nodes.
- [ ] Run `bun run typecheck` and `git diff --check`.
- [ ] Run the full Vitest suite and record any unrelated pre-existing failures.
