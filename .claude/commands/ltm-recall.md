# LTM Recall

恢复工作记忆，回忆此前的决策与进度。

## 步骤

1. 运行 `python ltm/bin/ltm.py files --limit 10` 查看最近变更。
2. 运行 `python ltm/bin/ltm.py sessions --limit 5` 查看最近会话。
3. 读取 `ltm/runtime/active-context.json`（如存在）获取当前上下文。
4. 读取 `ltm/runtime/last-recall.md`（如存在）获取上次回忆摘要。
5. 可选：`git status --short` + `git log --oneline -5` 获取代码状态。
6. 汇总后向用户报告当前项目状态与推荐的下一步。

## 搜索特定记忆

如果用户指定了搜索词，运行：
```bash
python ltm/bin/ltm.py search "<term>"
```

## 注意

- Windows 上 python_cmd 可能是 `python` 或 `py`，查看 `ltm/config.json` 确认。
- last-recall.md 限 400 词，active-context.json 限 8KB。
- 不要把原始 jsonl 文件注入上下文。
