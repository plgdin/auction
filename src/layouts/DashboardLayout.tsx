import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { TopBar } from '../components/common/TopBar';
import { AnnouncementBanner } from '../components/common/AnnouncementBanner';
import { PageTracker } from '../components/common/PageTracker';
import { CookieConsent } from '../components/common/CookieConsent';
import { MaintenanceGuard } from '../components/common/MaintenanceGuard';

export function DashboardLayout() {
  return (
    <MaintenanceGuard>
      <div className="flex flex-col h-screen overflow-hidden">
        <PageTracker />
        <AnnouncementBanner />
        <div className="flex-1 flex bg-background overflow-hidden relative">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 relative z-0">
            <TopBar />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 lg:p-8">
              <Outlet />
            </main>
          </div>
        </div>
        <CookieConsent />
      </div>
    </MaintenanceGuard>
  );
}

