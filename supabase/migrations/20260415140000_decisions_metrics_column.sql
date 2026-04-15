-- Add structured metrics array to decisions table
-- Format: [{key, value, context, trend}] — rendered as metric pills in the feed
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '[]';
