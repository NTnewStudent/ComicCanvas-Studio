# CI/CD

ComicCanvas Studio uses a repository-level Bun-powered CI/CD gate from the first pushed version.
The current product is still in the M0 foundation phase, so the first pipeline validates
contracts, tests, repository hygiene, and a release dry-run instead of producing Electron
installers.

## Local Gate

Run the same checks locally before pushing:

```bash
bun install --frozen-lockfile
bun run ci
```

`bun run ci` executes:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run verify:repo`

## GitHub Actions

| Workflow | Trigger | Purpose |
| :--- | :--- | :--- |
| `.github/workflows/ci.yml` | Pull requests and pushes to `main` | Install Bun from `.bun-version` and validate on Ubuntu and Windows. |
| `.github/workflows/release.yml` | Tags matching `v*.*.*` | Run the full gate and upload a release dry-run manifest. |

## Repository Hygiene

The CI gate intentionally excludes local reference repositories from source control:

- `hjwall/`
- `cc-haha-main/`
- `coze-studio-main/`
- `tmp/`

It also rejects tracked `.claude/specs/` files because the canonical project spec root is
`specs/`.

The repository uses `bun.lock` as its only dependency lockfile. `package-lock.json` and
`.npmrc` must not be tracked.

## Next CD Milestone

After M1 creates the real Electron desktop skeleton, the release workflow must add:

- Electron packaging for Windows.
- Signed installer strategy.
- Version and changelog validation.
- Upgrade and rollback notes.
- Artifact retention policy.
