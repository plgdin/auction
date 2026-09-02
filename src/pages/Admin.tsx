import { lazy, Suspense } from 'react';
import { useAppStore } from '../store/appStore';
import { Loader2 } from 'lucide-react';

const AdminOverview = lazy(() => import('../components/admin/AdminOverview').then(m => ({ default: m.AdminOverview })));
const UserManagement = lazy(() => import('../components/admin/UserManagement').then(m => ({ default: m.UserManagement })));
const SystemManagement = lazy(() => import('../components/admin/SystemManagement').then(m => ({ default: m.SystemManagement })));
const ReportsAnalytics = lazy(() => import('../components/admin/ReportsAnalytics').then(m => ({ default: m.ReportsAnalytics })));
const ScraperDashboard = lazy(() => import('../components/admin/ScraperDashboard').then(m => ({ default: m.ScraperDashboard })));
const NewsManagement = lazy(() => import('../components/admin/NewsManagement').then(m => ({ default: m.NewsManagement })));
const ContactMessages = lazy(() => import('../components/admin/ContactMessages').then(m => ({ default: m.ContactMessages })));
const AuditLogsView = lazy(() => import('../components/admin/AuditLogsView').then(m => ({ default: m.AuditLogsView })));
const MarketPriceManagement = lazy(() => import('../components/admin/MarketPriceManagement').then(m => ({ default: m.MarketPriceManagement })));
const FaqManagement = lazy(() => import('../components/admin/FaqManagement').then(m => ({ default: m.FaqManagement })));
const BlogManagement = lazy(() => import('../components/admin/BlogManagement').then(m => ({ default: m.BlogManagement })));
const CouponManagement = lazy(() => import('../components/admin/CouponManagement').then(m => ({ default: m.CouponManagement })));

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[300px] w-full text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export function Admin() {
  const { activeAdminTab } = useAppStore();

  const renderContent = () => {
    switch (activeAdminTab) {
      case 'overview':
        return <AdminOverview />;
      case 'activities':
        return <AuditLogsView />;
      case 'scraper':
        return <ScraperDashboard />;
      case 'market-prices':
        return <MarketPriceManagement />;
      case 'faq':
        return <FaqManagement />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'users':
        return <UserManagement />;
      case 'system':
        return <SystemManagement />;
      case 'news':
        return <NewsManagement />;
      case 'blogs':
        return <BlogManagement />;
      case 'messages':
        return <ContactMessages />;
      case 'coupons':
        return <CouponManagement />;
      default:
        return <AdminOverview />;
    }
  };

  const containerWidth = (activeAdminTab === 'system' || activeAdminTab === 'reports') ? 'max-w-[120rem]' : 'max-w-7xl';

  return (
    <div className={`w-full ${containerWidth} mx-auto space-y-6 pb-20 px-4 sm:px-6 lg:px-8`}>
      {/* Content Area */}
      <div className="mt-6">
        <Suspense fallback={<TabLoadingFallback />}>
          {renderContent()}
        </Suspense>
      </div>
    </div>
  );
}
