import { Link, Outlet } from 'react-router-dom';
import { PageTracker } from '../components/common/PageTracker';
import { CookieConsent } from '../components/common/CookieConsent';

export function AuthLayout() {
  const subtitlePhrase = 'Everything you need in a single platform.';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between relative overflow-hidden font-sans">
      <PageTracker />
      {/* Split screen container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2">

        {/* Branding Column (Left) */}
        <div className="hidden md:flex bg-slate-900 relative overflow-hidden flex-col justify-between p-16 text-white">
          {/* Background decoration */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950 mix-blend-multiply" />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/10 to-transparent" />
          </div>

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center">
            <img src="/png_lelam_1.webp" alt="Lelam Logo" className="h-16 w-auto object-contain brightness-0 invert filter drop-shadow-md mb-8" />

            <p className="text-2xl font-bold text-primary-400 max-w-md leading-relaxed">
              {subtitlePhrase}
            </p>
          </div>

          {/* Footer of the branding column */}
          <div className="relative z-10 flex justify-between items-center border-t border-slate-800/50 pt-6 mt-6">
            {/* Progress lines */}
            <div className="flex gap-1.5">
              <span className="w-8 h-1 rounded bg-primary-500"></span>
              <span className="w-4 h-1 rounded bg-slate-700"></span>
              <span className="w-4 h-1 rounded bg-slate-700"></span>
            </div>
          </div>
        </div>

        {/* Form Column (Right) */}
        <div className="bg-white flex flex-col justify-center items-center py-16 px-6 sm:px-12 lg:px-20">
          <div className="w-full max-w-md">
            {/* Small branding for mobile views only */}
            <div className="md:hidden flex flex-col items-center mb-8">
              <img src="/png_lelam_1.webp" alt="Lelam Logo" className="h-12 w-auto object-contain filter drop-shadow-md" />
            </div>

            <Outlet />
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <footer className="bg-slate-950 text-slate-500 py-5 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center text-xs border-t border-slate-900 gap-4">
        <div className="flex flex-col gap-0.5">
          <div>
            &copy; {new Date().getFullYear()} Lelam. All rights reserved.
          </div>
          <div className="text-[10px] text-slate-605">
            Lelam Company is not affiliated with MSTC.
          </div>
        </div>
        <div className="flex gap-6 font-medium">
          <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          <Link to="/cookies" className="hover:text-slate-300 transition-colors">Cookie Policy</Link>
          <Link to="/support" className="hover:text-slate-300 transition-colors">Contact Support</Link>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}
