-- Migration: Add subscription_plan to profiles table
-- Establishes the database support for tracking and gating user plans (explorer, pro, enterprise)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'explorer';

-- Validate default values for existing users
UPDATE public.profiles
SET subscription_plan = 'explorer'
WHERE subscription_plan IS NULL;
