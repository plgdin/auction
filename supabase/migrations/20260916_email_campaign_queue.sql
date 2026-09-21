-- =============================================================================
-- Migration: Email Campaign Queue & Suppression System
-- Creates tables for managing bulk email campaigns, queueing, and unsubscribes
-- =============================================================================

-- 1. Unsubscribes / Suppressions table
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'user_opt_out',
  unsubscribed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON public.email_unsubscribes(lower(email));

-- 2. Email Campaign Queue table
CREATE TABLE IF NOT EXISTS public.email_campaign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL DEFAULT 'rubber_exporters_intro',
  recipient_email TEXT NOT NULL,
  company_name TEXT,
  category TEXT,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sending', 'sent', 'delivered', 'failed', 'unsubscribed', 'bounced', 'complained'
  resend_id TEXT,
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT unique_campaign_recipient UNIQUE (campaign_name, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_queue_status ON public.email_campaign_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_campaign_queue_email ON public.email_campaign_queue(lower(recipient_email));

-- Enable RLS
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on email_unsubscribes" ON public.email_unsubscribes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on email_campaign_queue" ON public.email_campaign_queue
  FOR ALL USING (auth.role() = 'service_role');
