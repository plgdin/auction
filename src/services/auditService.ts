import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { AuditLog } from '../types/database.types';

let cachedIp: string | null = null;

/**
 * Fetches the user's public IP address with multiple fallbacks and a timeout.
 */
export async function getClientIpAddress(): Promise<string> {
  if (cachedIp) return cachedIp;
  
  const services = [
    'https://api.ipify.org?format=json',
    'https://ipinfo.io/json',
    'https://api.db-ip.com/v2/free/self'
  ];

  for (const url of services) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const data = await response.json();
        const ip = data.ip || data.clientIp || data.ipAddress;
        if (ip) {
          cachedIp = ip;
          return ip;
        }
      }
    } catch (e) {
      // Ignore and try the next service
    }
  }
  
  return 'unknown';
}

/**
 * Logs a user action or activity to the audit_logs table.
 */
export async function logUserActivity(
  action: string,
  entityType?: string,
  entityId?: string,
  extraDetails?: Record<string, any>
): Promise<AuditLog | null> {
  try {
    const ip = await getClientIpAddress();
    const state = useAuthStore.getState();
    const userId = state.user?.id || null;
    const email = state.user?.email || 'anonymous';

    const details = {
      email,
      userAgent: navigator.userAgent,
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      ...extraDetails
    };

    const { data, error } = await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: userId,
          action,
          entity_type: entityType || null,
          entity_id: entityId || null,
          details,
          ip_address: ip
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Failed to insert audit log:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error logging user activity:', err);
    return null;
  }
}
