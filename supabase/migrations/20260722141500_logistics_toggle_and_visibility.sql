-- 1. Add is_accepting_requests toggle to logistics_profiles
ALTER TABLE public.logistics_profiles
ADD COLUMN IF NOT EXISTS is_accepting_requests BOOLEAN DEFAULT true;

-- 2. Fix bug where normal users couldn't see logistics providers in Quote Builder
-- Normal users need to be able to read the basic profile row of logistics users to know they exist
DROP POLICY IF EXISTS "Logistics users are viewable by everyone" ON public.profiles;

CREATE POLICY "Logistics users are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (role = 'logistics');
