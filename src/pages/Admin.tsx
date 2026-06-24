import { AdminOverview } from '../components/admin/AdminOverview';
import { UserManagement } from '../components/admin/UserManagement';
import { SystemManagement } from '../components/admin/SystemManagement';
import { ReportsAnalytics } from '../components/admin/ReportsAnalytics';
import { ScraperDashboard } from '../components/admin/ScraperDashboard';
import { NewsManagement } from '../components/admin/NewsManagement';
import { ContactMessages } from '../components/admin/ContactMessages';
import { AuditLogsView } from '../components/admin/AuditLogsView';
import { MarketPriceManagement } from '../components/admin/MarketPriceManagement';
import { FaqManagement } from '../components/admin/FaqManagement';
import { useAppStore } from '../store/appStore';

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
      case 'messages':
        return <ContactMessages />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Content Area */}
      <div className="mt-6">
        {renderContent()}
      </div>
    </div>
  );
}
