import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Gavel, LayoutDashboard, Newspaper, HelpCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import clsx from 'clsx';

export function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show bottom navbar whenever user is scrolled past top hero area (50px)
      setIsVisible(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Auctions', path: '/auctions', icon: Gavel },
    { name: 'Dashboard', path: user ? '/dashboard' : '/auth/login', icon: LayoutDashboard },
    { name: 'News', path: '/news', icon: Newspaper },
    { name: 'FAQ', path: '/faq', icon: HelpCircle },
  ];

  return (
    <nav
      className={clsx(
        "fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 py-2 px-2 flex justify-around items-center md:hidden shadow-2xl transition-all duration-300 ease-in-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none"
      )}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);

        return (
          <Link
            key={item.name}
            to={item.path}
            className={clsx(
              "flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer min-w-[60px]",
              isActive
                ? "text-primary font-bold bg-primary/10 scale-105"
                : "text-slate-500 hover:text-slate-900 font-medium"
            )}
          >
            <Icon className={clsx("w-5 h-5 mb-0.5", isActive ? "text-primary" : "text-slate-400")} />
            <span className="text-[10px] tracking-tight">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
