CREATE TABLE IF NOT EXISTS canvas_snippets (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  name TEXT NOT NULL,
  nodes_json TEXT NOT NULL,
  edges_json TEXT NOT NULL,
  node_count INTEGER NOT NULL,
  edge_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_canvas_snippets_active_updated
  ON canvas_snippets (deleted_at, updated_at DESC, created_at DESC);
