import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { publicService } from '../../services/publicService';
import { Maintenance } from '../../pages/Maintenance';

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean | null>(null);
  const { profile, isLoading: authLoading } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    const fetchMaintenanceState = async () => {
      const mode = await publicService.getMaintenanceMode();
      if (isMounted) {
        setMaintenanceEnabled(mode);
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

  if (maintenanceEnabled === null || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // Admins & superadmins bypass maintenance
  const isBypassed = profile?.role === 'admin' || profile?.role === 'superadmin';
  if (maintenanceEnabled && !isBypassed) {
    return <Maintenance />;
  }

  return <>{children}</>;
}
