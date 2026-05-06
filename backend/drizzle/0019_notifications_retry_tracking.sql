ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS last_error text;
