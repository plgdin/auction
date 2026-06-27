-- Add author_name to blogs table
ALTER TABLE public.blogs
ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT 'Admin';
