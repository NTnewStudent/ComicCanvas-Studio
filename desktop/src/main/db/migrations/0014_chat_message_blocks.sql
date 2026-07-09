-- Persist assistant chat turns as shared chat-block JSON for session restore.
ALTER TABLE chat_messages ADD COLUMN blocks_json TEXT;
