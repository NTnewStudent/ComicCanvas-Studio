# ltm/ — Local Long-Term Memory

Project-local memory，沿用 hjwall 的 ltm-power 模式。

## Commit policy: repo-portable tooling, local-private memory

**Commit:** `ltm/bin/ltm.py`, `ltm/config.json`, `ltm/manifest.json`, this README.
**Do NOT commit:** `ltm/store/`, `ltm/runtime/`, `ltm/reports/`, `ltm/snapshots/`（已在 `.gitignore` 的 ltm-power 块中忽略）。

## 初始化（重要）

本目录的 `ltm/bin/ltm.py` 工具脚本尚未生成（`manifest.json` 中 `ltm_py_hash: "pending-init"`）。初始化方式二选一：
1. 用 ltm-power 重新 init 本工作区（推荐）。
2. 从 `../hjwall/ltm/bin/ltm.py` 拷贝，然后运行 `python3 ltm/bin/ltm.py selftest` 校验。

## Commands

Read `python_cmd` from `ltm/config.json`（Windows 可能是 `python` / `py`）。

- `python3 ltm/bin/ltm.py files --limit 10`
- `python3 ltm/bin/ltm.py health`
- `python3 ltm/bin/ltm.py checkpoint --summary "..."`
- `python3 ltm/bin/ltm.py validate`
- `python3 ltm/bin/ltm.py repair`
- `python3 ltm/bin/ltm.py purge-last --confirm`
- `python3 ltm/bin/ltm.py purge-all --confirm`
- `python3 ltm/bin/ltm.py teardown --confirm`

操作语义：先用 `health` / `files` 了解状态；重要节点用 `checkpoint` 记录；发现损坏先 `validate` 再 `repair`；清理类命令必须显式带 `--confirm`。记录格式以 `ltm/config.json`、`ltm/manifest.json` 与工具脚本输出为准。
