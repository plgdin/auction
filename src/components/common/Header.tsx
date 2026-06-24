import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import clsx from 'clsx';

const CURRENCIES = [
  { code: 'INR', label: 'INR (₹)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
];

function CurrencyDropdown() {
  const { currency, setCurrency } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3.5 py-2 border border-slate-250 rounded-xl shadow-2xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer font-mono font-bold"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{selected.label}</span>
        <ChevronDown className={clsx('w-3 h-3 text-slate-450 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-200 p-2 min-w-[160px] flex flex-col gap-0.5 z-50"
        >
          {CURRENCIES.map(opt => (
            <div
              key={opt.code}
              role="option"
              aria-selected={currency === opt.code}
              onClick={() => { setCurrency(opt.code); setOpen(false); }}
              className={clsx(
                'flex items-center gap-2 py-1.5 px-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors select-none',
                currency === opt.code
                  ? 'bg-primary-50/70 text-primary font-semibold'
                  : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              )}
            >
              <span className={clsx(
                'w-4 h-4 rounded border transition-colors flex items-center justify-center flex-shrink-0',
                currency === opt.code ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
              )}>
                {currency === opt.code && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </span>
              <span className="font-mono">{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
              {/* Explicit width/height to prevent CLS */}
              <img
                src="/png_lelam_1.webp"
                alt="Lelam Logo"
                width="120"
                height="38"
                className="w-auto object-contain"
                style={{ height: '38px' }}
              />
              <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm uppercase tracking-widest mt-1">Beta</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1 lg:space-x-4 items-center">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'px-4 py-2.5 rounded-md text-base font-medium transition-all duration-300',
                  isActive(item.href)
                    ? 'text-primary-700 bg-primary-100 shadow-sm'
                    : 'text-slate-800 hover:text-primary-700 hover:bg-primary-100/70 hover:shadow-sm hover:-translate-y-0.5'
                )}
              >
                {item.name}
              </Link>
            ))}

            <div className="pl-4 ml-4 border-l border-slate-200 flex items-center space-x-4">
              <CurrencyDropdown />

              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary-700 transition-colors"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/auth/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 transition-colors"
                >
                  Sign In
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
                  'block px-3 py-2 rounded-md text-base font-medium transition-all duration-200',
                  isActive(item.href)
                    ? 'text-primary-700 bg-primary-100'
                    : 'text-slate-800 hover:text-primary-700 hover:bg-primary-100/70'
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
                    to="/auth/login"
                    className="block w-full text-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign In
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
