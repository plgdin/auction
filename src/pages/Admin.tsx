// @ts-nocheck
import { useState } from 'react';
import { LayoutDashboard, Users, Megaphone, Server, Shield, BarChart3 } from 'lucide-react';
import { AdminOverview } from '../components/admin/AdminOverview';
import { UserManagement } from '../components/admin/UserManagement';
import { SystemManagement } from '../components/admin/SystemManagement';
import { ReportsAnalytics } from '../components/admin/ReportsAnalytics';
import clsx from 'clsx';

type AdminTab = 'overview' | 'users' | 'reports' | 'system';

export function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
    { id: 'reports', label: 'Advanced Reports', icon: BarChart3 },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'system', label: 'System Announcements', icon: Megaphone },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverview />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'users':
        return <UserManagement />;
      case 'system':
        return <SystemManagement />;
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

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 flex overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={clsx(
                "flex items-center px-6 py-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                isActive 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={clsx("w-4 h-4 mr-2", isActive ? "text-white" : "text-slate-400")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {renderContent()}
      </div>
    </div>
  );
}
