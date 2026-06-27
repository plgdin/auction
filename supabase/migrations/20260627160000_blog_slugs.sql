-- Add slug column to blogs table
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Auto-generate slugs for existing blogs based on their titles and ID prefix to ensure uniqueness
UPDATE blogs 
SET slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(id::text from 1 for 5)
WHERE slug IS NULL;
