# Tasks - Infinite Canvas + Agent + Gateway Binding Architecture

> Status legend: `[ ]` not started, `[-]` in progress, `[x]` complete.
> This task list coordinates long-term architecture. It does not replace the
> hjwall parity or Conversation Context Engine task lists; it defines the
> cross-cutting architecture that those specs must converge toward.

## Phase 0 - Architecture Alignment

- [ ] 1. Record current architecture fit/gap audit.
  - Include: manual canvas, ToolRuntime, Agent runtime, gateway registry,
    static node model, hard-coded run descriptor, infinite canvas readiness.
  - Output: progress report under `docs/progress/`.
  - Requirements: R1.

- [ ] 2. Define stage gates for A/B/C roadmap.
  - Stage A: manual canvas parity + tools/services.
  - Stage B: context-aware Agent + sub-agent tool execution.
  - Stage C: node I/O protocol + dynamic gateway binding + infinite canvas.
  - Requirements: R1.

- [ ] 3. Update API contract index links.
  - Include: canvas plan, tools/agents, gateway providers, knowledge/context,
    future node definitions.
  - Requirements: R1.

## Phase 1 - Manual Canvas And Tool/UI Equivalence

- [ ] 4. Complete durable manual canvas operation inventory.
  - Include: create/connect/update/delete/duplicate/move/select/layout/save/
    load/import/export/snippet/run.
  - Requirements: R3, R4.

- [ ] 5. Map every durable operation to a tool/service owner.
  - Include: existing tool ID, missing tool ID, permissions, structured errors,
    renderer owner, service owner.
  - Requirements: R4.

- [ ] 6. Implement missing graph/node/edge tools required before Agent expansion.
  - Include: `canvas.graph.*`, `canvas.node.*`, `canvas.edge.*`,
    `canvas.layout.*`, `canvas.selection.*`.
  - Requirements: R3, R4.

- [ ] 7. Add UI/tool equivalence tests.
  - Include: manual add/connect/update/run and Agent/tool add/connect/update/run
    produce equivalent graph/job effects.
  - Requirements: R4.

## Phase 2 - Infinite Canvas Foundation

- [x] 8. Write infinite canvas architecture note.
  - Include: viewport model, graph state ownership, spatial index, selection,
    layout, snippets, graph versions, autosave, patch/event direction.
  - Evidence: `docs/architecture/infinite-canvas-architecture.md`,
    `tests/infinite-canvas-architecture-note.test.ts`.
  - Requirements: R2.

- [ ] 9. Stabilize node dimensions and interaction constraints.
  - Include: fixed/min dimensions, overflow rules, thumbnails, status badges,
    no layout shift on hover/status.
  - Requirements: R2.

- [x] 10. Add large graph performance gates.
  - Include: 100/500/1000 node smoke where feasible, pan/zoom, select, drag,
    save/load, fit view.
  - Evidence: `desktop/src/main/smoke/large-graph-performance-gate.ts`,
    `tests/large-graph-performance-gates.test.ts`.
  - Scope note: deterministic smoke gate only; real desktop acceptance remains
    separate.
  - Requirements: R2.

- [ ] 11. Add deterministic layout service.
  - Include: insert plan layout, insert snippet layout, connect-to-create
    placement, selected anchor placement.
  - Requirements: R2, R4.

## Phase 3 - Node Definition Protocol

- [ ] 12. Create `shared/node-definitions.ts`.
  - Include: `NodeDefinition`, `NodeInputPort`, `NodeOutputPort`,
    `NodeRuntimeAction`, data schema refs, UI schema refs, default data.
  - Requirements: R6, R7.

- [ ] 13. Register built-in Node Definitions for current node set.
  - Include: text/image/video/character/scene/audio/imageConfigV2/
    videoConfigV2/videoCompose/superResolution/muxAudioVideo/mjImage.
  - Requirements: R6, R12.

- [ ] 14. Move default node data into Node Definitions.
  - Include: remove duplicated default-data branches from renderer/store where
    feasible; services and UI consume same defaults.
  - Requirements: R3, R6.

- [ ] 15. Add node data schema validation at service/repository boundaries.
  - Include: graph save, node create, node update, plan apply, import.
  - Requirements: R3, R6.

- [ ] 16. Add Node Definition discovery for Agents.
  - Include: compact node capability summary in Context Pack or planner input.
  - Requirements: R5, R6.

## Phase 4 - Port Model And Edge Migration

- [ ] 17. Extend `CanvasEdgeData` with optional port fields.
  - Include: `sourcePortId`, `targetPortId`, `role`, `order`.
  - Requirements: R7, R12.

- [ ] 18. Implement port compatibility validation.
  - Include: media type, role, multiplicity, ordered inputs, accepted upstream
    output types.
  - Requirements: R7.

- [ ] 19. Add legacy edge inference.
  - Include: infer ports for `promptOrder`, `imageRole`, and `default`; warn
    when ambiguous.
  - Requirements: R7, R12.

- [ ] 20. Update connection UI to show/consume ports where needed.
  - Include: handle labels, port menus, default port fallback, invalid feedback.
  - Requirements: R2, R7.

- [ ] 21. Add port-aware graph sanitizer.
  - Include: graph save/load/import/plan apply all revalidate ports and edge
    semantics.
  - Requirements: R7, INV-3.

## Phase 5 - Runtime Compiler

- [ ] 22. Define `NodeRunRequest` and compile result contracts.
  - Include: workflow ID, graph version, node/action, channel, inputs,
    references, parameters, output bindings, compile snapshot.
  - Requirements: R8.

- [ ] 23. Implement Runtime Compiler skeleton.
  - Include: collect node data, incoming port inputs, styles, selected assets,
    workflow defaults, deterministic prompt composition.
  - Requirements: R8.

- [ ] 24. Reproduce current `buildRunDescriptor` behavior through compiler.
  - Include: image, video, audio, videoCompose, superResolution,
    muxAudioVideo, mjImage.
  - Requirements: R8, R12.

- [ ] 25. Route `canvas.runNode` through Runtime Compiler.
  - Include: structured validation errors, compile snapshot in job payload,
    no provider submission on compile failure.
  - Requirements: R3, R8.

- [ ] 26. Add compiler recovery tests.
  - Include: restart/reopen terminal writeback has enough snapshot metadata.
  - Requirements: R8, R11.

## Phase 6 - Gateway Binding Protocol

- [ ] 27. Extend gateway contracts with Adapter Manifest.
  - Files: `shared/gateway.ts`, `docs/api-contracts/gateway-providers.md`.
  - Include: capabilities, models, parameter schema, accepted inputs, produced
    outputs, task mode, mapping refs.
  - Requirements: R9, R10.

- [ ] 28. Implement Binding Resolver.
  - Include: workflow default, node override, action override, first compatible
    gateway fallback, stale gateway warning.
  - Requirements: R9, R10.

- [ ] 29. Add capability validation before remote submission.
  - Include: required node action capabilities vs gateway manifest.
  - Requirements: R9.

- [ ] 30. Add declarative parameter mapping for first vertical slice.
  - Include: image node action maps prompt/references/ratio/style/model to
    OpenAI-compatible or stub gateway request.
  - Requirements: R9, R12.

- [ ] 31. Add custom gateway manifest validation.
  - Include: schema validation, auth mode, unsupported mapping rejection,
    quarantine diagnostics if plugin/manifest invalid.
  - Requirements: R9, R10.

## Phase 7 - Multi-Gateway UI And Workflow Defaults

- [ ] 32. Add workflow-level gateway/model defaults.
  - Include: by channel/action kind: text/image/video/audio/compose/upscale/mux.
  - Requirements: R10.

- [ ] 33. Add node/action gateway override model.
  - Include: stable gateway ID/model key refs in node data or binding config,
    no secrets.
  - Requirements: R10.

- [ ] 34. Add parameter-schema driven controls.
  - Include: display provider-specific safe parameters from manifest without
    hard-coding all fields in node components.
  - Requirements: R10.

- [ ] 35. Add stale gateway/model validation warnings.
  - Include: disabled/deleted gateway, missing model, capability mismatch,
    strict run blocks.
  - Requirements: R10, R12.

## Phase 8 - Output Binding And Downstream Flow

- [ ] 36. Define Runtime Output Binding contract.
  - Include: output port ID, result path, node data path, asset ref type,
    multiplicity.
  - Requirements: R11.

- [ ] 37. Implement Output Binder.
  - Include: media asset persistence, text/json validation, idempotent job
    writeback, ordered multi-output support.
  - Requirements: R11.

- [ ] 38. Update downstream compile to consume output ports.
  - Include: no guessing from node type alone; consume source port metadata.
  - Requirements: R7, R11.

- [ ] 39. Add output binding tests.
  - Include: image result, multi-image MJ result, video compose result, text/JSON
    result where supported.
  - Requirements: R11.

## Phase 9 - Agent Over Node Definitions

- [ ] 40. Add Node Definition summaries to Context Pack/planner input.
  - Include: node type, required inputs, outputs, runtime actions, gateway
    availability.
  - Requirements: R5, R6.

- [ ] 41. Update CanvasPlan sanitizer to validate Node Definition actions.
  - Include: node data schema, runtime action compatibility, no provider
    payloads.
  - Requirements: R5, R6, R9.

- [ ] 42. Implement sub-agent graph draft merge over tools.
  - Include: child draft graph, parent approval, sanitized merge, graph version.
  - Requirements: R5.

- [ ] 43. Add general Agent workflow smoke.
  - Flow: user asks for comic workflow -> Agent creates nodes -> child agent
    configures prompts -> tools connect/run -> outputs bind.
  - Requirements: R5, R8, R11.

## Phase 10 - Migration And Acceptance

- [ ] 44. Add migration tests for pre-port graphs.
  - Include: valid old graph loads and saves; ambiguous graph loads with
    warnings and strict-run block.
  - Requirements: R12.

- [ ] 45. Replace hard-coded run descriptor gradually.
  - Include: feature-by-feature replacement and parity tests before deleting old
    branches.
  - Requirements: R8, R12.

- [ ] 46. Add first custom gateway vertical slice.
  - Include: manifest validation -> node action binding -> job -> normalized
    result -> output binding.
  - Requirements: R9, R10, R11.

- [ ] 47. Add human desktop review checklist rows.
  - Include: manual canvas, Agent plan/tool execution, gateway binding UI,
    stale warnings, large graph behavior.
  - Requirements: all.

- [ ] 48. Mark architecture accepted only when Stage A/B/C gates are traceable.
  - Include: backlog update, progress report, API contracts, test evidence.
  - Requirements: all.
