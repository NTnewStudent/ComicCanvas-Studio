# Agent Canvas Node Update And Zoom Design

## Goal

Make mouse and trackpad zoom explicit on the canvas, and make an Agent request
to edit an existing node produce an inspectable, applicable draft graph instead
of an empty CanvasPlan that claims success.

## Root Cause

CanvasPlan models creation, connection, and run steps only. A recent request to
populate an existing character node was routed to `canvas-planner`, which
attempted to express the update as a ref-less plan node. Plan sanitization
dropped every invalid entry, leaving the persisted character data untouched.

## Design

1. Extend intent analysis with a precise existing-canvas mutation route. Requests
   that use a current-node/workflow reference together with update language route
   the top-level chat run to `canvas-operator`; creation and workflow composition
   continue to route to `canvas-planner`.
2. The top-level Canvas Operator uses the existing approval-gated
   `canvas.updateNodeData` tool against the real workflow graph. Child operators
   remain isolated in draft graphs and retain the existing parent merge/apply gate.
3. Teach planner/operator prompts that CanvasPlan is creation-only and existing
   node field edits must use `canvas.updateNodeData` through the operator route.
4. Convert a model output that sanitizes from a non-empty requested CanvasPlan to
   an explicit clarification rather than exposing a misleading empty plan.
5. Set React Flow wheel, pinch, and double-click zoom props explicitly and keep
   scroll panning disabled so the wheel consistently changes scale.

## Verification

- Intent tests cover an existing character update route.
- Child draft tests prove a character patch changes only the draft and retains
  the existing node ID until application.
- Gateway parsing tests prove fully dropped mutation plans become clarifications.
- Canvas shell tests assert the explicit zoom interaction contract.
- Run focused Vitest suites, typecheck, the full test suite, and a manual canvas
  smoke check with an existing `Character 1` node.
