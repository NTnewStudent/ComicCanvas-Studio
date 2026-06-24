CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  target_id TEXT,
  payload_json TEXT NOT NULL,
  result_json TEXT,
  error_class TEXT,
  error_message TEXT,
  retryable INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  media_type TEXT NOT NULL,
  status TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  safe_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  orientation TEXT,
  mime_type TEXT,
  hash TEXT,
  folder_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS asset_folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS asset_references (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  ref_type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  workflow_id TEXT,
  agent_run_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  plan_json TEXT,
  apply_status TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gateway_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  key_ref TEXT,
  capabilities_json TEXT NOT NULL,
  model_map_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  permission_json TEXT NOT NULL,
  concurrency TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_audit (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  target_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  job_id TEXT,
  status TEXT NOT NULL,
  context_pack_id TEXT,
  trace_json TEXT NOT NULL,
  error_class TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  entry TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_invocations (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  loaded_refs_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  text TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  embedding_ref TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS context_packs (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT,
  summary_json TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  redactions_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
