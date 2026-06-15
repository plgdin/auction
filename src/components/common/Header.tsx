import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import clsx from 'clsx';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Auctions', href: '/auctions' },
    { name: 'News', href: '/news' },
    { name: 'FAQ', href: '/faq' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
      <div className="w-full px-4 sm:px-8 lg:px-12">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center -ml-4">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain" />
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Lelam e-Procurement
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1 lg:space-x-4 items-center">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  "px-4 py-2.5 rounded-md text-base font-medium transition-all duration-300",
                  isActive(item.href)
                    ? "text-primary-700 bg-primary-100 shadow-sm"
                    : "text-slate-800 hover:text-primary-700 hover:bg-primary-100/70 hover:shadow-sm hover:-translate-y-0.5"
                )}
              >
                {item.name}
              </Link>
            ))}

            <div className="pl-4 ml-4 border-l border-slate-200 flex items-center space-x-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary-700 transition-colors"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/auth/register"
                  className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 transition-colors"
                >
                  Sign Up
                </Link>
              )}
            </div>
          </nav>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  "block px-3 py-2 rounded-md text-base font-medium transition-all duration-200",
                  isActive(item.href)
                    ? "text-primary-700 bg-primary-100"
                    : "text-slate-800 hover:text-primary-700 hover:bg-primary-100/70"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            
            <div className="pt-4 mt-4 border-t border-slate-200">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="block w-full text-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary-700"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/auth/register"
                    className="block w-full text-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
