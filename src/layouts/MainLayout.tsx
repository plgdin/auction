import { Outlet } from 'react-router-dom';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { AnnouncementBanner } from '../components/common/AnnouncementBanner';
import { DevBanner } from '../components/common/DevBanner';

export function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <DevBanner />
      <AnnouncementBanner />
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

