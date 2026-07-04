CREATE TABLE IF NOT EXISTS storage_configs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  region TEXT,
  bucket TEXT NOT NULL,
  access_key_id TEXT NOT NULL,
  key_ref TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  public_url_prefix TEXT,
  updated_at INTEGER NOT NULL
);
