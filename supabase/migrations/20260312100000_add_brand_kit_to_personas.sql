-- Add brand_kit JSONB column to personas table
-- Stores brand data without external storage: logo as base64 data URL + colors
ALTER TABLE personas ADD COLUMN IF NOT EXISTS brand_kit JSONB DEFAULT NULL;

COMMENT ON COLUMN personas.brand_kit IS 'Brand kit: { logo_data_url (base64), file_name, primary_color, secondary_color, font_name, brand_name, uploaded_at }';
