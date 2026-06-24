# Implementation Plan - Core Platform Foundation

> This plan is for contract and platform foundation work before feature implementation. Each task lists verification and requirement coverage. Implementation workers must keep specs in root `specs/`, not in `.codex/` or `.claude/`.

## Phase A - Spec And Backlog Governance

- [ ] 1. Register this foundation spec in `docs/progress/backlog.md`.
  - Verify: backlog links `specs/core-platform-foundation/tasks.md`.
  - Covers: R1.

- [ ] 2. Treat root `specs/` as the canonical spec archive.
  - Verify: search `AGENTS.md`, `docs/`, `.agents/`, `.codex/`, and `specs/` for canonical links to tool-specific spec directories; expected result is no canonical links.
  - Covers: R1.

- [ ] 3. Keep `.claude/` and `.codex/` as tool/runtime layers only.
  - Verify: agent and skill instructions point product specs to `specs/`.
  - Covers: R1.

## Phase B - API Contract Documents

- [ ] 4. Create `docs/api-contracts/canvas-plan.md`.
  - Must define: CanvasPlan lifecycle, sanitize rules, applyPlan, runSteps, terminal node binding.
  - Verify: every new CanvasPlan API/IPC handler can reference this file with `@see`.
  - Covers: R1, R2, R7.

- [ ] 5. Create `docs/api-contracts/jobs.md`.
  - Must define: enqueue, get, list, state machine, recovery, terminal events, retry eligibility.
  - Verify: includes completed/failed exactly-once property and reconnect compensation.
  - Covers: R3, INV-1, INV-2.

- [ ] 6. Create `docs/api-contracts/assets-files.md`.
  - Must define: generated assets, imports, folders, moves, trash, tombstones, safe protocol.
  - Verify: includes relative-path-only and no absolute path response rule.
  - Covers: R4, INV-5.

- [ ] 7. Create `docs/api-contracts/gateway-providers.md`.
  - Must define: provider config, capability matrix, OpenAI-compatible adapter, async media adapter, normalized request/result/error envelopes.
  - Verify: includes unsupported capability preflight and secret redaction.
  - Covers: R5, INV-3.

- [ ] 8. Create `docs/api-contracts/tools-plugins.md`.
  - Must define: ToolDefinition, schema validation, permission policy, concurrency, plugin manifest, quarantine.
  - Verify: built-in and plugin tools use the same interface.
  - Covers: R6, INV-4, INV-7.

- [ ] 9. Create `docs/api-contracts/agents.md`.
  - Must define: AgentDefinition, AgentRegistry, agent runs, Context Pack, CanvasPlan output, sub-agent permission inheritance.
  - Verify: child permissions are defined as parent-policy intersection.
  - Covers: R7, INV-4.

- [ ] 10. Create `docs/api-contracts/skills.md`.
  - Must define: SkillDefinition, metadata discovery, invocation, lazy reference loading, hot reload, invocation trace.
  - Verify: skill permission requests cannot exceed invoking agent permissions.
  - Covers: R8, INV-4, INV-7.

- [ ] 11. Create `docs/api-contracts/knowledge-context.md`.
  - Must define: ingest, chunk, retrieve, delete, rebuild, retrieval scope, citations, ContextBuilder priority.
  - Verify: deleted documents cannot appear in retrieval tests.
  - Covers: R9, INV-6.

- [ ] 12. Create `docs/api-contracts/audit-observability.md`.
  - Must define: audit entry shape, trace IDs, health checks, redaction, safe IPC errors.
  - Verify: all permissioned domains have correlation IDs.
  - Covers: R10.

## Phase C - Shared Contract Skeletons

- [ ] 13. Define shared job contracts in `shared/jobs.ts`.
  - Verify: TypeScript strict compile and tests cover terminal states.
  - Covers: R3.

- [ ] 14. Define shared asset/file contracts in `shared/assets.ts`.
  - Verify: tests reject absolute paths and provider temporary URLs in renderer-facing records.
  - Covers: R4, INV-5.

- [ ] 15. Define shared gateway contracts in `shared/gateway.ts`.
  - Verify: golden normalized envelopes for text, asset bytes, remote task, and provider errors.
  - Covers: R5, INV-3.

- [ ] 16. Split or replace `shared/tools-agents.ts` into focused contracts.
  - Target files: `shared/tools.ts`, `shared/agents.ts`, `shared/skills.ts`, `shared/knowledge.ts`.
  - Verify: no duplicate type definitions remain for the same concept.
  - Covers: R6, R7, R8, R9.

- [ ] 17. Extend `shared/ipc.ts` with domain/action channel schemas.
  - Domains: `job`, `asset`, `gateway`, `tool`, `agent`, `skill`, `knowledge`, `canvas`.
  - Verify: contract tests compare schemas with IPC handler registration.
  - Covers: R1, R10.

## Phase D - Persistence And Repository Design

- [ ] 18. Draft DB schema for jobs, assets, asset folders, references, gateways, tools, agents, skills, knowledge, context packs, and audits.
  - Verify: schema review maps every table to a requirement in `design.md`.
  - Covers: R3-R10.

- [ ] 19. Define repository ownership boundaries under `desktop/src/main/db/repositories/`.
  - Verify: no service design reaches into raw SQL/Drizzle outside repositories.
  - Covers: R1, R10.

- [ ] 20. Define migration policy.
  - Must state: no runtime auto-migration of production DB without explicit app-controlled migration flow.
  - Verify: migration policy is referenced from DB contract docs.
  - Covers: R10.

## Phase E - Runtime Skeleton Plans

- [ ] 21. Plan JobRuntime implementation.
  - Must include: enqueue ticket, worker lease, startup recovery, terminal event emission, retry eligibility.
  - Verify: planned tests cover INV-1 and INV-2.
  - Covers: R3.

- [ ] 22. Plan AssetService and local file library implementation.
  - Must include: save/import, safe protocol, folder operations, tombstones, reference checks.
  - Verify: planned tests cover traversal rejection and referenced asset deletion.
  - Covers: R4, INV-5.

- [ ] 23. Plan GatewayRegistry implementation.
  - Must include: stub provider, OpenAI-compatible provider, async media provider, hot reload, secret storage.
  - Verify: planned tests cover unsupported capability preflight and normalization golden cases.
  - Covers: R5, INV-3.

- [ ] 24. Plan ToolRuntime and PluginLoader implementation.
  - Must include: built-in tools, plugin manifest validation, permissions, concurrency, quarantine.
  - Verify: planned tests cover plugin disable/unload and schema failure.
  - Covers: R6, INV-4, INV-7.

- [ ] 25. Plan AgentRuntime and AgentRegistry implementation.
  - Must include: built-in agents, custom agents, Context Pack, sub-agent permission intersection, trace metadata.
  - Verify: planned tests cover child permission monotonicity.
  - Covers: R7, INV-4.

- [ ] 26. Plan SkillRegistry implementation.
  - Must include: discovery, metadata-first loading, lazy references, permission checks, hot reload.
  - Verify: planned tests cover failed reload keeping previous valid version.
  - Covers: R8, INV-7.

- [ ] 27. Plan KnowledgeStore and ContextBuilder implementation.
  - Must include: ingest, chunking, retrieval, deletion, rebuild, citation metadata, deterministic budget priority.
  - Verify: planned tests cover scope isolation and deletion exclusion.
  - Covers: R9, INV-6.

## Phase F - Product Surface Readiness

- [ ] 28. Define settings/admin UI requirements for gateways, tools, plugins, agents, skills, knowledge, and local file library.
  - Verify: each settings surface maps to an API contract and permission model.
  - Covers: R4-R10.

- [ ] 29. Define initial built-in tool list.
  - Must include: canvas graph tools, node run tools, asset/file tools, gateway test tools, knowledge retrieval tools.
  - Verify: every built-in tool has owner, schema, permission, and concurrency class.
  - Covers: R6, R7, R9.

- [ ] 30. Define initial built-in skill list.
  - Must include comic-drama workflow skills such as script breakdown, storyboard planning, character consistency, image prompt refinement, and video shot planning.
  - Verify: every skill has allowed tools, expected inputs, outputs, and trace metadata.
  - Covers: R8.

- [ ] 31. Define default agent lineup and handoff rules.
  - Must include orchestrator, canvas, tooling, PM; may reserve storyboard/voice/ops for later.
  - Verify: allowed tools/skills and context policies are explicit for each built-in agent.
  - Covers: R7.

## Phase G - Verification Gates Before Implementation

- [ ] 32. Run placeholder scan.
  - Command: search `specs`, `docs/api-contracts`, `.agents`, `.codex`, and `AGENTS.md` for unresolved placeholders and canonical spec links under tool-specific directories.
  - Expected: no unresolved placeholders in foundation contracts; no canonical spec links under tool directories.
  - Covers: R1.

- [ ] 33. Run no-demo acceptance review.
  - Check: every module has contract, owner, data model, failure behavior, test strategy, and recovery/security note.
  - Verify: review notes added to `docs/progress/`.
  - Covers: R1-R10.

- [ ] 34. Only after tasks 1-33 are accepted, open implementation plans for M1/M2.
  - Verify: M1 implementation references root specs and contract docs.
  - Covers: all requirements.
