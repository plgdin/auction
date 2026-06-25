-- Create system_settings table to store global configurations
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to system settings
CREATE POLICY "Allow public read access to system settings"
ON system_settings
FOR SELECT
USING (true);

-- Allow only admins to manage system settings
CREATE POLICY "Allow admins to manage system settings"
ON system_settings
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
);

-- Insert default maintenance_mode setting
INSERT INTO system_settings (key, value)
VALUES ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
