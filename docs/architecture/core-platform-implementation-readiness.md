# Core Platform Implementation Readiness

This document closes the remaining M0 foundation planning tasks before M1 implementation starts. It turns the foundation design into concrete implementation contracts for persistence, repositories, runtime skeletons, product surfaces, built-ins, and handoff rules.

## DB Schema Draft

The M1 SQLite/Drizzle schema SHALL start with these tables. All IDs are stable string IDs generated in the main process. All JSON columns are validated at repository boundaries before write and after read.

| Table | Required columns | Owner | Contract |
| :--- | :--- | :--- | :--- |
| `jobs` | `id`, `type`, `status`, `target_id`, `payload_json`, `result_json`, `error_class`, `error_message`, `retryable`, `lease_owner`, `attempts`, `progress`, `created_at`, `updated_at` | tooling-agent | `docs/api-contracts/jobs.md` |
| `assets` | `id`, `media_type`, `status`, `rel_path`, `safe_url`, `width`, `height`, `duration_ms`, `orientation`, `mime_type`, `hash`, `folder_id`, `created_at`, `updated_at`, `deleted_at` | tooling-agent | `docs/api-contracts/assets-files.md` |
| `asset_folders` | `id`, `parent_id`, `name`, `type`, `rel_path`, `sort_order`, `created_at`, `updated_at`, `deleted_at` | tooling-agent | `docs/api-contracts/assets-files.md` |
| `asset_references` | `id`, `asset_id`, `ref_type`, `ref_id`, `created_at` | tooling-agent | `docs/api-contracts/assets-files.md` |
| `workflows` | `id`, `name`, `created_at`, `updated_at`, `deleted_at` | canvas-agent | `docs/api-contracts/canvas-plan.md` |
| `workflow_versions` | `id`, `workflow_id`, `graph_json`, `created_at`, `created_by` | canvas-agent | `docs/api-contracts/canvas-plan.md` |
| `chat_messages` | `id`, `workflow_id`, `agent_run_id`, `role`, `content`, `plan_json`, `apply_status`, `created_at` | orchestrator-agent | `docs/api-contracts/agents.md` |
| `gateway_configs` | `id`, `name`, `type`, `base_url`, `key_ref`, `capabilities_json`, `model_map_json`, `enabled`, `created_at`, `updated_at` | tooling-agent | `docs/api-contracts/gateway-providers.md` |
| `tools` | `id`, `owner_kind`, `owner_id`, `name`, `schema_json`, `permission_json`, `concurrency`, `enabled`, `created_at`, `updated_at` | tooling-agent | `docs/api-contracts/tools-plugins.md` |
| `tool_audit` | `id`, `trace_id`, `tool_id`, `actor_type`, `actor_id`, `capability`, `target_json`, `decision`, `reason`, `created_at` | tooling-agent | `docs/api-contracts/audit-observability.md` |
| `agents` | `id`, `source`, `name`, `description`, `instructions`, `policy_json`, `enabled`, `created_at`, `updated_at` | orchestrator-agent | `docs/api-contracts/agents.md` |
| `agent_runs` | `id`, `agent_id`, `job_id`, `status`, `context_pack_id`, `trace_json`, `error_class`, `created_at`, `updated_at` | orchestrator-agent | `docs/api-contracts/agents.md` |
| `skills` | `id`, `source`, `version`, `name`, `entry`, `metadata_json`, `enabled`, `created_at`, `updated_at` | orchestrator-agent | `docs/api-contracts/skills.md` |
| `skill_invocations` | `id`, `skill_id`, `version`, `agent_run_id`, `loaded_refs_json`, `status`, `created_at` | orchestrator-agent | `docs/api-contracts/skills.md` |
| `knowledge_documents` | `id`, `source_type`, `source_ref`, `scope_json`, `status`, `metadata_json`, `created_at`, `updated_at`, `deleted_at` | tooling-agent | `docs/api-contracts/knowledge-context.md` |
| `knowledge_chunks` | `id`, `document_id`, `ordinal`, `text`, `metadata_json`, `embedding_ref`, `created_at` | tooling-agent | `docs/api-contracts/knowledge-context.md` |
| `context_packs` | `id`, `agent_run_id`, `summary_json`, `source_refs_json`, `redactions_json`, `created_at` | orchestrator-agent | `docs/api-contracts/knowledge-context.md` |

Schema rules:

- Renderer-facing queries SHALL never return `rel_path` as an absolute path.
- Secrets SHALL be stored as `key_ref` values that resolve through the key vault, not JSON plaintext.
- Terminal job states SHALL be immutable except idempotent repair metadata.
- Every table with user-visible deletion SHALL use `deleted_at` or a tombstone state unless the contract explicitly allows hard delete.

## Repository Ownership Boundaries

All raw Drizzle/SQL access belongs under `desktop/src/main/db/repositories/`. Service, IPC, worker, and agent modules SHALL call repositories, not query tables directly.

| Repository | Tables | Public responsibility |
| :--- | :--- | :--- |
| `job.repo.ts` | `jobs` | create ticket, lease work, transition state, list/query, recovery update |
| `asset.repo.ts` | `assets`, `asset_references` | create asset, update metadata, record references, tombstone checks |
| `asset-folder.repo.ts` | `asset_folders` | folder CRUD, move tree, trash folder metadata |
| `workflow.repo.ts` | `workflows`, `workflow_versions` | save/load graph versions and graph metadata |
| `chat-message.repo.ts` | `chat_messages` | persist chat, plans, apply state |
| `gateway.repo.ts` | `gateway_configs` | provider config CRUD without plaintext secrets |
| `tool.repo.ts` | `tools`, `tool_audit` | registry snapshot, enable/disable, audit decisions |
| `agent.repo.ts` | `agents`, `agent_runs` | built-in mirror, user agent CRUD, run traces |
| `skill.repo.ts` | `skills`, `skill_invocations` | skill metadata snapshot and invocation trace |
| `knowledge.repo.ts` | `knowledge_documents`, `knowledge_chunks`, `context_packs` | ingest records, chunks, retrieval metadata, context pack traces |

Boundary checks:

- `desktop/src/main/ipc/**` SHALL contain validation and handler orchestration only.
- `desktop/src/main/jobs/**` SHALL use `job.repo.ts` for durable state.
- `desktop/src/main/providers/**` SHALL not import DB tables.
- `desktop/src/renderer/**` SHALL not import repositories or main-process modules.

## Migration Policy

Migrations are app-controlled and versioned.

- M1 SHALL add an initial Drizzle migration for the schema above.
- App startup SHALL check the DB schema version before service startup.
- Production user DBs SHALL NOT be auto-mutated by ad hoc runtime SQL.
- Failed migration SHALL stop service startup with a safe error and recovery instructions.
- Migration tests SHALL run against a temporary SQLite database.
- Any migration that changes persisted JSON shape SHALL include a compatibility note in the related contract doc.

## Runtime Skeleton Plans

### JobRuntime

Implementation files:

- `desktop/src/main/jobs/queue.ts`
- `desktop/src/main/jobs/worker.ts`
- `desktop/src/main/jobs/recovery.ts`
- `desktop/src/main/jobs/events.ts`

Required behavior:

- `enqueue` writes a `pending` row and returns `JobTicket`.
- Worker claims jobs through a lease before moving to `processing`.
- Terminal result/error is persisted before event emission.
- Startup recovery requeues stale `processing` rows or fails them with `job_worker_interrupted`.
- Tests cover terminal uniqueness and no synchronous asset return.

### AssetService And Local File Library

Implementation files:

- `desktop/src/main/assets/pipeline.ts`
- `desktop/src/main/assets/protocol.ts`
- `desktop/src/main/assets/library.ts`

Required behavior:

- Save generated bytes under app-controlled storage.
- Classify metadata and orientation before marking `ready`.
- Resolve renderer media through a safe protocol.
- Reject traversal and never expose absolute paths.
- Enforce reference checks for trash/tombstone operations.

### GatewayRegistry

Implementation files:

- `desktop/src/main/providers/registry.ts`
- `desktop/src/main/providers/stub.provider.ts`
- `desktop/src/main/providers/openai-compatible.provider.ts`
- `desktop/src/main/providers/async-media.provider.ts`
- `desktop/src/main/security/key-vault.ts`

Required behavior:

- M1 provides deterministic `stub`.
- M3 adds OpenAI-compatible and async media adapters.
- Provider config hot reload affects future jobs only.
- Unsupported capability fails before remote submission.
- Secrets are encrypted and redacted.

### ToolRuntime And PluginLoader

Implementation files:

- `desktop/src/main/tools/runtime.ts`
- `desktop/src/main/tools/registry.ts`
- `desktop/src/main/tools/plugin-loader.ts`
- `desktop/src/main/tools/canvas/*.ts`

Required behavior:

- Validate tool schema and permissions before registration.
- Built-in and plugin tools share one invocation path.
- Read-only tools may run concurrently; writes are serialized or exclusive.
- Invalid plugins are quarantined with diagnostics.

### AgentRuntime And AgentRegistry

Implementation files:

- `desktop/src/main/agent/runtime.ts`
- `desktop/src/main/agent/registry.ts`
- `desktop/src/main/agent/orchestrator.ts`
- `desktop/src/main/agent/spawn-sub-agent.ts`
- `desktop/src/main/agent/sanitize-plan.ts`

Required behavior:

- Built-in and user agents load into one registry.
- Agent runs are durable jobs.
- Context Packs are built before model/tool use.
- CanvasPlan output is sanitized before apply.
- Sub-agent permissions are parent-policy intersections.

### SkillRegistry

Implementation files:

- `desktop/src/main/skills/registry.ts`
- `desktop/src/main/skills/loader.ts`

Required behavior:

- Discover built-in, user, and plugin skills from documented roots.
- Expose metadata first and lazily load references.
- Fail invocation when required permissions exceed agent policy.
- Failed reload keeps the previous valid snapshot.

### KnowledgeStore And ContextBuilder

Implementation files:

- `desktop/src/main/knowledge/store.ts`
- `desktop/src/main/knowledge/retriever.ts`
- `desktop/src/main/knowledge/context-builder.ts`

Required behavior:

- Ingest local files, documents, notes, and asset metadata.
- Chunk and index through lexical retrieval first, with embedding support behind an interface.
- Retrieval respects project/workspace/user-approved scope.
- Deleted or removed sources are excluded after delete/rebuild.
- Context Pack sources include citation metadata.

## Settings And Admin Surfaces

M3-M5 renderer settings SHALL expose these surfaces through domain APIs, not generic `settings.*` IPC:

| Surface | API contract | Required controls |
| :--- | :--- | :--- |
| Gateways | `docs/api-contracts/gateway-providers.md` | list, add, edit, enable/disable, test, delete, model map, masked key |
| Tools | `docs/api-contracts/tools-plugins.md` | list, owner badges, permission badges, enable/disable, diagnostics |
| Plugins | `docs/api-contracts/tools-plugins.md` | local manifest load, disable/unload, quarantine details |
| Agents | `docs/api-contracts/agents.md` | built-in read-only list, custom create/edit/delete, tool/skill policy |
| Skills | `docs/api-contracts/skills.md` | list, metadata view, reload, enable/disable if supported |
| Knowledge | `docs/api-contracts/knowledge-context.md` | ingest, retrieve preview, delete, rebuild, scope/citation inspection |
| Asset Library | `docs/api-contracts/assets-files.md` | folders, moves, trash/tombstone, reference warnings |
| Health And Audit | `docs/api-contracts/audit-observability.md` | health checks, audit filters, safe debug export |

## Initial Built-In Tools

| Tool ID | Category | Permission | Concurrency | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `canvas.queryGraph` | canvas | `canvas.read` | readonly | Return graph snapshot. |
| `canvas.proposePlan` | canvas | `canvas.read` | readonly | Produce draft CanvasPlan without mutation. |
| `canvas.createNode` | canvas | `canvas.write` | serial-write | Add a text/image/video node. |
| `canvas.connectNodes` | canvas | `canvas.write` | serial-write | Add validated edge through connection matrix. |
| `canvas.updateNodeData` | canvas | `canvas.write` | serial-write | Update node data and label. |
| `canvas.deleteNode` | canvas | `destructive` | exclusive | Delete node after confirmation policy. |
| `canvas.runNode` | canvas | `provider.spend` | serial-write | Enqueue generation job. |
| `asset.import` | asset | `file.read` | serial-write | Import user-approved file. |
| `asset.move` | asset | `canvas.write` | serial-write | Move asset between folders. |
| `asset.trash` | asset | `destructive` | exclusive | Trash/tombstone with reference checks. |
| `gateway.test` | gateway | `network` | serial-write | Enqueue provider test job. |
| `knowledge.retrieve` | knowledge | `canvas.read` | readonly | Retrieve scoped knowledge chunks. |
| `knowledge.ingest` | knowledge | `file.read` | serial-write | Ingest user-approved source. |

## Initial Built-In Skills

| Skill ID | Required tools | Output |
| :--- | :--- | :--- |
| `comic.script-breakdown` | `knowledge.retrieve`, `canvas.proposePlan` | Scene beats and node plan hints. |
| `comic.storyboard-planning` | `canvas.queryGraph`, `canvas.proposePlan` | Shot list and graph layout proposal. |
| `comic.character-consistency` | `knowledge.retrieve`, `asset.import` | Character reference pack and prompt constraints. |
| `comic.image-prompt-refinement` | `canvas.queryGraph`, `canvas.updateNodeData` | Refined image prompts with style/character continuity. |
| `comic.video-shot-planning` | `canvas.queryGraph`, `canvas.proposePlan` | Video run steps and frame reference strategy. |

Each skill SHALL define metadata, expected inputs, outputs, trace fields, required tools, and permission needs before runtime implementation.

## Default Agent Lineup And Handoff Rules

| Agent | Purpose | Default tools | Default skills | Handoff rules |
| :--- | :--- | :--- | :--- | :--- |
| `orchestrator-agent` | Analyze user requests and produce sanitized CanvasPlan workflows. | `canvas.queryGraph`, `canvas.proposePlan`, `knowledge.retrieve` | script breakdown, storyboard planning | Handoff to canvas-agent for graph mutation details; tooling-agent for runtime/provider questions. |
| `canvas-agent` | Own canvas graph operations, node configuration, layout, and Plan application. | canvas tools except destructive actions by default | image prompt refinement, video shot planning | Handoff to tooling-agent for jobs/assets/provider failures. |
| `tooling-agent` | Own DB, jobs, assets, gateways, tools, plugins, and IPC implementation. | asset, gateway, job, tool, knowledge tools | none by default | Handoff to pm-agent when a contract is missing or ambiguous. |
| `pm-agent` | Own requirements, API contracts, backlog, progress, and verification reports. | read-only diagnostics and contract tools | none by default | Handoff implementation to tooling/canvas/orchestrator after contracts are accepted. |
| `super-agent` | Optional power entry after M5 for broad multi-agent tasks. | `*` after explicit policy | all allowed skills | May spawn sub-agents; child permissions are always a subset. |

Rules:

- Built-in agents are read-only in settings until a migration says otherwise.
- Custom agents can be created only with explicit tool, skill, gateway, context, and permission policies.
- Handoffs are traceable agent events and do not bypass ToolRuntime.
