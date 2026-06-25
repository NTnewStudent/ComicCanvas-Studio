---
inclusion: fileMatch
fileMatchPattern: "ltm/**"
---

## LTM 记录格式

### events.jsonl
每行：`{"id": "evt_NNNNNN", "ts": "ISO-8601", "type": "file_write|checkpoint|manual_note", "summary": "", "files_changed_count": N, "files_sample": ["path", ...], "branch": "string", "session_id": "sess_...", "source": "hook:agentStop|agent:checkpoint|user:manual", "git_status": "ok|unavailable|not_repo|timeout|error", "tags": [], "redacted": false}`

### checkpoints.jsonl
每行：`{"id": "chk_NNNNNN", "ts": "ISO-8601", "summary": "text", "changed_files": [], "decisions": [{"decision": "text", "rationale": "text"}], "open_threads": ["thread_id"], "next_actions": ["text"], "session_id": "sess_..."}`

### sessions.jsonl
每行：`{"session_id": "sess_...", "started_at": "ISO-8601", "ended_at": "ISO-8601", "summary": "text", "recent_files": [], "checkpoints_created": [], "unresolved_items": [], "next_recommended_action": "text"}`

### open_threads.jsonl
每行：`{"thread_id": "thread_NNNNNN", "ts_opened": "ISO-8601", "summary": "text", "status": "open|resolved", "linked_files": [], "last_touched": "ISO-8601"}`

### 密钥红化规则
检测模式：`sk_live_`, `sk_test_`, `AKIA`, `ghp_`, `gho_`, `-----BEGIN`, `Bearer`, 40+ 字符 base64 字符串。统一替换为 `[REDACTED]`。
