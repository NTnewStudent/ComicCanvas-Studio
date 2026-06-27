CREATE TABLE IF NOT EXISTS style_presets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  prompt_before TEXT,
  prompt_after TEXT,
  legacy_prompt_preset TEXT,
  negative_prompt TEXT,
  cover_asset_id TEXT,
  tags_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

ALTER TABLE workflows ADD COLUMN default_style_preset_id TEXT;
