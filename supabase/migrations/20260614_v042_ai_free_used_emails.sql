-- Tracks emails that have consumed their one free AI credit.
-- Keyed by email so re-registration with the same address cannot bypass the limit.
CREATE TABLE IF NOT EXISTS ai_free_used_emails (
  email        TEXT        PRIMARY KEY,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_free_used_emails ENABLE ROW LEVEL SECURITY;
-- Only the service role (admin client) touches this table.
