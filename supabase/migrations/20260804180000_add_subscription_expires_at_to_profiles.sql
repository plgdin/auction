-- Migration: Add subscription_expires_at to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
