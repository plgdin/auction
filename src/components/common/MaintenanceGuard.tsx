import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Maintenance } from '../../pages/Maintenance';

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  // Default to false so page loads instantly
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(false);
  const { profile } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    const fetchMaintenanceState = async () => {
      try {
        const [, { publicService }] = await Promise.all([
          import('../../lib/supabase'),
          import('../../services/publicService'),
        ]);
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000));
        const mode = await Promise.race([publicService.getMaintenanceMode(), timeoutPromise]);
        if (isMounted) {
          setMaintenanceEnabled(!!mode);
        }
      } catch {
        if (isMounted) setMaintenanceEnabled(false);
      }
    };
    let subscription: { unsubscribe: () => unknown } | null = null;
    let cleanupSupabase: ((channel: any) => unknown) | null = null;

    Promise.all([
      import('../../lib/supabase'),
      import('../../services/publicService'),
    ]).then(([{ supabase }]) => {
      if (!isMounted) return;
      cleanupSupabase = supabase.removeChannel.bind(supabase);
      subscription = supabase
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
    }).catch(() => {});

    fetchMaintenanceState();

    return () => {
      isMounted = false;
      if (subscription && cleanupSupabase) cleanupSupabase(subscription);
    };
  }, []);

  // Admins & superadmins bypass maintenance
  const isBypassed = profile?.role === 'admin' || profile?.role === 'superadmin';
  if (maintenanceEnabled && !isBypassed) {
    return <Maintenance />;
  }

  return <>{children}</>;
}
