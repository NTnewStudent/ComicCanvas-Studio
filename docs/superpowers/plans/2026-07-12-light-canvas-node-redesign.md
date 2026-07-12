# Light Canvas Node Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved light-gray canvas workbench and a consistent compact node visual language without altering canvas behavior.

**Architecture:** Rework shared canvas tokens and `NODE_UI_CLASS_NAMES` first, then use their common classes to migrate standard, semantic, and media nodes. CSS owns hover and selected treatment so drag performance and existing React state are preserved.

**Tech Stack:** React 18, React Flow, Tailwind utility classes, CSS, Vitest, Bun.

---

### Task 1: Shared Workbench And Node Tokens

**Files:**
- Modify: `desktop/src/renderer/src/canvas/canvas.css`
- Modify: `desktop/src/renderer/src/canvas/lib/node-sizing.ts`
- Test: `tests/canvas-shell-parity.test.ts`

- [ ] Write a failing static test for light workbench classes, 8px node radius, idle no-shadow, and compact handles.
- [ ] Run `bun x vitest run tests/canvas-shell-parity.test.ts` and verify the new selector assertions fail.
- [ ] Implement light canvas background, subdued grid/edges, compact controls/minimap, shared frame/header/field/action classes, and small circular handles.
- [ ] Run `bun x vitest run tests/canvas-shell-parity.test.ts && bun run typecheck`; expected PASS.

### Task 2: Standard And Semantic Node Migration

**Files:**
- Modify: `desktop/src/renderer/src/canvas/nodes/TextNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/ImageNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MigratedNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/CharacterNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/SceneNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/AudioNode.tsx`
- Test: `tests/production-node-components-parity.test.tsx`

- [ ] Write failing class/accessibility assertions for compact headers and icon actions.
- [ ] Migrate node roots to shared frame classes and remove uppercase labels and nested-card treatment.
- [ ] Run focused node tests and typecheck; expected PASS.

### Task 3: Media And Production Node Migration

**Files:**
- Modify: `desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoComposeNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/SuperResolutionNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MjImageNode.tsx`
- Test: `tests/image-config-v2-parity.test.tsx`, `tests/video-config-v2-parity.test.tsx`

- [ ] Write failing visual-class regressions for compact preview cards and toolbars.
- [ ] Replace oversized radii, idle shadows, and text action buttons with shared primitive classes while retaining existing callbacks.
- [ ] Run focused media tests and typecheck; expected PASS.

### Task 4: Visual And Performance Verification

**Files:**
- Create: `docs/progress/light-canvas-node-redesign-test-report.md`
- Test: `tests/canvas-display-nodes.test.ts`, `tests/canvas-related-highlight-parity.test.ts`, `tests/canvas-shell-parity.test.ts`

- [ ] Run focused canvas, node, and 2,000-node display regressions.
- [ ] Capture light-workbench screenshots at desktop and mobile sizes with the local server.
- [ ] Record exact results, including any unrelated full-suite failure.
