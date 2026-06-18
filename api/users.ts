import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 1. Authenticate user using the token from request headers
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      res.status(401).json({ error: 'Missing authentication token' });
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      res.status(401).json({ error: 'Invalid authentication token' });
      return;
    }

    // 2. Verify user has admin/superadmin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      res.status(403).json({ error: 'Access denied: Requires administrator privileges' });
      return;
    }

    // 3. Fetch all profiles (since service role client is used, RLS is bypassed)
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    // 4. Fetch all auth users to retrieve their email addresses
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
    
    // Map emails and last sign in timestamps
    const emailMap: Record<string, string> = {
      '26fbe5e9-f1ae-47de-ada7-2f2992c5ed41': 'admin@auction.com',
      '93667bce-1b57-4bfa-a1a7-186265a1a94f': 'alanbijialex@gmail.com'
    };
    const lastSignInMap: Record<string, string> = {};

    if (authUsers) {
      authUsers.forEach(u => {
        if (u.id && u.email) {
          emailMap[u.id] = u.email;
        }
        if (u.id && u.last_sign_in_at) {
          lastSignInMap[u.id] = u.last_sign_in_at;
        }
      });
    }

    // 5. Fetch latest audit logs to get IP addresses and activity
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('user_id, ip_address, created_at, action')
      .order('created_at', { ascending: false });

    const userActivityMap: Record<string, { lastIp: string; lastActive: string; loginCount: number }> = {};
    if (auditLogs) {
      auditLogs.forEach(log => {
        if (log.user_id) {
          if (!userActivityMap[log.user_id]) {
            userActivityMap[log.user_id] = {
              lastIp: log.ip_address || 'N/A',
              lastActive: log.created_at,
              loginCount: 0
            };
          }
          if (log.action === 'user_login') {
            userActivityMap[log.user_id].loginCount++;
          }
        }
      });
    }

    const usersList = profiles.map(p => ({
      ...p,
      email: emailMap[p.id] || 'N/A',
      last_ip: userActivityMap[p.id]?.lastIp || 'N/A',
      last_active: userActivityMap[p.id]?.lastActive || lastSignInMap[p.id] || null,
      login_count: userActivityMap[p.id]?.loginCount || (lastSignInMap[p.id] ? 1 : 0)
    }));

    res.status(200).json(usersList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
