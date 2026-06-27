# Project Log

This log records human-readable project progress snapshots. Canonical
requirements and task status still live under `specs/`; test evidence still
lives in `docs/progress/test-report.md`.

## 2026-06-27 - Current Progress Snapshot

Scope:

- User requested a progress report before migrating the environment.
- This snapshot is based on `specs/`, `docs/progress/backlog.md`, and
  `docs/progress/test-report.md`.
- The active completion standard is the root-level spec archive, especially
  `specs/hjwall-canvas-full-migration/`.
- Older M2-M5 backlog rows are treated as historical until reverified by the
  new hjwall full-migration evidence gates.

Overall status:

| Area | Status | Notes |
| :--- | :--- | :--- |
| `core-platform-foundation` | Mostly complete | Tasks 1-23 and 28-34 are complete. Tasks 24-27 remain open for ToolRuntime/PluginLoader, AgentRuntime, SkillRegistry, and Knowledge/RAG implementation planning and follow-through. |
| `milestone-execution-plan` | M0-M4 complete, M5 open | Tasks 1-40 are complete. Tasks 41-47 remain open for SkillRegistry, PluginLoader, KnowledgeStore/ContextBuilder, audit/observability, M5 integration, task/spec consistency, and no-demo gate. |
| `canvas-agent-orchestration` | Complete | Tasks 1-22 are complete, covering CanvasPlan, connection matrix, async job skeleton, stub provider path, asset pipeline, React Flow canvas, PlanRunner, and orchestration smoke path. |
| `hjwall-canvas-full-migration` | In progress | 33 tasks total: 2 complete, 14 in progress, 17 not started. This is the current primary industrial-grade migration spec. |
| CI/CD and Bun migration | Complete by backlog status | REQ-058 and REQ-059 are marked complete for GitHub Actions/Bun-based CI/CD foundation and Bun lock/runtime usage. |
| Worktree hygiene | Dirty | Many implementation, spec, test, CI, and lockfile changes are present. Reference projects must remain uncommitted. |

hjwall full-migration status:

| Phase | Tasks | Status | Notes |
| :--- | :--- | :--- | :--- |
| Phase 0 | 1-3 | Not started | Capability inventory, evidence audit, and real desktop launch verification remain open. Real `/projects` and `/canvas` desktop evidence is still a hard gate. |
| Phase 1 | 4 | Not started | Workflow repository and IPC hardening still needs completion. |
| Phase 1 | 5 | In progress | Workflow JSON import/export has IPC, sanitize, invalid JSON, absolute-path rejection, renderer `/projects` controls, and Chinese feedback coverage. Desktop user-flow evidence is pending. |
| Phase 1 | 6 | In progress | Dirty-save switching and `beforeunload` guard have pure logic and CanvasPage wiring coverage. Manual desktop switch, close, and back-navigation evidence is pending. |
| Phase 2 | 7 | Not started | Renderer graph state ownership model still needs design: React Flow local state, Zustand, undo/redo, autosave, and realtime terminal updates. |
| Phase 2 | 8 | In progress | Toolbar, context menu, command palette, shortcuts, fit-view, select/pan mode, and visible copy quality have automated coverage. Desktop keyboard/mouse evidence is pending. |
| Phase 2 | 9 | In progress | Local media drop now covers image/video/audio planning, readable errors, shared audio asset type, audio IPC import, and portable POSIX relative paths. Desktop drag/drop evidence is pending. |
| Phase 2 | 10 | In progress | Snippet extraction/insertion, ID remap, one undo snapshot, SQLite `canvas_snippets`, IPC/preload APIs, and compact CanvasPage selector are covered. Richer UI and desktop cross-project evidence are pending. |
| Phase 2 | 11 | In progress | Direct connection feedback, V2 `@mention` validation, and connect-to-create shared validation are covered. Remaining context-menu paths and desktop invalid-connection feedback evidence are pending. |
| Phase 3 | 12 | In progress | Shared node contracts, connection matrix, graph serializer, Plan whitelist, apply-plan, and orchestration smoke slices exist. Node UI vertical slices, run dispatch, and desktop save/load evidence are pending. |
| Phase 3 | 13-17 | Not started | Existing node stabilization plus character, scene, audio, videoCompose, muxAudioVideo, superResolution, and mjImage vertical slices remain open. |
| Phase 4 | 18-19 | Complete | Shared style contracts, API contract docs, style repository, schema migration, and IPC handlers are complete. |
| Phase 4 | 20-21 | In progress | Deterministic style prompt composition, runtime payloads, style library UI, node selectors, and project selector have test coverage. Desktop generation and cover-display evidence are pending. |
| Phase 5 | 22-24 | Not started | Asset metadata extraction, asset panel workflows, references, tombstone/delete, and insert-to-canvas flows remain major open work. |
| Phase 6 | 25-29 | In progress | Typed migrated run dispatch, one-shot reconciliation, migrated sanitize/apply actions, comic-drama planner, PlanCard migrated summary, and partial PlanRunner mapping are covered. Full desktop ticket/result and autoExecute terminal-state evidence are pending. |
| Phase 7 | 30-33 | Not started | Full comic-drama, asset/snippet, and agent orchestration desktop acceptance scenarios remain open. Progress/test reports must continue to be updated after each completed phase. |

Recent verified slices:

| Slice | Evidence |
| :--- | :--- |
| REQ-092 visible canvas copy quality | Focused visible-copy tests passed; REQ-092 regression group passed 10 files / 31 tests; `bun run typecheck` passed. |
| REQ-092 local media audio drop | Focused local-media and audio tests passed; REQ-092 regression group passed 11 files / 33 tests; `bun run typecheck` passed. |
| REQ-092 audio `asset.import` persistence | `asset-folders-ipc` passed 3/3; asset/local-media/audio focused group passed 3 files / 8 tests; REQ-092 regression group passed 12 files / 36 tests; `bun run typecheck` passed. |

Highest-priority gaps:

| Priority | Gap | Why it matters |
| :--- | :--- | :--- |
| P0 | Real desktop acceptance evidence | Many capabilities have automated coverage but still lack real user-flow evidence on `/projects`, `/canvas`, drag/drop, PlanCard, and autoExecute. |
| P0 | Asset library completion | Metadata, folders, search/filter/sort, references, safe delete, and insert-to-canvas are core to local file management. |
| P0 | Migrated node vertical slices | Character, scene, audio, videoCompose, muxAudioVideo, superResolution, and mjImage must become production nodes, not only shared contracts. |
| P1 | Skill/Plugin/Knowledge/RAG runtime | The extensibility layer for Claude-style agent orchestration remains incomplete in M5. |
| P1 | Agent autoExecute evidence | Planning and partial application exist, but complete serial execution and visible terminal states for migrated run steps still need desktop proof. |
| P1 | Renderer graph state ownership | State ownership must be formalized to avoid save, undo, autosave, and realtime writeback conflicts. |

Next recommended work:

1. Continue `hjwall-canvas-full-migration` rather than treating older backlog
   completion labels as final.
2. Finish the current REQ-092 asset/audio user experience slice, including
   asset-library audio preview and focused test evidence.
3. Restore and capture real desktop evidence after the next stable automated
   checkpoint.
4. Keep reference projects read-only/reference-only and out of commits:
   `hjwall`, `cc-haha-main`, and `coze-studio-main`.
