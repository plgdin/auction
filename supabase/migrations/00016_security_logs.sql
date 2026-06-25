-- Create security_audit_logs table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    user_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    system_info JSONB,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow insert access to public (for logging failed login attempts)
CREATE POLICY "Allow public insert to security logs"
ON security_audit_logs
FOR INSERT
WITH CHECK (true);

-- Allow only admins to select/read security logs
CREATE POLICY "Allow admins to view security logs"
ON security_audit_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
);
