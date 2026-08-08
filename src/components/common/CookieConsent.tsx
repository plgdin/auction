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
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-xs z-[1050] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-2xl p-2.5 text-slate-800 animate-fade-in print:hidden ring-1 ring-slate-950/5 max-w-[calc(100vw-2rem)] mx-auto sm:mx-0"
      role="region"
      aria-label="Cookie consent banner"
    >
      <div className="flex items-start gap-2">
        <div className="p-1 bg-slate-100 text-slate-600 rounded-lg shrink-0 mt-0.5">
          <Cookie className="w-3.5 h-3.5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-[11px] font-bold text-slate-900 tracking-tight">
              Cookie Preferences
            </h4>
            <button 
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors cursor-pointer"
              aria-label="Dismiss cookie banner"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">
            We use essential cookies to maintain your session & bidding preferences.
          </p>
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={handleDecline}
              className="flex-1 inline-flex items-center justify-center px-1.5 py-0.5 border border-slate-200 text-[10px] font-semibold rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold rounded-md text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
