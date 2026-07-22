import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { publicService } from '../../services/publicService';
import { Maintenance } from '../../pages/Maintenance';

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  // Default to false so page loads instantly
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(false);
  const { profile } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    const fetchMaintenanceState = async () => {
      try {
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000));
        const mode = await Promise.race([publicService.getMaintenanceMode(), timeoutPromise]);
        if (isMounted) {
          setMaintenanceEnabled(!!mode);
        }
      } catch (e) {
        if (isMounted) setMaintenanceEnabled(false);
      }
    };
    fetchMaintenanceState();

    // Subscribe to realtime database updates
    const subscription = supabase
      .channel('system_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.maintenance_mode'
        },
        (payload) => {
          if (isMounted) {
            const newValue = payload.new ? (payload.new as any).value : false;
            setMaintenanceEnabled(!!newValue);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, []);

  // Admins & superadmins bypass maintenance
  const isBypassed = profile?.role === 'admin' || profile?.role === 'superadmin';
  if (maintenanceEnabled && !isBypassed) {
    return <Maintenance />;
  }

  return <>{children}</>;
}
