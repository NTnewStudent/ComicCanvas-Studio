# Phase A Human Review Session Template

Review date:

Reviewer:

App build or commit:

Checklist source: `docs/progress/human-desktop-review-checklist.md`

Runbook source: `docs/progress/phase-a-human-review-runbook.md`

## Session Rules

- Record only manual desktop observations here.
- Do not paste R2, gateway, or local machine secrets.
- Do not use Agent automation rows `HDR-050` or `HDR-051` as Phase A evidence.
- Do not include MJ parity, MJ multi-result UI, MJ URL refresh, MJ run recovery,
  or MJ provider integration in Phase A acceptance.
- A row can be deferred only by explicit product decision with owner, reason,
  and follow-up location.

## Required Row Results

| Row ID | Result | Reviewer / Date | Follow-up or Deferral |
| :--- | :--- | :--- | :--- |
| HDR-042 | Pending |  |  |
| HDR-043 | Pending |  |  |
| HDR-ASSET-001 | Pending |  |  |
| HDR-ASSET-002 | Pending |  |  |
| HDR-ASSET-003 | Pending |  |  |
| HDR-ASSET-004 | Pending |  |  |
| HDR-ASSET-005 | Pending |  |  |
| HDR-ASSET-006 | Pending |  |  |
| HDR-ASSET-007 | Pending |  |  |
| HDR-ASSET-008 | Pending |  |  |
| HDR-ASSET-009 | Pending |  |  |
| HDR-WF-001 | Pending |  |  |
| HDR-WF-002 | Pending |  |  |
| HDR-WF-003 | Pending |  |  |
| HDR-WF-004 | Pending |  |  |
| HDR-WF-005 | Pending |  |  |
| HDR-WF-006 | Pending |  |  |
| HDR-024 | Pending |  |  |
| HDR-CANVAS-001 | Pending |  |  |
| HDR-CANVAS-002 | Pending |  |  |
| HDR-CANVAS-003 | Pending |  |  |
| HDR-CANVAS-004 | Pending |  |  |
| HDR-CANVAS-005 | Pending |  |  |
| HDR-NODE-001 | Pending |  |  |
| HDR-NODE-002 | Pending |  |  |
| HDR-RUNTIME-001 | Pending |  |  |
| HDR-RUNTIME-002 | Pending |  |  |
| HDR-TOOLS-001 | Pending |  |  |
| HDR-PHASEA-001 | Pending |  |  |

## Failure Records

Use one block per failed row.

```text
Row:
Observed issue:
Blocking impact:
Follow-up task or issue:
Reviewer:
Date:
```

## Product Deferral Records

Use one block per deferred row. Deferrals must also be copied into
`docs/progress/human-desktop-review-checklist.md` and
`docs/progress/test-report.md` before Task 60 can start.

```text
Row:
Deferral reason:
Product owner:
Follow-up location:
Date:
```

## Final Decision

`HDR-PHASEA-001` result:

Decision notes:

Task 60 gate:

- Closed while `HDR-PHASEA-001` is Pending or Fail.
- Open only after `HDR-PHASEA-001` is Pass, or after explicit product deferral
  is recorded in both the checklist and test report.
