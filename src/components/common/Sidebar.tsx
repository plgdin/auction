import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Gavel, Heart, Wallet, Bell, 
  Settings, Building2, LogOut, FolderLock
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import clsx from 'clsx';

export function Sidebar() {
  const location = useLocation();
  const { logout, profile } = useAuthStore();

  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Bids', path: '/dashboard/bids', icon: Gavel },
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
    <aside className="w-64 bg-white border-r border-border min-h-screen text-foreground flex flex-col hidden lg:flex sticky top-0 h-screen">
      <div className="h-20 flex items-center px-6 border-b border-border shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary text-white rounded flex items-center justify-center font-bold text-lg">
            M
          </div>
          <span className="text-xl font-extrabold text-foreground tracking-tight">
            Auction Dashboard
          </span>
        </Link>
      </div>

      <div className="p-6 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-muted border border-border flex items-center justify-center font-bold text-foreground shadow-sm">
            {profile?.first_name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-foreground truncate">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold truncate mt-0.5">
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
                "flex items-center px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
              {item.name}
            </Link>
          );
        })}

        {profile?.role === 'admin' || profile?.role === 'superadmin' ? (
          <>
            <div className="pt-6 pb-2">
              <p className="px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Administration
              </p>
            </div>
            <Link
              to="/admin"
              className={clsx(
                "flex items-center px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 group",
                location.pathname.startsWith('/admin')
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Building2 className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                location.pathname.startsWith('/admin') ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
              Admin Portal
            </Link>
          </>
        ) : null}

        {profile?.role === 'seller' || profile?.role === 'admin' || profile?.role === 'superadmin' ? (
          <>
            <div className="pt-6 pb-2">
              <p className="px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Organization
              </p>
            </div>
            <Link
              to="/seller"
              className={clsx(
                "flex items-center px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 group",
                location.pathname.startsWith('/seller')
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Building2 className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                location.pathname.startsWith('/seller') ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
              Seller Portal
            </Link>
          </>
        ) : null}
      </nav>

      <div className="p-4 border-t border-border shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2.5 rounded text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all group"
        >
          <LogOut className="w-5 h-5 mr-3 shrink-0 text-muted-foreground group-hover:text-destructive" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
