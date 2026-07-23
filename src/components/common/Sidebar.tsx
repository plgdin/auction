import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Gavel, Heart, Bell, 
  Settings, Building2, LogOut, FolderLock, Users, Calendar, ClipboardCheck,
  ArrowLeft, FileText, Cpu, Megaphone, BarChart3, Mail, TrendingUp, HelpCircle, ShieldAlert, Truck
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import clsx from 'clsx';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, profile } = useAuthStore();
  const { activeAdminTab, setActiveAdminTab } = useAppStore();

  const handleAdminItemClick = (itemId: string) => {
    setActiveAdminTab(itemId);
    if (!location.pathname.startsWith('/admin')) {
      navigate('/admin');
    }
  };

  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Bids', path: '/dashboard/bids', icon: Gavel },
    { name: 'Interested', path: '/dashboard/interested', icon: Heart },
    { name: 'Quote Builder', path: '/dashboard/quotes', icon: FileText },
    { name: 'Shipping Requests', path: '/dashboard/shipping-requests', icon: Truck },
    { name: 'Document Vault', path: '/dashboard/documents', icon: FolderLock },
    { name: 'Calendar & Alerts', path: '/dashboard/reminders', icon: Calendar },
    { name: 'Personal Vendors', path: '/dashboard/vendors', icon: Users },
    { name: 'Inventory Checklist', path: '/dashboard/inventory', icon: ClipboardCheck },
    { name: 'Notifications', path: '/dashboard/notifications', icon: Bell },
  ];

  const adminNavItems = [
    { name: 'Overview & Analytics', id: 'overview', icon: LayoutDashboard },
    { name: 'System Activity Logs', id: 'activities', icon: ShieldAlert },
    { name: 'Scraper & Ingestion', id: 'scraper', icon: Cpu },
    { name: 'Market Price Manager', id: 'market-prices', icon: TrendingUp },
    { name: 'FAQ Manager', id: 'faq', icon: HelpCircle },
    { name: 'News & Media Manager', id: 'news', icon: FileText },
    { name: 'Advanced Reports', id: 'reports', icon: BarChart3 },
    { name: 'Blog Manager', id: 'blogs', icon: FileText },
    { name: 'User Management', id: 'users', icon: Users },
    { name: 'System Announcements', id: 'system', icon: Megaphone },
    { name: 'Contact Messages', id: 'messages', icon: Mail },
  ];

  const handleLogout = async () => {
    await logout();
  };

  const isAdminSide = location.pathname.startsWith('/admin');

  return (
    <aside className="w-64 bg-white border-r border-border min-h-screen text-foreground flex flex-col hidden lg:flex sticky top-0 h-screen">
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/png_lelam_1.webp" alt="Lelam Logo" width={158} height={32} className="h-8 w-auto object-contain" />
        </Link>
      </div>



      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto hide-scrollbar">
        <Link
          to="/auctions"
          className="flex items-center px-3 py-2.5 mb-4 rounded text-sm font-semibold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2.5 shrink-0" />
          Back to Auctions
        </Link>
        {(profile?.role === 'admin' || profile?.role === 'superadmin') ? (
          adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith('/admin') && activeAdminTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleAdminItemClick(item.id)}
                className={clsx(
                  "w-full flex items-center px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 group text-left cursor-pointer",
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
              </button>
            );
          })
        ) : (
          navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={clsx(
                  "flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary font-semibold" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center">
                  <Icon className={clsx(
                    "w-5 h-5 mr-3 shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                  )} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })
        )}



        {!isAdminSide && (profile?.role === 'seller' || profile?.role === 'admin' || profile?.role === 'superadmin') ? (
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

        {!isAdminSide && (profile?.role === 'logistics' || profile?.role === 'admin' || profile?.role === 'superadmin') ? (
          <>
            <div className="pt-6 pb-2">
              <p className="px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Logistics
              </p>
            </div>
            <Link
              to="/logistics"
              className={clsx(
                "flex items-center px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 group",
                location.pathname === '/logistics'
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Truck className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                location.pathname === '/logistics' ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
              Portal Dashboard
            </Link>
            <Link
              to="/logistics/requests"
              className={clsx(
                "flex items-center px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 group mt-1",
                location.pathname === '/logistics/requests'
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <ClipboardCheck className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                location.pathname === '/logistics/requests' ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
              Incoming Quotes
            </Link>
            <Link
              to="/logistics/profile"
              className={clsx(
                "flex items-center px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 group mt-1",
                location.pathname === '/logistics/profile'
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className={clsx(
                "w-5 h-5 mr-3 shrink-0 transition-colors",
                location.pathname === '/logistics/profile' ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
              Provider Profile
            </Link>
          </>
        ) : null}
      </nav>

      <div className="p-4 border-t border-slate-150 shrink-0 bg-slate-50/50 space-y-2.5">
        {/* Profile Info Card */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-slate-150 shadow-2xs">
          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-sm shadow-2xs">
            {profile?.first_name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold truncate mt-0.5">
              {profile?.role || 'Buyer'}
            </p>
          </div>
        </div>

        {/* Profile Settings Link */}
        <Link
          to="/dashboard/profile"
          className={clsx(
            "flex items-center px-3 py-2 rounded-lg text-xs font-bold transition-all duration-150 group",
            location.pathname === '/dashboard/profile'
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <Settings className={clsx(
            "w-4 h-4 mr-2.5 shrink-0 transition-colors",
            location.pathname === '/dashboard/profile' ? "text-white" : "text-slate-450 group-hover:text-slate-700"
          )} />
          Settings
        </Link>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-all duration-150 group cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2.5 shrink-0 text-slate-400 group-hover:text-red-500 transition-colors" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
