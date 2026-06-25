---
name: skill-creator
description: "Create a new repository-scoped skill for ComicCanvas under .agents/skills or .qoder/skills with a valid SKILL.md, concise trigger description, and optional assets."
---

# comiccanvas-skill-creator

Use this skill when creating a new reusable workflow skill for this repository.

## Location

Create repository skills under:

`.agents/skills/<skill-name>/SKILL.md` (Codex/agents standard)
`.qoder/skills/<skill-name>/SKILL.md` (Qoder IDE standard)

Use optional sibling directories such as `assets/`, `references/`, or `scripts/`
only when the workflow needs them.

## Frontmatter

Every `SKILL.md` must start with:

```yaml
---
name: <kebab-case-name>
description: <clear trigger scope; when the agent should and should not use it>
---
```

Keep the description concise and front-load trigger words. Agents use this text
for implicit skill matching.

## Body Structure

1. Title and one-sentence purpose.
2. When to use.
3. Inputs expected from the user or codebase.
4. Steps to follow.
5. Required outputs.
6. ComicCanvas-specific constraints, especially:
   - asynchronous generation through jobs,
   - `shared/connection-matrix.ts` as the connection source of truth,
   - pure declarative CanvasPlan output,
   - `docs/api-contracts/` before new IPC/service surfaces.

## Maintenance

- Keep each skill focused on one job.
- Prefer instructions over scripts unless deterministic tooling is needed.
- If the skill replaces or supersedes another skill, update both discovery docs
  or explicitly document which is the canonical version.
