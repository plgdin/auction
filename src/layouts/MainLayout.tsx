import { Outlet } from 'react-router-dom';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { AnnouncementBanner } from '../components/common/AnnouncementBanner';

export function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <AnnouncementBanner />
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
