CREATE TABLE IF NOT EXISTS local_memories (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  user_id TEXT,
  workflow_id TEXT,
  agent_role_id TEXT,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_memories_scope
ON local_memories(scope, user_id, workflow_id, agent_role_id, updated_at);
