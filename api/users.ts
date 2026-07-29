import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';

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

  // 1. Rate Limiting & Abuse Protection
  const ip = getClientIp(req);
  // Limit to 30 requests per minute per IP for user directory access
  if (isRateLimited(ip, 30, 60 * 1000)) {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.'
      }
    });
    return;
  }

  let user: any = null;
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    // 2. Authenticate user using the token from request headers
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      // Log unauthorized access attempt
      await supabase.from('security_audit_logs').insert({
        email: 'anonymous',
        ip_address: ip,
        user_agent: userAgent,
        system_info: { endpoint: '/api/users', reason: 'Missing authentication token' }
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication token.'
        }
      });
      return;
    }

    const { data: { user: authedUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authedUser) {
      await supabase.from('security_audit_logs').insert({
        email: 'anonymous',
        ip_address: ip,
        user_agent: userAgent,
        system_info: { endpoint: '/api/users', reason: 'Invalid or expired token supplied' }
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired authentication token.'
        }
      });
      return;
    }
    user = authedUser;

    // 3. Verify user has admin/superadmin role (Broken Authorization Check defense)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      // Log forbidden authorization escalation/abuse attempt
      await supabase.from('security_audit_logs').insert({
        email: user.email || 'unknown',
        user_id: user.id,
        ip_address: ip,
        user_agent: userAgent,
        system_info: { endpoint: '/api/users', role: profile?.role || 'none', reason: 'Requires administrator privileges' }
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Requires administrator privileges.'
        }
      });
      return;
    }

    // 4. Fetch all profiles (since service role client is used, RLS is bypassed)
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    // 5. Fetch all auth users to retrieve their email addresses
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      throw listError;
    }
    const authUsers = (listData?.users || []) as any[];
    
    // Map emails and last sign in timestamps
    const emailMap: Record<string, string> = {};
    const lastSignInMap: Record<string, string> = {};

    if (authUsers.length > 0) {
      authUsers.forEach(u => {
        if (u.id && u.email) {
          emailMap[u.id] = u.email;
        }
        if (u.id && u.last_sign_in_at) {
          lastSignInMap[u.id] = u.last_sign_in_at;
        }
      });
    }

    // 6. Fetch latest audit logs to get IP addresses and activity
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select('user_id, ip_address, created_at, action')
      .order('created_at', { ascending: false });

    if (auditError) {
      throw auditError;
    }

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

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: usersList
    });
  } catch (error: any) {
    // Failure Handling: log internal server error details securely without exposing details to client
    console.error('Error in /api/users handler:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.'
      }
    });
  }
}
