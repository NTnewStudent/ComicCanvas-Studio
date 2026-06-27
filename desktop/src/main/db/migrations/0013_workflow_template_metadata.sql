ALTER TABLE workflows ADD COLUMN description TEXT;
ALTER TABLE workflows ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE workflows ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'user-local';
ALTER TABLE workflows ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE workflows ADD COLUMN thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_workflows_template_visibility
  ON workflows (deleted_at, scope, visibility, published, updated_at DESC);
