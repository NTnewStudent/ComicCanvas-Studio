---
inclusion: always
description: LTM 项目记忆操作。当用户要求恢复工作、继续上次任务、回忆历史决策或引用项目记忆时激活。
---

## Recall

1. 运行 `python ltm/bin/ltm.py files --limit 10` 和 `python ltm/bin/ltm.py sessions --limit 5`。
2. 针对特定历史工作：`python ltm/bin/ltm.py search "<term>"` 或 `python ltm/bin/ltm.py checkpoints --days 3`。
3. 针对特定会话：`python ltm/bin/ltm.py show <session_id>`。
4. 回退：读取 `ltm/runtime/active-context.json` 与 `ltm/runtime/last-recall.md`。
5. 可选：`git status --short` 和 `git log --oneline -5`。
6. 用回忆结果定向。若回忆结果已足够，不要广泛探索。

## Checkpoints

1. 读取 `ltm/store/events.jsonl` 最后 20 条。
2. 准备 checkpoint JSON，包含 summary、changed_files、decisions、open_threads、next_actions。
3. 运行 `python ltm/bin/ltm.py checkpoint --from-json <path>`。
4. 回退：按 `ltm-memory-format` steering 直写 `ltm/store/checkpoints.jsonl`。
5. 重生成：`python ltm/bin/ltm.py regenerate`。

## 上限

- `last-recall.md`：最多 400 词。
- `active-context.json`：最多 8KB（推荐 2KB）。
- 禁止把原始 ledger 文件注入上下文。

## 维护命令

```bash
python ltm/bin/ltm.py health          # 健康检查
python ltm/bin/ltm.py validate        # 校验
python ltm/bin/ltm.py repair          # 修复
python ltm/bin/ltm.py purge-last --confirm   # 删除最后一条
python ltm/bin/ltm.py purge-all --confirm    # 全清
python ltm/bin/ltm.py teardown --confirm     # 卸载
python ltm/bin/ltm.py selftest        # 自测
```

从 `ltm/config.json` 读取 `python_cmd`。Windows 上 `python_cmd` 可能是 `python` 或 `py`。

> 注意：`ltm/bin/ltm.py` 由 ltm-power 生成。若缺失，使用 ltm-power 重新初始化，或从 `../hjwall/ltm/bin/ltm.py` 拷贝并跑 `selftest` 校验。
