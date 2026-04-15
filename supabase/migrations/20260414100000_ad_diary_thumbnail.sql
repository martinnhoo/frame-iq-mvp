-- Add thumbnail_url column to ad_diary for ad creative previews
ALTER TABLE ad_diary ADD COLUMN IF NOT EXISTS thumbnail_url text;
