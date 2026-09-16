-- =============================================================================
-- Migration: WhatsApp Automation Schema
-- 1. Extend user_notification_preferences with WhatsApp notification controls
-- 2. Create whatsapp_messages audit & interaction log table
-- =============================================================================

-- 1. Extend user_notification_preferences with WhatsApp flags
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS whatsapp_bids BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_reminders BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_marketing BOOLEAN DEFAULT false;

-- 2. Create whatsapp_messages audit and conversation history table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    phone VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    type VARCHAR(50) NOT NULL, -- 'template', 'text', 'interactive', 'notification'
    template_name VARCHAR(100),
    content TEXT,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    whatsapp_message_id VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid lookup by phone, user, and status
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_created ON whatsapp_messages(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wam_id ON whatsapp_messages(whatsapp_message_id);

-- Enable RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own logged WhatsApp messages
CREATE POLICY "Users can view own whatsapp messages"
    ON whatsapp_messages FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role has full access (for background functions/triggers)
CREATE POLICY "Service role full access on whatsapp_messages"
    ON whatsapp_messages FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
