---
name: canvas-node-designer
description: "Design or modify a ComicCanvas node type across shared contracts, connection matrix, renderer UI, main-process run mapping, Plan whitelist, and tests."
---

# canvas-node-designer

Use this skill when adding a new canvas node type or changing an existing node's
data model, connection behavior, renderer representation, or generation action.

## Required Outputs

1. Shared type update in `shared/nodes.ts`.
   - Add or update the `NodeType` literal.
   - Add or update the node data interface.
   - JSDoc every exported type and field.

2. Connection matrix update in `shared/connection-matrix.ts`.
   - Update upstream/downstream allowed sets.
   - Keep this file the only connection truth source.
   - Update exhaustive or property-based tests.

3. Renderer node component.
   - Place under the renderer canvas node structure.
   - Follow orientation sizing: landscape 16:9, portrait 9:16, square 1:1.
   - Use `object-fit: contain`.
   - Use design tokens, not hardcoded colors or radii.
   - Keep generated state event-driven; no polling.

4. Main-process run behavior if the node generates content.
   - Register the runNode step type and provider mapping.
   - Enqueue local jobs; never return generated assets synchronously.
   - Persist assets through the local asset pipeline.

5. Plan whitelist and orchestration.
   - Add the type to Plan application whitelist.
   - Add the type to sanitizePlan/orchestrator allowed outputs.
   - Ensure executable code/script strings are still dropped.

6. Tests.
   - Connection matrix exhaustive/PBT coverage.
   - Orientation and asset terminal-state behavior when relevant.
   - Terminal event uniqueness for generated nodes.

## Checklist

- [ ] No duplicated connection matrix.
- [ ] Generated content is fully asynchronous.
- [ ] Exported fields have JSDoc.
- [ ] Plan sanitizer whitelist is updated.
- [ ] IPC/service contract changes are registered in `docs/api-contracts/`.
- [ ] Tests cover the core invariants.
