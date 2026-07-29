import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, X, Gavel, 
  HelpCircle, Newspaper, BookOpen, Info, Mail, Home as HomeIcon, Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import clsx from 'clsx';

/*
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
*/

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [heroMounted, setHeroMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Monitor window scroll for transition threshold - trigger as soon as scrolling starts
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 2);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for hero scroll events from HeroSection
  useEffect(() => {
    const handleHeroMount = (e: Event) => {
      setHeroMounted((e as CustomEvent).detail);
    };
    window.addEventListener('hero-mount', handleHeroMount);
    return () => {
      window.removeEventListener('hero-mount', handleHeroMount);
    };
  }, []);

  // Reset hero state when navigating away from home
  useEffect(() => {
    if (location.pathname !== '/') {
      setHeroMounted(false);
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
    { name: 'Pricing', href: '/pricing' },
    { name: 'News', href: '/news' },
    { name: 'Blog', href: '/blog' },
    { name: 'FAQ', href: '/faq' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 transition-all duration-300" role="banner" style={{
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
          <div className="flex-shrink-0 flex items-center" style={{
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
          <nav className="hidden md:flex space-x-1 lg:space-x-4 items-center" aria-label="Main navigation">
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

            <div className="flex items-center space-x-4 ml-4">
              {/* CurrencyDropdown is temporarily hidden */}

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

      {/* Mobile Navigation Drop-Down Panel (White background, Dark Blue selected state) */}
      <div 
        className={clsx(
          "fixed inset-0 z-50 bg-white/98 backdrop-blur-2xl text-slate-900 md:hidden flex flex-col justify-between p-6 overflow-y-auto select-none transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xl",
          isMobileMenuOpen 
            ? "translate-y-0 opacity-100 pointer-events-auto" 
            : "-translate-y-full opacity-0 pointer-events-none"
        )}
      >
        {/* Top Header Row with Logo & Close Button */}
        <div className="flex items-center justify-between shrink-0 pb-4 border-b border-slate-150">
          <Link 
            to="/" 
            className="flex items-center gap-2"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <img 
              src="/png_lelam_1.webp" 
              alt="Lelam Logo" 
              width={140} 
              height={32} 
              className="h-8 w-auto object-contain" 
            />
            <span className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Beta</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
            className="p-2 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer border border-slate-200 shadow-2xs"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Perfectly Aligned Main Navigation Links */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-2.5 my-auto w-full">
          <div className={clsx(
            "w-full max-w-[220px] flex flex-col space-y-2.5 transition-all duration-500 delay-75",
            isMobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          )}>
            {navigation.map((item) => {
              const getIcon = (name: string) => {
                switch(name) {
                  case 'Home': return HomeIcon;
                  case 'Auctions': return Gavel;
                  case 'News': return Newspaper;
                  case 'Blog': return BookOpen;
                  case 'FAQ': return HelpCircle;
                  case 'About': return Info;
                  case 'Contact': return Mail;
                  default: return Sparkles;
                }
              };
              const IconComp = getIcon(item.name);
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'w-full py-3.5 px-5 rounded-2xl text-base font-bold transition-all duration-200 flex items-center justify-start gap-4 cursor-pointer',
                    active
                      ? 'text-white bg-primary shadow-lg shadow-primary/30 border border-primary scale-105'
                      : 'text-slate-700 hover:text-primary hover:bg-slate-100 border border-transparent'
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <IconComp className={clsx("w-5 h-5 shrink-0", active ? "text-white" : "text-slate-400")} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions Area */}
        <div className={clsx(
          "shrink-0 pt-6 border-t border-slate-150 flex flex-col items-center space-y-4 text-center w-full max-w-xs mx-auto transition-all duration-500 delay-150",
          isMobileMenuOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        )}>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full text-center py-3.5 px-6 rounded-2xl text-base font-bold text-white bg-primary hover:bg-primary/95 shadow-lg shadow-primary/30 transition-all cursor-pointer"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              to="/auth/login"
              className="w-full text-center py-3.5 px-6 rounded-2xl text-base font-bold text-white bg-primary hover:bg-primary/95 shadow-lg shadow-primary/30 transition-all cursor-pointer"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Sign In
            </Link>
          )}
          {/* CurrencyDropdown is temporarily hidden */}
        </div>
      </div>
    </header>
  );
}
