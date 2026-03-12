-- Add brand_kit JSONB column to personas table
ALTER TABLE personas ADD COLUMN IF NOT EXISTS brand_kit JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN personas.brand_kit IS 'Brand kit data: { logo_url, primary_color, secondary_color, font_name, brand_name, uploaded_at }';
