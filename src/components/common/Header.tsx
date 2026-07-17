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

function CurrencyDropdown({ isTransparent }: { isTransparent?: boolean }) {
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
        className={clsx(
          "flex items-center gap-2 px-3.5 py-2 border rounded-xl shadow-2xs text-sm transition-all cursor-pointer font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20",
          isTransparent
            ? "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30"
            : "bg-white text-slate-700 border-slate-250 hover:border-primary hover:bg-slate-50/55"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{selected.label}</span>
        <ChevronDown className={clsx('w-3 h-3 transition-transform', open && 'rotate-180', isTransparent ? 'text-white/60' : 'text-slate-450')} />
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
  const [heroScrollProgress, setHeroScrollProgress] = useState(0);
  const [heroMounted, setHeroMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Monitor window scroll for transition threshold
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for hero scroll events from HeroSection
  useEffect(() => {
    const handleHeroScroll = (e: Event) => {
      setHeroScrollProgress((e as CustomEvent).detail);
    };
    const handleHeroMount = (e: Event) => {
      setHeroMounted((e as CustomEvent).detail);
    };
    window.addEventListener('hero-scroll-progress', handleHeroScroll);
    window.addEventListener('hero-mount', handleHeroMount);
    return () => {
      window.removeEventListener('hero-scroll-progress', handleHeroScroll);
      window.removeEventListener('hero-mount', handleHeroMount);
    };
  }, []);

  // Reset hero state when navigating away from home
  useEffect(() => {
    if (location.pathname !== '/') {
      setHeroMounted(false);
      setHeroScrollProgress(0);
    }
  }, [location.pathname]);

  const isHomePage = location.pathname === '/';
  
  // Decide transparency state
  const isHeaderTransparent = isHomePage && heroMounted && !isScrolled;

  // Logo visibility: hidden when hero logo is visible, appears as hero logo fades
  const navLogoOpacity = isHeaderTransparent ? 0 : 1;
  const navLogoSlideY = isHeaderTransparent ? -8 : 0; // slide down 8px

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Auctions', href: '/auctions' },
    { name: 'News', href: '/news' },
    { name: 'Blog', href: '/blog' },
    { name: 'FAQ', href: '/faq' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 transition-all duration-300" style={{
      borderBottom: isHeaderTransparent ? '1px solid rgba(0, 0, 0, 0)' : '1px solid rgba(0, 0, 0, 0.06)',
      boxShadow: isHeaderTransparent ? 'none' : '0 1px 4px 0 rgba(0, 0, 0, 0.04)',
    }}>
      {/* Sliding white background panel */}
      <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
        <div 
          className={clsx(
            "absolute inset-0 bg-white/95 backdrop-blur-md transition-transform duration-500 ease-out",
            isHeaderTransparent ? "-translate-y-full" : "translate-y-0"
          )} 
        />
      </div>

      <div className="w-full px-4 sm:px-8 lg:px-12">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center -ml-4" style={{
            opacity: navLogoOpacity,
            transform: `translateY(${navLogoSlideY}px)`,
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}>
            <Link to="/" className="flex items-center gap-2">
              <img src="/png_lelam_1.webp" alt="Lelam Logo" width={188} height={38} className="w-auto object-contain" style={{ height: '38px' }} />
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
                    ? (isHeaderTransparent
                        ? 'text-white bg-white/20 shadow-sm'
                        : 'text-primary-700 bg-primary-100 shadow-sm')
                    : (isHeaderTransparent
                        ? 'text-slate-100 hover:text-white hover:bg-white/15 hover:shadow-sm hover:-translate-y-0.5'
                        : 'text-slate-800 hover:text-primary-700 hover:bg-primary-100/70 hover:shadow-sm hover:-translate-y-0.5')
                )}
              >
                {item.name}
              </Link>
            ))}

            <div className={clsx(
              "pl-4 ml-4 border-l flex items-center space-x-4",
              isHeaderTransparent ? "border-white/20" : "border-slate-200"
            )}>
              <CurrencyDropdown isTransparent={isHeaderTransparent} />

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
              aria-label={isMobileMenuOpen ? "Close main menu" : "Open main menu"}
              className={clsx(
                "inline-flex items-center justify-center p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary",
                isHeaderTransparent
                  ? "text-white hover:text-white/85 hover:bg-white/10"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
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
