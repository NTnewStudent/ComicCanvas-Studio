ALTER TABLE workflows ADD COLUMN scope TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE workflows ADD COLUMN published INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_workflows_scope_published ON workflows(scope, published, deleted_at);
