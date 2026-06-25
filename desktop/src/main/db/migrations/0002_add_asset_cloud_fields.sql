-- REQ-085: Add cloud storage fields to assets table
ALTER TABLE assets ADD COLUMN url TEXT;
ALTER TABLE assets ADD COLUMN s3_key TEXT;
