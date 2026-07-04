# Phase A Human Review Runbook

Date created: 2026-06-27

Canonical checklist: `docs/progress/human-desktop-review-checklist.md`

Session template: `docs/progress/phase-a-human-review-session-template.md`

This runbook turns Phase A desktop acceptance into a repeatable manual review.
It replaces automated real-desktop evidence. Automated tests can prove
engineering behavior, but `HDR-PHASEA-001` is accepted only by a human reviewer
or by an explicit product deferral recorded in the checklist and test report.

## Scope

Review these Phase A areas:

- Assets and custom image categories: `HDR-042`, `HDR-043`,
  `HDR-ASSET-001` through `HDR-ASSET-009`.
- Workflows and snippets: `HDR-WF-001` through `HDR-WF-006`, `HDR-024`.
- Canvas and node UI: `HDR-CANVAS-001` through `HDR-CANVAS-005`,
  `HDR-NODE-001`, `HDR-NODE-002`.
- Runtime and tools: `HDR-RUNTIME-001`, `HDR-RUNTIME-002`, `HDR-TOOLS-001`.
- Final decision: `HDR-PHASEA-001`.

Do not review Agent automation as Phase A acceptance evidence. `HDR-050` and
`HDR-051` remain Pending until Task 60 is allowed to start.

MJ node/component implementation is out of scope. Legacy MJ graphs may be
opened only to verify readable unavailable behavior; no MJ parity, multi-result
selection, URL refresh, run recovery, or provider integration is required.

Seedance/live-person flows and LTM are out of scope.

## Preparation

1. Confirm the app build or commit under review.
2. Confirm local storage uses SQLite and asset files stay under app data or the
   configured safe asset protocol.
3. For R2 review, use the already verified `wenyi` profile from local SQLite
   configuration. Do not paste secrets into notes, screenshots, logs, commits,
   or this repository.
4. Open `docs/progress/human-desktop-review-checklist.md` and keep one row per
   reviewed flow updated with reviewer/date/result/notes.
5. Copy `docs/progress/phase-a-human-review-session-template.md` into the review
   notes area or use it directly as the session record.
6. Run the automated evidence suite separately; failures do not get waived by a
   manual Pass.

## Review Order

1. Open the app and complete startup/navigation rows `HDR-001` through
   `HDR-003` for basic confidence.
2. Review workflow project lifecycle rows `HDR-010` through `HDR-015`, then
   `HDR-WF-001` through `HDR-WF-006`.
3. Review asset rows `HDR-042`, `HDR-043`, and `HDR-ASSET-001` through
   `HDR-ASSET-009`.
4. Review canvas rows `HDR-020` through `HDR-024` and `HDR-CANVAS-001` through
   `HDR-CANVAS-005`.
5. Review non-MJ node rows `HDR-030` through `HDR-033`, `HDR-NODE-001`, and
   `HDR-NODE-002`.
6. Review runtime/tool rows `HDR-RUNTIME-001`, `HDR-RUNTIME-002`, and
   `HDR-TOOLS-001`.
7. Update `HDR-PHASEA-001` only after all required Phase A rows are Pass or
   explicitly deferred by product decision.

## Result Rules

- Use `Pass` only when the reviewer completed the flow without a blocking issue.
- Use `Fail` when a blocking issue is found, and link a follow-up task.
- Use `N/A` only when the flow is not applicable to the current slice.
- Use `Pending` when the row has not been reviewed yet.
- Use an explicit product deferral only when the product owner chooses to defer
  a row; record the reason, owner, and follow-up location in the notes.

## Task 60 Gate

Task 60, Agent plan apply/run over the completed workflow vocabulary, must not
start while `HDR-PHASEA-001` is Pending.

Task 60 may start only after one of these is true:

- `HDR-PHASEA-001` is marked Pass by a human reviewer.
- An explicit product deferral for Phase A acceptance is recorded in both
  `docs/progress/human-desktop-review-checklist.md` and
  `docs/progress/test-report.md`.

Until that gate opens, PlanCard apply/run and Agent auto-run acceptance rows
`HDR-050` and `HDR-051` stay Pending.
