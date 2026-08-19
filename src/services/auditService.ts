import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { AuditLog } from '../types/database.types';

let cachedIp: string | null = null;

/**
 * Fetches the user's public IP address with multiple fallbacks and a timeout.
 */
export async function getClientIpAddress(): Promise<string> {
  if (cachedIp) return cachedIp;
  
  try {
    const sessionIp = sessionStorage.getItem('lelam_cached_ip');
    if (sessionIp) {
      cachedIp = sessionIp;
      return sessionIp;
    }
  } catch (e) {
    // Ignore session storage errors
  }

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
          try {
            sessionStorage.setItem('lelam_cached_ip', ip);
          } catch (e) {}
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

    const { error } = await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: userId,
          action,
          entity_type: entityType || null,
          entity_id: entityId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId) ? entityId : null,
          details,
          ip_address: ip
        }
      ]);

    if (error) {
      console.error('Failed to insert audit log:', error);
      return null;
    }
    
    // Return dummy object conforming to type or just a success indicator since return is unused
    return { id: '', action } as any;
  } catch (err) {
    console.error('Error logging user activity:', err);
    return null;
  }
}
