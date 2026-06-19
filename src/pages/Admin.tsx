import { Shield } from 'lucide-react';
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
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Admin Header */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Shield className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold mb-2 flex items-center">
            Enterprise Control Panel
          </h1>
          <p className="text-slate-300 max-w-2xl text-lg">
            Global system administration, user moderation, and platform analytics.
          </p>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {renderContent()}
      </div>
    </div>
  );
}
