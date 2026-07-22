import { Outlet } from 'react-router-dom';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { AnnouncementBanner } from '../components/common/AnnouncementBanner';
import { PageTracker } from '../components/common/PageTracker';
import { CookieConsent } from '../components/common/CookieConsent';
import { MaintenanceGuard } from '../components/common/MaintenanceGuard';

export function MainLayout() {
  return (
    <MaintenanceGuard>
      <div className="flex flex-col min-h-screen">
        {/* Skip-to-content link for keyboard/screen-reader accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-2 focus:left-2 focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-semibold">
          Skip to main content
        </a>
        <PageTracker />
        <AnnouncementBanner />
        <Header />
        <main id="main-content" className="flex-grow" role="main">
          <Outlet />
        </main>
        <Footer />
        <CookieConsent />
      </div>
    </MaintenanceGuard>
  );
}

