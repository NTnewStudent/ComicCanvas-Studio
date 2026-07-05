# hjwall Canvas Full Migration — Phase 7 Human Review Scenarios

Date: 2026-07-05

Canonical spec: `specs/hjwall-canvas-full-migration/tasks.md` (tasks 30–32)

Companion checklist: `docs/progress/human-desktop-review-checklist.md`

Runbook: `docs/progress/phase-a-human-review-runbook.md`

Engineering status: scenarios documented and linked to HDR rows. **Human execution remains Pending** under REQ-098 until a reviewer records Pass/Fail in the checklist.

---

## Scenario A — Full comic-drama chain (Task 30)

**Goal:** Validate end-to-end manual comic-drama production on stub jobs.

| Step | Action | HDR / evidence |
| :--- | :--- | :--- |
| 1 | Create a new workflow project from `/projects` | HDR-010 |
| 2 | Open canvas; add story `text` node with script content | HDR-020, HDR-NODE-001 |
| 3 | Add `character` node; bind or describe character | HDR-NODE-001 |
| 4 | Set project default style via top bar / style panel | HDR-CANVAS-005, HDR-032 |
| 5 | Add `imageConfigV2`; connect text → image; select node style if needed | HDR-NODE-001 |
| 6 | Run stub image job; confirm ticket-first + terminal `done` | HDR-032 |
| 7 | Add `videoConfigV2`; use generated image as first frame | HDR-NODE-001 |
| 8 | Run stub video job; confirm terminal state | HDR-032 |
| 9 | Save graph (Ctrl+S / autosave); reopen project | HDR-015, HDR-WF-005, HDR-033 |

**Pass criteria:** No blocking errors; node statuses reach terminal states; save/reopen preserves graph and job reconciliation without visible polling.

---

## Scenario B — Asset and snippet flow (Task 31)

**Goal:** Validate asset library + snippet portability across projects.

| Step | Action | HDR / evidence |
| :--- | :--- | :--- |
| 1 | Import image, video, and audio via `/assets` or canvas drop | HDR-022, HDR-ASSET-007, HDR-CANVAS-002 |
| 2 | Create folder; move assets; search/filter/sort | HDR-042, HDR-ASSET-005 |
| 3 | Insert assets into canvas as typed nodes | HDR-ASSET-006 |
| 4 | Select two or more nodes; save snippet | HDR-024 |
| 5 | Open different project; insert snippet | HDR-024, HDR-WF-004 |
| 6 | Save and reopen; confirm remapped IDs and edges | HDR-WF-004, HDR-033 |

**Pass criteria:** Imports show safe metadata (no absolute paths); snippet round-trip preserves structure; referenced assets remain valid or tombstoned per policy.

---

## Scenario C — Agent orchestration (Task 32)

**Goal:** Validate Agent plan → apply → autoExecute over migrated vocabulary (stub jobs).

**Gate:** Requires `HDR-PHASEA-001` Pass or explicit product deferral before Agent rows are acceptance evidence (see HDR-050..052).

| Step | Action | HDR / evidence |
| :--- | :--- | :--- |
| 1 | Ask Agent for short comic-drama image-to-video chain with named character + style | HDR-050 |
| 2 | Review PlanCard migrated node/action summary | HDR-051 |
| 3 | Apply plan; enable autoExecute if off | HDR-051 |
| 4 | Observe serial stub run steps and terminal node states | HDR-052 |

**Pass criteria:** Plan uses migrated node types/actions only; serial execution respects failed short-circuit; terminal states visible without renderer polling.

---

## Automated smoke coverage

Static tests assert this document exists and lists required scenario anchors:

- `tests/hjwall-canvas-phase7-scenarios.test.ts`

Full desktop execution remains human-owned per REQ-098.
