ALTER TABLE assets ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS asset_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'image',
  description TEXT,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  built_in INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS asset_category_assignments (
  asset_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (asset_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_category_assignments_category
  ON asset_category_assignments(category_id);

CREATE INDEX IF NOT EXISTS idx_asset_category_assignments_asset
  ON asset_category_assignments(asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_categories_kind_enabled
  ON asset_categories(kind, enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_assets_library_filter_sort
  ON assets(status, deleted_at, media_type, created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_assets_folder_filter_sort
  ON assets(folder_id, status, deleted_at, media_type, created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_asset_references_asset
  ON asset_references(asset_id, created_at, id);
