-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR NEWS_UPDATES
-- ============================================================================

-- Enable RLS on news_updates if not already enabled
ALTER TABLE news_updates ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Access: Anyone can read published news
CREATE POLICY "Public can view published news"
ON news_updates
FOR SELECT
USING (is_published = true);

-- 2. Admin Access: Admins and superadmins can perform all operations (CRUD)
CREATE POLICY "Admins can view all news (including drafts)"
ON news_updates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);

CREATE POLICY "Admins can insert news"
ON news_updates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);

CREATE POLICY "Admins can update news"
ON news_updates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);

CREATE POLICY "Admins can delete news"
ON news_updates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);
