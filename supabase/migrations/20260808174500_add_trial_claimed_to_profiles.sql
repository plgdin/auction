-- Add trial_claimed column to profiles to prevent duplicate trial claims
ALTER TABLE public.profiles ADD COLUMN trial_claimed BOOLEAN DEFAULT false;
