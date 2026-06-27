ALTER TABLE assets ADD COLUMN display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_search_name
  ON assets(display_name, rel_path);
