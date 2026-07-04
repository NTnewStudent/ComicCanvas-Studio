# Tasks - Conversation Context Engine

> Status legend: `[ ]` not started, `[-]` in progress, `[x]` complete.
> This spec replaces hidden/LTM-style memory with explicit workflow-scoped
> Context Packs.

## Phase 0 - Audit And Contracts

- [ ] 1. Audit current context implementation and gaps.
  - Include: `orchestrator.ts` single-message planner input,
    `chat-message.repo.ts`, `knowledge.repo.ts` placeholder,
    `context_packs` schema, agent context policy UI.
  - Output: update progress notes with "contract exists, runtime missing".
  - Requirements: R1-R10.

- [ ] 2. Extend shared context contracts.
  - Files: `shared/knowledge.ts`, `shared/agents.ts`.
  - Include: `runId`, `messageId`, `workflowId`, `graphSnapshot` hint,
    `renderedContext`, token estimates, warnings, omitted sources, citations.
  - Verify: typecheck and contract tests.
  - Requirements: R1, R5, R7.

- [ ] 3. Update IPC contracts and docs.
  - Files: `shared/ipc.ts`, `docs/api-contracts/knowledge-context.md`.
  - Include: `context.build`, `context.getPack`, `context.compact`,
    `knowledge.ingest/retrieve/delete/rebuild`.
  - Verify: IPC schema tests and docs link checks.
  - Requirements: R8.

## Phase 1 - ContextBuilder Skeleton

- [ ] 4. Implement `ContextBuilderService` skeleton.
  - Files: `desktop/src/main/knowledge/context-builder.ts`.
  - Include: source registry, deterministic priority ordering, rendered context,
    redaction hook, warnings, persistence call.
  - Verify: unit tests with fake source providers.
  - Requirements: R1, R5, R7, INV-2, INV-3.

- [ ] 5. Implement context persistence repository methods.
  - Files: `knowledge.repo.ts` or dedicated `context-pack.repo.ts`.
  - Include: create/get Context Pack, source refs JSON, redactions JSON,
    summary JSON.
  - Verify: repository tests.
  - Requirements: R7, INV-6.

- [ ] 6. Add context redaction utility.
  - Include: API key patterns, bearer/auth headers, provider secret labels,
    hidden prompt markers, unsafe absolute path handling.
  - Verify: redaction unit tests and no-secret persistence tests.
  - Requirements: R9, INV-4.

- [ ] 7. Add deterministic token estimator and budgeter.
  - Include: conservative character estimator, section overhead, source
    omission records, required-source failure.
  - Verify: snapshot tests for identical inputs.
  - Requirements: R5, INV-3.

## Phase 2 - Recent Chat History

- [ ] 8. Extend chat message repository for bounded history.
  - Include: list latest by workflow with limit/cursor, list before message,
    optional assistant/system/tool rows.
  - Verify: ordering and workflow isolation tests.
  - Requirements: R2.

- [ ] 9. Implement `ChatContextSource`.
  - Include: current message, recent user/assistant turns, compact plan summary,
    job/tool terminal summaries.
  - Verify: plan JSON is summarized by default and binary data is never emitted.
  - Requirements: R2, R5, R9.

- [ ] 10. Persist assistant/context result rows where useful.
  - Include: assistant plan-ready summary row or run result row if product
    chooses visible assistant history beyond user message + plan JSON.
  - Verify: Canvas chat history can be reconstructed after reload.
  - Requirements: R2, R7.

## Phase 3 - Orchestrator Integration

- [ ] 11. Extend `OrchestratorPlannerInput`.
  - Include: `workflowId`, `contextPack`, `renderedContext`.
  - Verify: default planner tests updated to tolerate context.
  - Requirements: R1.

- [ ] 12. Wire `agent.run` job handler to build context.
  - Include: resolve agent policy, build `ContextBuildInput`, persist
    Context Pack, attach `contextPackId` to agent run trace.
  - Verify: integration test that planner sees context and plan persists.
  - Requirements: R1, R7, INV-6.

- [ ] 13. Extend `canvas.chatSend` request shape.
  - Include: optional `workflowId`, `selectedNodeIds`, `selectedAssetIds`,
    graph/version hint; keep response ticket-only.
  - Verify: IPC tests and renderer call updates.
  - Requirements: R1, R3, R8.

- [ ] 14. Add `context.build` IPC/debug handler.
  - Include: production ContextBuilder path, safe output, validation errors.
  - Verify: IPC unit tests.
  - Requirements: R7, R8.

## Phase 4 - Canvas And Asset Sources

- [ ] 15. Implement `CanvasContextSource`.
  - Include: graph counts, node type inventory, selected node details, edge
    summary, validation warnings, large-graph summarization.
  - Verify: large graph and selected-node priority tests.
  - Requirements: R3, R5.

- [ ] 16. Implement `AssetContextSource`.
  - Include: selected asset metadata, category/tags, media type, orientation,
    duration/dimensions, tombstone/deleted warnings.
  - Verify: selected asset and deleted asset tests.
  - Requirements: R3, R9.

- [ ] 17. Ensure context graph data uses shared contracts.
  - Include: no unknown node types, no connection matrix duplication, warning
    source for invalid refs.
  - Verify: shared node whitelist tests.
  - Requirements: R3.

## Phase 5 - Knowledge Retrieval

- [ ] 18. Implement KnowledgeRepository data access.
  - Include: ingest document, create chunks, retrieve chunks, delete document,
    rebuild scope.
  - Verify: repository tests.
  - Requirements: R4, R9, INV-5.

- [ ] 19. Implement lexical retrieval.
  - Include: deterministic chunking, normalized term overlap scoring, score
    tie-breakers, citation metadata.
  - Verify: retrieval ranking and citation tests.
  - Requirements: R4.

- [ ] 20. Implement `KnowledgeContextSource`.
  - Include: scoped retrieval using current message and selected source IDs,
    warning on safe retrieval failure.
  - Verify: scope isolation and failure fallback tests.
  - Requirements: R4, R5, R9.

- [ ] 21. Add knowledge IPC handlers.
  - Include: ingest/retrieve/delete/rebuild validation and error classes.
  - Verify: IPC tests and docs examples.
  - Requirements: R4, R8.

## Phase 6 - Compaction And Summaries

- [ ] 22. Add `conversation_summaries` migration/repository.
  - Include: workflow, message range, summary text, source refs, redactions.
  - Verify: repository tests.
  - Requirements: R6, R7.

- [ ] 23. Implement `ContextSummaryService`.
  - Include: summary structure, deterministic test summarizer, provider-backed
    summarizer adapter behind jobs later.
  - Verify: summary structure tests.
  - Requirements: R6.

- [ ] 24. Add automatic compaction trigger.
  - Include: threshold by message count/token estimate, boundary recording,
    fallback warning on failure.
  - Verify: old messages are not duplicated with summary in Context Pack.
  - Requirements: R6, R10.

- [ ] 25. Add `context.compact` debug/manual channel or tool.
  - Include: enqueue async job if provider-backed; return ticket/status.
  - Verify: no synchronous provider call.
  - Requirements: R6, R8, R10.

## Phase 7 - Inspection UI And Developer Tools

- [ ] 26. Add `context.getPack` API.
  - Include: source refs, priorities, excerpts, token estimate, warnings,
    redaction classes, citations.
  - Verify: safe missing-source inspection.
  - Requirements: R7, R8.

- [ ] 27. Add renderer inspection affordance.
  - Include: plan/debug panel link from chat plan result or run history to
    Context Pack details.
  - Verify: component test and human desktop review row.
  - Requirements: R7.

- [ ] 28. Add context source warnings to chat/plan UI.
  - Include: knowledge unavailable, deleted asset refs, graph too large,
    context omitted sources.
  - Verify: UI tests.
  - Requirements: R2-R7.

## Phase 8 - cc-haha-Inspired Advanced Behavior

- [ ] 29. Add context prefetch hooks where safe.
  - Include: stable agent/workflow metadata prefetch, optional retrieval
    prefetch during job setup, tolerate missed deadlines.
  - Verify: no user-visible blocking.
  - Requirements: R10.

- [ ] 30. Define child-agent context inheritance.
  - Include: parent policy ∩ child policy, explicit Context Pack derivation,
    no hidden shared memory.
  - Verify: permission/context monotonicity tests.
  - Requirements: R10, INV-1.

- [ ] 31. Add context health checks and observability.
  - Include: pack build failures, redaction counts, retrieval failures,
    compaction failures, average token estimate.
  - Verify: diagnostics tests.
  - Requirements: R7, R9.

## Phase 9 - Acceptance Gates

- [ ] 32. Add automated end-to-end context smoke test.
  - Flow: send message -> plan -> send follow-up referencing previous plan ->
    verify planner receives recent-message Context Pack.
  - Requirements: R1, R2.

- [ ] 33. Add canvas context smoke test.
  - Flow: create nodes/assets -> select node/asset -> chat request -> verify
    Context Pack includes selected node/asset before global graph.
  - Requirements: R3.

- [ ] 34. Add knowledge retrieval smoke test.
  - Flow: ingest note -> ask related question -> verify retrieved citation in
    Context Pack.
  - Requirements: R4.

- [ ] 35. Add compaction smoke test.
  - Flow: create long chat history -> trigger context build -> verify summary,
    boundary, no duplicate full old history.
  - Requirements: R6.

- [ ] 36. Mark feature accepted only after automated tests and human review.
  - Include: update backlog, progress report, and API contract docs.
  - Requirements: all.
