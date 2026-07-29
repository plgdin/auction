import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { readCookieConsent, writeCookieConsent } from '../../utils/cookieConsent';

export function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    let consent = readCookieConsent();

    // Preserve a previous explicit choice while migrating away from localStorage.
    const legacyConsent = localStorage.getItem('cookie-consent');
    if (!consent && (legacyConsent === 'accepted' || legacyConsent === 'declined')) {
      writeCookieConsent(legacyConsent);
      consent = legacyConsent;
    }
    localStorage.removeItem('cookie-consent');

    if (!consent) {
      // Small delay for clean entrance animation
      const timer = setTimeout(() => {
        setShowConsent(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    writeCookieConsent('accepted');
    setShowConsent(false);
  };

  const handleDecline = () => {
    writeCookieConsent('declined');
    setShowConsent(false);
  };

  const handleDismiss = () => {
    setShowConsent(false);
  };

  if (!showConsent) return null;

  return (
    <div 
      className="fixed top-4 left-4 right-4 sm:right-auto sm:max-w-xs z-[1050] bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl p-3 text-white animate-fade-in print:hidden ring-1 ring-white/10"
      role="region"
      aria-label="Cookie consent banner"
    >
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg shrink-0 mt-0.5">
          <Cookie className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-bold text-white tracking-tight">
              Cookie Preferences
            </h4>
            <button 
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
              aria-label="Dismiss cookie banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-300 mt-1 leading-tight">
            We use essential cookies to maintain your session & bidding preferences.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={handleDecline}
              className="flex-1 inline-flex items-center justify-center px-2 py-1 border border-slate-700 text-[11px] font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 inline-flex items-center justify-center px-2 py-1 text-[11px] font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-sm"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
