ALTER TABLE canvas_snippets ADD COLUMN description TEXT;
ALTER TABLE canvas_snippets ADD COLUMN scope TEXT NOT NULL DEFAULT 'my';
ALTER TABLE canvas_snippets ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'user-local';
ALTER TABLE canvas_snippets ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE canvas_snippets ADD COLUMN thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_canvas_snippets_scope_updated
  ON canvas_snippets (deleted_at, scope, updated_at DESC, created_at DESC);
