-- Create site_content table for email footer settings and other site content
-- Run this SQL script directly in your PostgreSQL database

CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255),
  CONSTRAINT site_content_key_unique UNIQUE (key)
);

-- Create index on updated_at for faster queries
CREATE INDEX IF NOT EXISTS site_content_updated_at_idx ON site_content(updated_at);

-- Verify table was created
SELECT 'site_content table created successfully' AS status;

