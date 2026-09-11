-- ============================================================================
-- Migration: Fix Statement Timeouts & Notifications 403
-- 
-- Problem 1: audit_logs has zero indexes, causing sequential scans that
--            exceed Supabase statement timeout on ORDER BY / WHERE queries.
-- Problem 2: notifications table has no INSERT policy, so admin
--            sendNotification() calls fail with 403.
-- ============================================================================

-- 1. Add indexes to audit_logs for the three query patterns used by adminService

-- Pattern: SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

-- Pattern: SELECT * FROM audit_logs WHERE action IN (...) ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at
  ON public.audit_logs (action, created_at DESC);

-- Pattern: SELECT * FROM audit_logs WHERE user_id = ... ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at
  ON public.audit_logs (user_id, created_at DESC);

-- 2. Add INSERT policy on notifications so admins can send notifications

-- Drop if it already exists to make migration idempotent
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

CREATE POLICY "Admins can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
