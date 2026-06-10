import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Gavel, Heart, Wallet, Bell, 
  Settings, Building2, LogOut, FileText, FolderLock
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import clsx from 'clsx';

export function Sidebar() {
  const location = useLocation();
  const { logout, profile } = useAuthStore();

  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Bids', path: '/dashboard/bids', icon: Gavel },
    { name: 'My Tenders', path: '/dashboard/tenders', icon: FileText },
    { name: 'Watchlist', path: '/dashboard/watchlist', icon: Heart },
    { name: 'Wallet & EMD', path: '/dashboard/wallet', icon: Wallet },
    { name: 'Document Vault', path: '/dashboard/documents', icon: FolderLock },
    { name: 'Notifications', path: '/dashboard/notifications', icon: Bell },
    { name: 'Profile Settings', path: '/dashboard/profile', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="w-64 bg-slate-900 min-h-screen text-slate-300 flex flex-col hidden lg:flex sticky top-0 h-screen">
      <div className="h-20 flex items-center px-6 border-b border-slate-800 shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary text-white rounded-md flex items-center justify-center font-bold text-lg">
            M
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            Auction Dashboard
          </span>
        </Link>
      </div>

      <div className="p-6 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white shadow-inner">
            {profile?.first_name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium truncate mt-0.5">
              {profile?.role || 'Buyer'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto hide-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={clsx(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                isActive ? "text-white" : "text-slate-500 group-hover:text-primary-400"
              )} />
              {item.name}
            </Link>
          );
        })}

        {profile?.role === 'admin' || profile?.role === 'superadmin' ? (
          <>
            <div className="pt-6 pb-2">
              <p className="px-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Administration
              </p>
            </div>
            <Link
              to="/admin"
              className={clsx(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                location.pathname.startsWith('/admin')
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <Building2 className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                location.pathname.startsWith('/admin') ? "text-white" : "text-slate-500 group-hover:text-primary-400"
              )} />
              Admin Portal
            </Link>
          </>
        ) : null}

        {profile?.role === 'seller' || profile?.role === 'admin' || profile?.role === 'superadmin' ? (
          <>
            <div className="pt-6 pb-2">
              <p className="px-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Organization
              </p>
            </div>
            <Link
              to="/seller"
              className={clsx(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                location.pathname.startsWith('/seller')
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <Building2 className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                location.pathname.startsWith('/seller') ? "text-white" : "text-slate-500 group-hover:text-primary-400"
              )} />
              Seller Portal
            </Link>
          </>
        ) : null}
      </nav>

      <div className="p-4 border-t border-slate-800 shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all group"
        >
          <LogOut className="w-5 h-5 mr-3 shrink-0 text-slate-500 group-hover:text-red-400" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
