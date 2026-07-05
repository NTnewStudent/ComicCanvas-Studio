# CI/CD

ComicCanvas Studio 从首个推送版本开始就使用仓库级、由 Bun 驱动的 CI/CD 门禁。
当前产品仍处于 M0 基础阶段，因此第一条流水线只校验契约、测试、仓库卫生和一次
release 演练，尚不产出 Electron 安装包。

## 本地门禁

推送前在本地运行相同的检查：

```bash
bun install --frozen-lockfile
bun run ci
```

`bun run ci` 会依次执行：

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run verify:repo`

## GitHub Actions

| Workflow | 触发条件 | 用途 |
| :--- | :--- | :--- |
| `.github/workflows/ci.yml` | 针对 `main` 的 Pull request 和 push | 从 `.bun-version` 安装 Bun，并在 Ubuntu 和 Windows 上校验。 |
| `.github/workflows/release.yml` | 匹配 `v*.*.*` 的 tag | 运行完整门禁并上传一份 release 演练清单。 |

## 仓库卫生

CI 门禁刻意将本地参考仓库排除在版本控制之外：

- `hjwall/`
- `cc-haha-main/`
- `coze-studio-main/`
- `tmp/`

同时也会拒绝被追踪的 `.claude/specs/` 文件，因为规范的项目 spec 根目录是
`specs/`。

本仓库只以 `bun.lock` 作为依赖锁文件。`package-lock.json` 和
`.npmrc` 不得被追踪。

## 下一个 CD 里程碑

在 M1 创建出真正的 Electron 桌面骨架之后，release workflow 必须新增：

- 面向 Windows 的 Electron 打包。
- 签名安装包策略。
- 版本号与 changelog 校验。
- 升级与回滚说明。
- 产物保留策略。
