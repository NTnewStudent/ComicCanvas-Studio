# LTM Checkpoint

保存当前工作检查点到项目长期记忆。

## 步骤

1. 回顾当前会话中完成的工作。
2. 准备 checkpoint JSON：
   ```json
   {
     "summary": "本次工作摘要",
     "changed_files": ["file1.ts", "file2.ts"],
     "decisions": [
       {"decision": "决策内容", "rationale": "决策原因"}
     ],
     "open_threads": ["待解决事项"],
     "next_actions": ["下一步行动"]
   }
   ```
3. 写入临时文件后运行：
   ```bash
   python ltm/bin/ltm.py checkpoint --from-json <temp_path>
   ```
4. 运行 `python ltm/bin/ltm.py regenerate` 更新运行时上下文。

## 何时使用

- 完成一个有意义的工作阶段时
- 做出了重要架构决策时
- 工作被中断需要稍后恢复时
- 解决了困难问题后记录解法时

## 注意

- Windows 上 python_cmd 可能是 `python` 或 `py`，查看 `ltm/config.json` 确认。
- 密钥和敏感信息不写入 LTM（自动红化规则见 ltm-memory-format.md）。
