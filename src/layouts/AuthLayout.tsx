import { Link, Outlet, useLocation } from 'react-router-dom';
import { PageTracker } from '../components/common/PageTracker';
import { CookieConsent } from '../components/common/CookieConsent';
import clsx from 'clsx';

export function AuthLayout() {
  const location = useLocation();
  const subtitlePhrase = 'Everything you need in a single platform.';
  const isRegister = location.pathname.includes('/register') || location.pathname.includes('/signup');

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between relative overflow-x-hidden font-sans">
      <PageTracker />
      
      {/* Background ambient glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl pointer-events-none z-0" />

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 relative z-10">

        {/* Branding Column (Left - Desktop only) */}
        <div className="hidden md:flex bg-slate-900/90 backdrop-blur-xl relative overflow-hidden flex-col justify-between p-12 lg:p-16 text-white border-r border-slate-800/60">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950 mix-blend-multiply" />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/10 to-transparent" />
          </div>

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center">
            <Link to="/" className="inline-block transition-transform hover:scale-105">
              <img src="/png_lelam_1.webp" alt="Lelam Logo" width={317} height={64} className="h-14 lg:h-16 w-auto object-contain brightness-0 invert filter drop-shadow-md mb-8" />
            </Link>

            <p className="text-xl lg:text-2xl font-bold text-slate-200 max-w-md leading-relaxed">
              {subtitlePhrase}
            </p>
          </div>

          <div className="relative z-10 flex justify-between items-center border-t border-slate-800/50 pt-6 mt-6">
            <div className="flex gap-1.5 items-center">
              <span
                className={clsx(
                  "h-1.5 rounded-full transition-all duration-500 ease-in-out",
                  !isRegister ? "w-8 bg-primary shadow-sm" : "w-4 bg-slate-700"
                )}
              />
              <span className="w-4 h-1.5 rounded-full bg-slate-700" />
              <span
                className={clsx(
                  "h-1.5 rounded-full transition-all duration-500 ease-in-out",
                  isRegister ? "w-8 bg-primary shadow-sm" : "w-4 bg-slate-700"
                )}
              />
            </div>
          </div>
        </div>

        {/* Form Column (Right / Center on Mobile & Tablet) */}
        <div className="flex flex-col justify-center items-center py-8 sm:py-12 px-4 sm:px-6 md:px-10 lg:px-16 min-h-[calc(100vh-60px)] md:min-h-0 bg-slate-950">
          <div className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-100">
            {/* Mobile Branding Header */}
            <div className="md:hidden flex flex-col items-center mb-6">
              <Link to="/" className="inline-block">
                <img src="/png_lelam_1.webp" alt="Lelam Logo" width={238} height={48} className="h-10 sm:h-12 w-auto object-contain filter drop-shadow-sm" />
              </Link>
            </div>

            <Outlet />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-4 px-4 sm:px-8 md:px-16 flex flex-col sm:flex-row justify-between items-center text-xs border-t border-slate-900 gap-2.5 z-10">
        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-center sm:text-left">
          <span className="font-medium text-slate-400">&copy; {new Date().getFullYear()} lelam.co All rights reserved.</span>
          <span className="hidden sm:inline text-slate-700">•</span>
          <span className="text-[11px] text-slate-500">Not affiliated with MSTC.</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3.5 sm:gap-6 font-medium text-slate-400">
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link to="/cookies" className="hover:text-white transition-colors">Cookies</Link>
          <Link to="/support" className="hover:text-white transition-colors">Support</Link>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}
