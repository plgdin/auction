import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { TopBar } from '../components/common/TopBar';
import { AnnouncementBanner } from '../components/common/AnnouncementBanner';

export function DashboardLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AnnouncementBanner />
      <div className="flex-1 flex bg-background overflow-hidden relative">
        <Sidebar />
        <div className="flex-1 flex flex-col relative z-0">
          <TopBar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
