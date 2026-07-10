ALTER TABLE agent_runs ADD COLUMN thread_id TEXT NOT NULL DEFAULT 'default-thread';
ALTER TABLE agent_runs ADD COLUMN workflow_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE agent_runs ADD COLUMN trigger TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE agent_runs ADD COLUMN message_id TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_runs ADD COLUMN policy_profile_id TEXT NOT NULL DEFAULT 'local-default';
ALTER TABLE agent_runs ADD COLUMN gateway_id TEXT;
ALTER TABLE agent_runs ADD COLUMN model_id TEXT;
ALTER TABLE agent_runs ADD COLUMN paused_state_json TEXT;
ALTER TABLE agent_runs ADD COLUMN usage_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE agent_runs ADD COLUMN last_checkpoint TEXT;

CREATE TABLE IF NOT EXISTS agent_run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(run_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run_sequence
ON agent_run_events(run_id, sequence);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_artifacts_run
ON agent_artifacts(run_id, created_at);

CREATE TABLE IF NOT EXISTS agent_permission_grants (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  workflow_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  permission_json TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER,
  approved_by_label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_permission_grants_lookup
ON agent_permission_grants(workflow_id, tool_id, scope, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS child_agent_tasks (
  id TEXT PRIMARY KEY,
  parent_run_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  input_summary TEXT NOT NULL,
  effective_tools_json TEXT NOT NULL,
  status TEXT NOT NULL,
  output_summary TEXT,
  artifact_ids_json TEXT NOT NULL,
  error_class TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_child_agent_tasks_parent
ON child_agent_tasks(parent_run_id, created_at);
